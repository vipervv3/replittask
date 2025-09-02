// Upload queue system for reliable processing of recordings
import { recordingStorage, type StoredRecording } from './recordingStorage';
import { apiRequest } from './queryClient';

interface UploadProgress {
  recordingId: string;
  progress: number;
  status: 'queued' | 'uploading' | 'processing' | 'completed' | 'failed';
  error?: string;
}

class UploadQueueManager {
  private queue: string[] = [];
  private activeUploads = new Set<string>();
  private maxConcurrentUploads = 2;
  private progressCallbacks = new Map<string, (progress: UploadProgress) => void>();
  private retryDelays = [1000, 5000, 15000, 60000]; // Progressive retry delays

  async addToQueue(recordingId: string, progressCallback?: (progress: UploadProgress) => void): Promise<void> {
    // Check if recording exists and hasn't been uploaded already
    const recording = await recordingStorage.getRecording(recordingId);
    if (!recording) {
      console.log(`Recording ${recordingId} not found, skipping queue addition`);
      return;
    }
    
    if (recording.status === 'uploaded') {
      console.log(`Recording ${recordingId} already uploaded, skipping duplicate processing`);
      return;
    }
    
    if (progressCallback) {
      this.progressCallbacks.set(recordingId, progressCallback);
    }
    
    if (!this.queue.includes(recordingId) && !this.activeUploads.has(recordingId)) {
      this.queue.push(recordingId);
      this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    while (this.queue.length > 0 && this.activeUploads.size < this.maxConcurrentUploads) {
      const recordingId = this.queue.shift()!;
      this.activeUploads.add(recordingId);
      
      try {
        await this.uploadRecording(recordingId);
      } catch (error) {
        console.error(`Upload failed for recording ${recordingId}:`, error);
      } finally {
        this.activeUploads.delete(recordingId);
        this.processQueue(); // Continue processing queue
      }
    }
  }

  private async uploadRecording(recordingId: string): Promise<void> {
    const recording = await recordingStorage.getRecording(recordingId);
    if (!recording) throw new Error(`Recording ${recordingId} not found`);

    const progressCallback = this.progressCallbacks.get(recordingId);
    
    try {
      await recordingStorage.updateRecordingStatus(recordingId, 'processing');
      progressCallback?.({ recordingId, progress: 0, status: 'uploading' });

      // Enhanced validation - try to recover even if audioBlob is missing
      if (!recording.audioBlob || recording.audioBlob.size === 0) {
        // Try to recover from chunks if available
        if (recording.chunks && recording.chunks.length > 0) {
          console.log(`🔄 Recovering audio blob from ${recording.chunks.length} chunks`);
          const validChunks = recording.chunks.filter(chunk => chunk && chunk.size > 0);
          if (validChunks.length > 0) {
            recording.audioBlob = new Blob(validChunks, { type: recording.metadata.mimeType });
            await recordingStorage.saveRecording(recording);
            console.log(`✅ Recovered audio blob: ${recording.audioBlob.size} bytes`);
          } else {
            throw new Error('No valid audio chunks found for recovery');
          }
        } else {
          throw new Error('Recording audio blob is empty and no chunks available');
        }
      }

      console.log(`Converting audio blob: ${recording.audioBlob.size} bytes, type: ${recording.audioBlob.type}`);
      
      // Convert to base64 in chunks to avoid memory issues
      const base64Audio = await this.blobToBase64(recording.audioBlob);
      
      // Validate base64 conversion
      if (!base64Audio || !base64Audio.includes(',')) {
        throw new Error('Failed to convert audio to base64 format');
      }
      
      const base64Data = base64Audio.split(',')[1];
      if (!base64Data || base64Data.length === 0) {
        throw new Error('Base64 audio data is empty after split');
      }
      
      console.log(`Base64 conversion successful: ${base64Data.length} characters`);
      progressCallback?.({ recordingId, progress: 25, status: 'uploading' });

      // Create meeting record with accurate duration and unique identifier
      const durationInSeconds = recording.duration;
      const durationInMinutes = Math.max(1, Math.round(durationInSeconds / 60));
      
      // Use recording ID as unique identifier to prevent duplicates
      const uniqueTitle = recording.metadata.title || `Voice Recording ${new Date(recording.timestamp).toLocaleString()}`;
      const meetingDescription = `AI-processed voice recording (ID: ${recordingId})`;
      
      // Make API request with error handling for auth issues
      const meetingResponse = await apiRequest("POST", "/api/meetings", {
        title: uniqueTitle,
        description: meetingDescription, 
        scheduledAt: new Date(recording.timestamp).toISOString(), // Send as ISO string
        duration: durationInMinutes, // Convert to whole minutes, minimum 1
        projectId: recording.metadata.projectId || null,
        recordingId: recordingId, // Include recording ID for duplicate checking
      });
      
      const meeting = await meetingResponse.json();
      progressCallback?.({ recordingId, progress: 50, status: 'processing' });

      console.log(`Uploading audio data for meeting ${meeting.id}: ${base64Data.length} characters`);
      
      // Process recording with enhanced error handling
      const processResponse = await apiRequest("POST", `/api/meetings/${meeting.id}/process-recording`, {
        audioData: base64Data,
        projectId: recording.metadata.projectId || null,
      });

      progressCallback?.({ recordingId, progress: 100, status: 'completed' });
      await recordingStorage.updateRecordingStatus(recordingId, 'uploaded');
      
      // Successfully processed - remove from local storage so it won't show in recovery
      console.log(`✅ Recording ${recordingId} successfully processed, removing from local storage`);
      await recordingStorage.deleteRecording(recordingId);
      
      // Also remove from any queues to prevent re-processing
      const index = this.queue.indexOf(recordingId);
      if (index > -1) {
        this.queue.splice(index, 1);
      }
      this.activeUploads.delete(recordingId);
      
      // Clean up progress callback
      this.progressCallbacks.delete(recordingId);
      
      return processResponse.json();
    } catch (error: any) {
      // Don't redirect to login for background recording processing
      const errorMessage = error?.message || 'Upload failed';
      
      // If it's an auth error during background processing, just log it
      if (error?.message?.includes('Session expired') || error?.message?.includes('401')) {
        console.log(`Authentication expired during background recording processing for ${recordingId}`);
        await recordingStorage.updateRecordingStatus(recordingId, 'failed', 'Authentication expired - please manually retry when logged in');
      } else {
        await recordingStorage.updateRecordingStatus(recordingId, 'failed', errorMessage);
      }
      
      progressCallback?.({ recordingId, progress: 0, status: 'failed', error: errorMessage });
      
      // Schedule retry if under retry limit
      if (recording.retryCount < this.retryDelays.length) {
        const delay = this.retryDelays[recording.retryCount];
        setTimeout(() => {
          this.addToQueue(recordingId, progressCallback);
        }, delay);
      }
      
      throw error;
    }
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async retryFailed(): Promise<void> {
    // Get both failed recordings AND stuck recordings in 'recording' status
    const failedRecordings = await recordingStorage.getRecordingsByStatus('failed');
    const stuckRecordings = await recordingStorage.getRecordingsByStatus('recording');
    
    // Process failed recordings
    for (const recording of failedRecordings) {
      if (recording.retryCount < this.retryDelays.length) {
        await this.addToQueue(recording.id);
      }
    }
    
    // Process stuck recordings - these need to be finalized first then uploaded
    for (const recording of stuckRecordings) {
      if (recording.chunks && recording.chunks.length > 0) {
        console.log(`🔄 Processing stuck recording ${recording.id} with ${recording.chunks.length} chunks`);
        
        // Try to finalize the stuck recording
        try {
          await recordingStorage.finalizeRecording(recording.id);
          await this.addToQueue(recording.id);
        } catch (error) {
          console.error(`Failed to finalize stuck recording ${recording.id}:`, error);
          await recordingStorage.updateRecordingStatus(recording.id, 'failed', `Finalization failed: ${error}`);
        }
      } else {
        // No chunks available, mark as failed
        await recordingStorage.updateRecordingStatus(recording.id, 'failed', 'No audio chunks available');
      }
    }
  }

  async getQueueStatus(): Promise<{ 
    queued: number; 
    uploading: number; 
    failed: number; 
    unrecoverable: number;
  }> {
    const failedRecordings = await recordingStorage.getRecordingsByStatus('failed');
    const unrecoverableRecordings = await recordingStorage.getUnrecoverableFailedRecordings();
    
    return {
      queued: this.queue.length,
      uploading: this.activeUploads.size,
      failed: failedRecordings.length,
      unrecoverable: unrecoverableRecordings.length,
    };
  }

  // Delete all failed recordings that cannot be recovered
  async deleteUnrecoverableFailedRecordings(): Promise<number> {
    return await recordingStorage.deleteUnrecoverableFailedRecordings();
  }

  // Initialize queue processing on startup
  async init(): Promise<void> {
    // Process any pending uploads from previous session
    const completedRecordings = await recordingStorage.getRecordingsByStatus('completed');
    const processingRecordings = await recordingStorage.getRecordingsByStatus('processing');
    
    // Add completed but not uploaded recordings to queue
    for (const recording of [...completedRecordings, ...processingRecordings]) {
      await this.addToQueue(recording.id);
    }
    
    // Clean up old recordings
    await recordingStorage.cleanup();
  }
}

export const uploadQueue = new UploadQueueManager();
export type { UploadProgress };