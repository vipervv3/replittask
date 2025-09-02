// IndexedDB-based storage for reliable recording management
interface StoredRecording {
  id: string;
  audioBlob: Blob;
  duration: number;
  timestamp: number;
  status: 'recording' | 'paused' | 'completed' | 'processing' | 'failed' | 'uploaded' | 'interrupted';
  chunks: Blob[];
  metadata: {
    projectId?: string;
    title?: string;
    size: number;
    mimeType: string;
    lastHeartbeat?: number;
    isPaused?: boolean;
  };
  retryCount: number;
  lastError?: string;
}

class RecordingStorageManager {
  private db: IDBDatabase | null = null;
  private readonly dbName = 'VoiceRecordings';
  private readonly version = 1;
  private readonly storeName = 'recordings';

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const target = event.target as IDBOpenDBRequest;
        const db = target.result;
        
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async saveRecording(recording: StoredRecording): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(recording);
      
      request.onerror = () => {
        console.error(`❌ Failed to save recording ${recording.id}:`, request.error);
        reject(request.error);
      };
      request.onsuccess = () => resolve();
    });
  }

  // Enhanced save with retry mechanism and diagnostics
  async saveRecordingWithRetry(recording: StoredRecording, maxRetries: number = 3): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.saveRecording(recording);
        if (attempt > 1) {
          console.log(`✅ Recording ${recording.id} saved successfully on attempt ${attempt}`);
        }
        return;
      } catch (error) {
        console.error(`❌ Save attempt ${attempt} failed for recording ${recording.id}:`, error);
        
        // Enhanced diagnostics
        if (error instanceof DOMException) {
          console.error(`Storage error type: ${error.name}, message: ${error.message}`);
          if (error.name === 'QuotaExceededError') {
            console.error('❌ CRITICAL: Browser storage quota exceeded');
            // Try to clean up old recordings
            await this.cleanup();
          }
        }
        
        if (attempt === maxRetries) {
          throw new Error(`Failed to save recording after ${maxRetries} attempts: ${error}`);
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  async getRecording(id: string): Promise<StoredRecording | null> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async getAllRecordings(): Promise<StoredRecording[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  async getRecordingsByStatus(status: StoredRecording['status']): Promise<StoredRecording[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('status');
      const request = index.getAll(status);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  async updateRecordingStatus(id: string, status: StoredRecording['status'], error?: string): Promise<void> {
    const recording = await this.getRecording(id);
    if (!recording) throw new Error(`Recording ${id} not found`);
    
    recording.status = status;
    if (error) recording.lastError = error;
    if (status === 'failed') recording.retryCount++;
    
    await this.saveRecording(recording);
  }

  async deleteRecording(id: string): Promise<void> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async addChunk(id: string, chunk: Blob): Promise<void> {
    try {
      const recording = await this.getRecording(id);
      if (!recording) throw new Error(`Recording ${id} not found`);
      
      // Validate chunk before saving
      if (!chunk || chunk.size === 0) {
        console.warn(`⚠️ Skipping empty chunk for recording ${id}`);
        return;
      }
      
      recording.chunks.push(chunk);
      recording.metadata.size += chunk.size;
      
      // BULLETPROOF: Save with multiple attempts and verification
      await this.saveRecordingWithRetry(recording, 3);
      
      // CRITICAL: Verify the chunk was actually saved by reading it back
      const savedRecording = await this.getRecording(id);
      if (!savedRecording || savedRecording.chunks.length !== recording.chunks.length) {
        throw new Error(`Chunk verification failed for recording ${id}`);
      }
      
      // Emergency backup to localStorage for critical recordings
      await this.saveEmergencyBackup(id, recording);
      
      // Log chunk statistics periodically for diagnostics
      if (recording.chunks.length % 5 === 0) {
        console.log(`📊 Recording ${id}: ${recording.chunks.length} chunks, ${Math.round(recording.metadata.size / 1024 / 1024 * 100) / 100}MB - VERIFIED`);
      }
    } catch (error) {
      console.error(`❌ CRITICAL: Failed to save chunk for recording ${id}:`, error);
      
      // EMERGENCY: Try to save to localStorage as last resort
      try {
        await this.emergencyChunkSave(id, chunk);
        console.log(`🆘 Emergency backup saved for chunk in recording ${id}`);
      } catch (emergencyError) {
        console.error(`💥 TOTAL FAILURE: Could not save chunk anywhere for recording ${id}:`, emergencyError);
        // Still don't throw - keep recording going
      }
    }
  }

  async finalizeRecording(id: string): Promise<void> {
    try {
      const recording = await this.getRecording(id);
      if (!recording) throw new Error(`Recording ${id} not found`);
      
      console.log(`🎯 Finalizing recording ${id}: ${recording.chunks.length} chunks, duration: ${recording.duration}s`);
      
      // Filter out empty chunks
      const validChunks = recording.chunks.filter(chunk => chunk && chunk.size > 0);
      
      if (validChunks.length === 0) {
        console.error(`❌ No valid audio chunks found for recording ${id}`);
        recording.status = 'failed';
        recording.lastError = 'No audio data captured';
        await this.saveRecording(recording);
        throw new Error(`No audio data captured for recording ${id}`);
      }
      
      // Log chunk details
      const totalSize = validChunks.reduce((total, chunk) => total + chunk.size, 0);
      console.log(`📊 Chunk details: ${validChunks.length} valid chunks, total size: ${totalSize} bytes, duration: ${recording.duration}s`);
      
      // Combine all valid chunks into final blob
      recording.audioBlob = new Blob(validChunks, { type: recording.metadata.mimeType });
      recording.status = 'completed';
      recording.chunks = validChunks; // Keep only valid chunks
      
      console.log(`✅ Final audio blob created: ${recording.audioBlob.size} bytes, type: ${recording.audioBlob.type}, duration: ${recording.duration}s`);
      
      // Critical: Save with retry mechanism
      await this.saveRecordingWithRetry(recording, 3);
    } catch (error) {
      console.error(`❌ Failed to finalize recording ${id}:`, error);
      
      // Try to save failed status
      try {
        const recording = await this.getRecording(id);
        if (recording) {
          recording.status = 'failed';
          recording.lastError = error instanceof Error ? error.message : 'Unknown error';
          await this.saveRecording(recording);
        }
      } catch (saveError) {
        console.error(`❌ Failed to save error status for recording ${id}:`, saveError);
      }
      
      throw error;
    }
  }

  // Clean up old recordings (older than 7 days)
  async cleanup(): Promise<void> {
    const allRecordings = await this.getAllRecordings();
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    for (const recording of allRecordings) {
      if (recording.timestamp < sevenDaysAgo && recording.status === 'uploaded') {
        await this.deleteRecording(recording.id);
      }
    }
  }

  // Get pending recordings for recovery
  async getPendingRecordings(): Promise<StoredRecording[]> {
    const allRecordings = await this.getAllRecordings();
    return allRecordings.filter(r => 
      r.status === 'recording' || 
      r.status === 'completed' || 
      r.status === 'processing' ||
      (r.status === 'failed' && r.chunks && r.chunks.length > 0)
    );
  }

  // Get failed recordings that cannot be recovered (no usable chunks)
  async getUnrecoverableFailedRecordings(): Promise<StoredRecording[]> {
    const allRecordings = await this.getAllRecordings();
    return allRecordings.filter(r => 
      r.status === 'failed' && 
      (!r.chunks || r.chunks.length === 0 || r.retryCount >= 3)
    );
  }

  // Delete all failed recordings that cannot be recovered
  async deleteUnrecoverableFailedRecordings(): Promise<number> {
    const unrecoverableRecordings = await this.getUnrecoverableFailedRecordings();
    let deletedCount = 0;
    
    for (const recording of unrecoverableRecordings) {
      try {
        await this.deleteRecording(recording.id);
        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete unrecoverable recording ${recording.id}:`, error);
      }
    }
    
    console.log(`✅ Deleted ${deletedCount} unrecoverable failed recordings`);
    return deletedCount;
  }
  // Check storage usage and proactively clean up if needed
  async checkStorageHealth(): Promise<{ healthy: boolean; usage?: number; message?: string }> {
    try {
      // Check if storage quota API is available
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const usagePercentage = estimate.usage && estimate.quota 
          ? (estimate.usage / estimate.quota) * 100 
          : 0;
        
        console.log(`📊 Storage usage: ${Math.round(usagePercentage)}% (${Math.round((estimate.usage || 0) / 1024 / 1024)}MB used of ${Math.round((estimate.quota || 0) / 1024 / 1024)}MB)`);
        
        if (usagePercentage > 85) {
          console.warn('⚠️ Storage usage high, triggering cleanup');
          await this.cleanup();
          return { healthy: false, usage: usagePercentage, message: 'Storage usage high - cleaned up old recordings' };
        }
        
        return { healthy: true, usage: usagePercentage };
      }
      
      // Fallback: Count recordings and clean up if too many
      const recordings = await this.getAllRecordings();
      if (recordings.length > 50) {
        console.warn('⚠️ Too many recordings stored, triggering cleanup');
        await this.cleanup();
        return { healthy: false, message: 'Too many recordings stored - cleaned up old ones' };
      }
      
      return { healthy: true };
    } catch (error) {
      console.error('Storage health check failed:', error);
      return { healthy: false, message: 'Storage health check failed' };
    }
  }

  // Recover incomplete recordings on startup
  async recoverIncompleteRecordings(): Promise<number> {
    console.log('🔄 Checking for incomplete recordings to recover...');
    
    try {
      // Check both recording and paused status for recovery
      const recordingRecordings = await this.getRecordingsByStatus('recording');
      const pausedRecordings = await this.getRecordingsByStatus('paused');
      const stuckRecordings = [...recordingRecordings, ...pausedRecordings];
      let recoveredCount = 0;
      
      for (const recording of stuckRecordings) {
        const now = Date.now();
        const recordingAge = now - recording.timestamp;
        const maxRecordingTime = 2 * 60 * 60 * 1000; // 2 hours
        
        if (recordingAge > maxRecordingTime) {
          // Recording is too old, likely abandoned
          console.log(`🕐 Recording ${recording.id} is ${Math.round(recordingAge / 1000 / 60)} minutes old - attempting recovery`);
          
          if (recording.chunks && recording.chunks.length > 0) {
            try {
              // Try to finalize the abandoned recording
              await this.finalizeRecording(recording.id);
              recoveredCount++;
              console.log(`✅ Recovered abandoned recording ${recording.id}`);
            } catch (error) {
              console.error(`Failed to recover recording ${recording.id}:`, error);
              // Mark as failed instead of leaving stuck
              recording.status = 'failed';
              recording.lastError = 'Recovery failed - recording was interrupted';
              await this.saveRecording(recording);
            }
          } else {
            // No chunks, can't recover
            console.log(`❌ Recording ${recording.id} has no chunks - marking as failed`);
            recording.status = 'failed';
            recording.lastError = 'No audio data captured';
            await this.saveRecording(recording);
          }
        }
      }
      
      console.log(`🔄 Recovery complete: ${recoveredCount} recordings recovered`);
      return recoveredCount;
    } catch (error) {
      console.error('Recording recovery failed:', error);
      return 0;
    }
  }

  // Enhanced emergency backup system using localStorage with compression
  async saveEmergencyBackup(id: string, recording: StoredRecording): Promise<void> {
    try {
      // Enhanced backup with more comprehensive metadata
      const backup = {
        id: recording.id,
        timestamp: recording.timestamp,
        duration: recording.duration,
        chunkCount: recording.chunks.length,
        status: recording.status,
        metadata: recording.metadata,
        lastBackup: Date.now(),
        totalSize: recording.chunks.reduce((total, chunk) => total + chunk.size, 0),
        deviceInfo: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          online: navigator.onLine,
          pageVisible: !document.hidden
        }
      };
      
      // Compress backup data for storage efficiency
      const backupString = JSON.stringify(backup);
      const compressedBackup = btoa(backupString); // Base64 encoding for basic compression
      
      localStorage.setItem(`recording_backup_${id}`, compressedBackup);
      
      // Keep a list of all backup IDs for easier cleanup
      const backupList = JSON.parse(localStorage.getItem('recording_backup_list') || '[]');
      if (!backupList.includes(id)) {
        backupList.push(id);
        localStorage.setItem('recording_backup_list', JSON.stringify(backupList));
      }
      
      // Auto-cleanup old backups (keep only last 10)
      if (backupList.length > 10) {
        const oldBackupId = backupList.shift();
        localStorage.removeItem(`recording_backup_${oldBackupId}`);
        localStorage.removeItem(`emergency_chunks_${oldBackupId}`);
        localStorage.setItem('recording_backup_list', JSON.stringify(backupList));
      }
      
      console.log(`💾 Enhanced emergency backup saved for ${id}: ${Math.round(backupString.length / 1024)}KB`);
    } catch (error) {
      console.warn('Failed to create enhanced emergency backup:', error);
      // Fallback to simple backup
      try {
        const simpleBackup = { id, timestamp: recording.timestamp, status: recording.status };
        localStorage.setItem(`simple_backup_${id}`, JSON.stringify(simpleBackup));
      } catch (fallbackError) {
        console.error('Even simple backup failed:', fallbackError);
      }
    }
  }

  // Emergency chunk saving to localStorage with compression
  async emergencyChunkSave(id: string, chunk: Blob): Promise<void> {
    try {
      const key = `emergency_chunk_${id}_${Date.now()}`;
      const reader = new FileReader();
      
      return new Promise((resolve, reject) => {
        reader.onload = () => {
          try {
            const base64 = (reader.result as string).split(',')[1];
            localStorage.setItem(key, base64);
            
            // Track emergency chunks
            const emergencyList = JSON.parse(localStorage.getItem(`emergency_chunks_${id}`) || '[]');
            emergencyList.push({ key, timestamp: Date.now(), size: chunk.size });
            localStorage.setItem(`emergency_chunks_${id}`, JSON.stringify(emergencyList));
            
            resolve();
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(chunk);
      });
    } catch (error) {
      throw new Error(`Emergency chunk save failed: ${error}`);
    }
  }

  // Recover recordings from emergency backups
  async recoverFromEmergencyBackups(): Promise<number> {
    console.log('🆘 Checking emergency backups...');
    let recoveredCount = 0;
    
    try {
      // Find all emergency backups
      const backupKeys = Object.keys(localStorage).filter(key => key.startsWith('recording_backup_'));
      
      for (const backupKey of backupKeys) {
        try {
          let backupData = localStorage.getItem(backupKey) || '{}';
          
          // Try to decompress if it's a compressed backup
          try {
            if (backupData.length > 100 && !backupData.startsWith('{')) {
              backupData = atob(backupData); // Decode base64
            }
          } catch (decompressError) {
            console.warn('Backup decompression failed, using raw data');
          }
          
          const backup = JSON.parse(backupData);
          const recordingId = backup.id;
          
          // Check if recording exists in IndexedDB
          const existingRecording = await this.getRecording(recordingId);
          
          if (!existingRecording && backup.chunkCount > 0) {
            console.log(`🔄 Attempting to recover recording ${recordingId} from emergency backup`);
            
            // Try to rebuild from emergency chunks
            const emergencyChunks = JSON.parse(localStorage.getItem(`emergency_chunks_${recordingId}`) || '[]');
            
            if (emergencyChunks.length > 0) {
              const chunks: Blob[] = [];
              
              for (const chunkInfo of emergencyChunks) {
                try {
                  const base64 = localStorage.getItem(chunkInfo.key);
                  if (base64) {
                    const blob = await this.base64ToBlob(base64, backup.metadata?.mimeType || 'audio/webm');
                    chunks.push(blob);
                  }
                } catch (error) {
                  console.warn(`Failed to recover chunk ${chunkInfo.key}:`, error);
                }
              }
              
              if (chunks.length > 0) {
                // Recreate recording
                const recoveredRecording: StoredRecording = {
                  id: recordingId,
                  audioBlob: new Blob(chunks, { type: backup.metadata?.mimeType || 'audio/webm' }),
                  duration: backup.duration || 0,
                  timestamp: backup.timestamp,
                  status: 'completed',
                  chunks: chunks,
                  metadata: backup.metadata || { size: 0, mimeType: 'audio/webm' },
                  retryCount: 0
                };
                
                await this.saveRecordingWithRetry(recoveredRecording, 3);
                recoveredCount++;
                console.log(`✅ Successfully recovered recording ${recordingId} from emergency backup`);
                
                // Clean up emergency data
                localStorage.removeItem(backupKey);
                localStorage.removeItem(`emergency_chunks_${recordingId}`);
                for (const chunkInfo of emergencyChunks) {
                  localStorage.removeItem(chunkInfo.key);
                }
              }
            }
          }
        } catch (error) {
          console.error(`Failed to process emergency backup ${backupKey}:`, error);
        }
      }
      
      console.log(`🆘 Emergency recovery complete: ${recoveredCount} recordings recovered`);
      return recoveredCount;
    } catch (error) {
      console.error('Emergency recovery failed:', error);
      return 0;
    }
  }

  // Helper to convert base64 back to blob
  private async base64ToBlob(base64: string, mimeType: string): Promise<Blob> {
    const response = await fetch(`data:${mimeType};base64,${base64}`);
    return response.blob();
  }
}

export const recordingStorage = new RecordingStorageManager();
export type { StoredRecording };