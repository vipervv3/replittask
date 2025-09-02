import { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { recordingStorage, type StoredRecording } from "@/lib/recordingStorage";
import { uploadQueue, type UploadProgress } from "@/lib/uploadQueue";

interface VoiceRecordingContextType {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  hasRecording: boolean;
  isProcessing: boolean;
  uploadProgress: number;
  currentRecordingId: string | null;
  queueStatus: { queued: number; uploading: number; failed: number; unrecoverable: number };
  audioStream: MediaStream | null;
  recordingQuality: 'excellent' | 'good' | 'poor' | 'none';
  startRecording: (projectId?: string, title?: string) => Promise<void>;
  stopRecording: () => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  processCurrentRecording: () => Promise<void>;
  retryFailedUploads: () => Promise<void>;
  getPendingRecordings: () => Promise<StoredRecording[]>;
  deleteUnrecoverableFailedRecordings: () => Promise<number>;
}

export const VoiceRecordingContext = createContext<VoiceRecordingContextType | null>(null);

export function VoiceRecordingProvider({ children }: { children: ReactNode }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [hasRecording, setHasRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentRecordingId, setCurrentRecordingId] = useState<string | null>(null);
  const [queueStatus, setQueueStatus] = useState({ queued: 0, uploading: 0, failed: 0, unrecoverable: 0 });
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [recordingQuality, setRecordingQuality] = useState<'excellent' | 'good' | 'poor' | 'none'>('none');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentProjectIdRef = useRef<string | undefined>(undefined);
  const currentTitleRef = useRef<string | undefined>(undefined);
  const qualityCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const connectionStatusRef = useRef<boolean>(navigator.onLine);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Initialize storage and queue on mount
  useEffect(() => {
    const initializeSystem = async () => {
      try {
        await recordingStorage.init();
        
        // Check storage health and recover incomplete recordings
        const healthCheck = await recordingStorage.checkStorageHealth();
        if (!healthCheck.healthy && healthCheck.message) {
          console.log(`📊 Storage health: ${healthCheck.message}`);
        }
        
        const recoveredCount = await recordingStorage.recoverIncompleteRecordings();
        const emergencyRecoveredCount = await recordingStorage.recoverFromEmergencyBackups();
        
        const totalRecovered = recoveredCount + emergencyRecoveredCount;
        if (totalRecovered > 0) {
          toast({
            title: "Recordings Recovered",
            description: `Recovered ${totalRecovered} interrupted recording${totalRecovered > 1 ? 's' : ''} from your last session.`,
            duration: 5000,
          });
        }
        
        await uploadQueue.init();
        updateQueueStatus();
      } catch (error) {
        console.error('Failed to initialize recording system:', error);
      }
    };
    
    initializeSystem();
    
    // Update queue status periodically
    const interval = setInterval(updateQueueStatus, 5000);
    
    // Enhanced device and connection monitoring
    const setupDeviceMonitoring = () => {
      // Page Visibility API - handle screen timeouts and app backgrounding
      const handleVisibilityChange = () => {
        if (document.hidden) {
          console.log('📱 App went to background - recording continues with enhanced backup');
          // Immediately backup current recording state when going to background
          if (currentRecordingId && isRecording) {
            recordingStorage.getRecording(currentRecordingId).then(recording => {
              if (recording) {
                recordingStorage.saveEmergencyBackup(currentRecordingId!, recording);
              }
            }).catch(console.error);
          }
        } else {
          console.log('📱 App returned to foreground - checking recording integrity');
          // Verify recording is still active when returning to foreground
          if (currentRecordingId && isRecording) {
            recordingStorage.getRecording(currentRecordingId).then(recording => {
              if (!recording || recording.status !== 'recording') {
                console.warn('⚠️ Recording may have been interrupted - attempting recovery');
                toast({
                  title: "Recording Status Check",
                  description: "Verifying your recording is still active...",
                  duration: 3000,
                });
              }
            }).catch(console.error);
          }
        }
      };
      
      // Connection monitoring - auto-retry uploads when network returns
      const handleOnline = () => {
        console.log('🌐 Network connection restored - retrying failed uploads');
        connectionStatusRef.current = true;
        uploadQueue.retryFailed().catch(console.error);
        toast({
          title: "Connection Restored",
          description: "Retrying any failed uploads automatically.",
          duration: 3000,
        });
      };
      
      const handleOffline = () => {
        console.log('📡 Network connection lost - recordings will continue locally');
        connectionStatusRef.current = false;
        toast({
          title: "Offline Mode",
          description: "Recording continues. Uploads will resume when connection returns.",
          duration: 4000,
        });
      };
      
      // Prevent accidental page closure during recording
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        if (isRecording) {
          e.preventDefault();
          e.returnValue = 'You have an active recording. Are you sure you want to leave?';
          
          // Force save current recording state before potential page closure
          if (currentRecordingId) {
            recordingStorage.getRecording(currentRecordingId).then(recording => {
              if (recording) {
                recording.status = 'interrupted';
                recordingStorage.saveRecording(recording);
                recordingStorage.saveEmergencyBackup(currentRecordingId!, recording);
              }
            }).catch(console.error);
          }
        }
      };
      
      // Add event listeners
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      window.addEventListener('beforeunload', handleBeforeUnload);
      
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    };
    
    const cleanupMonitoring = setupDeviceMonitoring();
    
    return () => {
      clearInterval(interval);
      cleanupMonitoring();
    };
  }, []);
  
  const updateQueueStatus = useCallback(async () => {
    try {
      const status = await uploadQueue.getQueueStatus();
      setQueueStatus(status);
    } catch (error) {
      console.error('Failed to update queue status:', error);
    }
  }, []);

  // Quality monitoring for audio levels and recording health
  const startQualityMonitoring = useCallback((stream: MediaStream) => {
    try {
      // Create a separate AudioContext that doesn't interfere with MediaRecorder
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      
      // IMPORTANT: Don't connect to destination to avoid feedback
      source.connect(analyser);
      analyser.fftSize = 128; // Smaller buffer for better performance
      analyser.smoothingTimeConstant = 0.3;
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      qualityCheckIntervalRef.current = setInterval(() => {
        try {
          analyser.getByteFrequencyData(dataArray);
          
          // Calculate average audio level
          const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
          const normalizedLevel = average / 255;
          
          // Update quality based on audio level - more lenient thresholds
          if (normalizedLevel < 0.02) {
            setRecordingQuality('poor'); // Very low audio
          } else if (normalizedLevel < 0.1) {
            setRecordingQuality('good'); // Decent audio
          } else {
            setRecordingQuality('excellent'); // Good audio
          }
        } catch (error) {
          console.warn('Quality check iteration failed:', error);
        }
      }, 2000); // Check every 2 seconds to reduce CPU usage
      
    } catch (error) {
      console.warn('Audio quality monitoring initialization failed:', error);
      setRecordingQuality('good'); // Default to good if monitoring fails
    }
  }, []);

  // Wake lock reference
  const wakeLockRef = useRef<any>(null);
  
  // Auto-save mechanism for long recordings
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const networkStatusRef = useRef<boolean>(navigator.onLine);
  const pageVisibilityRef = useRef<boolean>(!document.hidden);

  const startRecording = useCallback(async (projectId?: string, title?: string) => {
    currentProjectIdRef.current = projectId;
    currentTitleRef.current = title;
    
    try {
      // Request wake lock to prevent screen from turning off during recording
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          console.log('✅ Wake lock acquired - screen will stay on during recording');
          
          // Handle wake lock release on visibility change
          wakeLockRef.current.addEventListener('release', () => {
            console.log('Wake lock was released');
          });
        }
      } catch (wakeLockError) {
        console.warn('Wake lock not supported or failed:', wakeLockError);
        // Show toast to user about potential screen sleep issue
        toast({
          title: "Mobile Recording Tip",
          description: "Keep your screen on during long recordings to prevent interruption. Consider plugging in your phone.",
          duration: 6000,
        });
      }

      // Enhanced audio constraints for long recordings and mobile compatibility
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000, // Lower sample rate for smaller files
          channelCount: 1,   // Mono for smaller files
        } 
      });
      
      // Enhanced browser compatibility and compression for long recordings
      let mimeType = 'audio/webm;codecs=opus';
      
      // Fallback mime types for browser compatibility
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          mimeType = 'audio/ogg;codecs=opus';
        } else {
          mimeType = ''; // Let browser choose
        }
      }
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 64000, // Lower bitrate for longer recordings
      });
      
      // Create recording record in IndexedDB
      const recordingId = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const recording: StoredRecording = {
        id: recordingId,
        audioBlob: new Blob(), // Will be set when recording completes
        duration: 0,
        timestamp: Date.now(),
        status: 'recording',
        chunks: [],
        metadata: {
          projectId,
          title: title || `Voice Recording ${new Date().toLocaleString()}`,
          size: 0,
          mimeType,
        },
        retryCount: 0,
      };
      
      await recordingStorage.saveRecording(recording);
      setCurrentRecordingId(recordingId);
      
      // Start heartbeat system to save recording state every 10 seconds
      heartbeatIntervalRef.current = setInterval(async () => {
        try {
          const recording = await recordingStorage.getRecording(recordingId);
          if (recording && (recording.status === 'recording' || recording.status === 'paused')) {
            // Update with current duration and pause state - save emergency backup
            recording.duration = recordingTime;
            recording.metadata.lastHeartbeat = Date.now();
            // Save pause state in metadata for recovery
            recording.metadata.isPaused = isPaused;
            await recordingStorage.saveRecording(recording);
            await recordingStorage.saveEmergencyBackup(recordingId, recording);
            const status = isPaused ? 'PAUSED' : 'recording';
            console.log(`💓 Heartbeat: Recording ${recordingId} state saved (${recordingTime}s, ${recording.chunks.length} chunks, ${status})`);
          }
        } catch (error) {
          console.error('Heartbeat failed:', error);
        }
      }, 10000); // Every 10 seconds
      
      mediaRecorder.ondataavailable = async (event) => {
        console.log(`📥 Audio chunk received: ${event.data.size} bytes, type: ${event.data.type}`);
        if (event.data.size > 0) {
          // Save chunk immediately to IndexedDB using the correct recordingId
          try {
            await recordingStorage.addChunk(recordingId, event.data);
            console.log(`✅ Chunk saved to IndexedDB: ${event.data.size} bytes`);
            
            // Update recording metadata with current size and duration
            const recording = await recordingStorage.getRecording(recordingId);
            if (recording) {
              recording.metadata.size = recording.chunks.reduce((total, chunk) => total + chunk.size, 0);
              recording.duration = recordingTime;
              await recordingStorage.saveRecording(recording);
            }
          } catch (error) {
            console.error('❌ Failed to save recording chunk:', error);
            
            // CRITICAL: If chunk saving fails repeatedly, warn the user
            const recording = await recordingStorage.getRecording(recordingId);
            if (recording && recording.chunks.length === 0) {
              toast({
                title: "Recording Warning",
                description: "Having trouble saving your recording. Please ensure you have sufficient storage space.",
                variant: "destructive",
                duration: 5000,
              });
            }
          }
        } else if (event.data.size === 0) {
          console.warn('⚠️ Received empty audio chunk');
        }
      };
      
      mediaRecorder.onstop = async () => {
        try {
          // Stop heartbeat when recording ends
          if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = null;
          }
          
          // Calculate duration from actual timestamps instead of relying on timer state
          const recording = await recordingStorage.getRecording(recordingId);
          if (recording) {
            const actualDuration = Math.round((Date.now() - recording.timestamp) / 1000);
            recording.duration = actualDuration;
            await recordingStorage.saveRecording(recording);
          }
          
          // CRITICAL: Give a moment for final chunks to be processed
          await new Promise(resolve => setTimeout(resolve, 500));
          
          await recordingStorage.finalizeRecording(recordingId);
          setHasRecording(true);
          
          console.log(`Recording completed and saved: ${recordingId}`);
          
          // Automatically add to upload queue
          console.log(`📤 Adding recording ${recordingId} to upload queue`);
          await uploadQueue.addToQueue(recordingId, (progress) => {
            console.log(`📊 Upload progress: ${progress.progress}% - ${progress.status}`);
            if (progress.error) {
              console.error(`❌ Upload error: ${progress.error}`);
            }
          });
          
          toast({
            title: "Recording Completed",
            description: "Your recording has been saved securely and will be processed automatically.",
            duration: 3000,
          });
        } catch (error) {
          console.error('Failed to finalize recording:', error);
          
          // Enhanced error handling - try to recover what we can
          let errorMessage = "There was an issue saving your recording.";
          let canRecover = false;
          
          try {
            const recording = await recordingStorage.getRecording(recordingId);
            if (recording && recording.chunks && recording.chunks.length > 0) {
              console.log(`🔄 Attempting to recover recording ${recordingId} with ${recording.chunks.length} chunks`);
              
              // ENHANCED: Try manual finalization with more aggressive recovery
              const validChunks = recording.chunks.filter(chunk => chunk && chunk.size > 0);
              if (validChunks.length > 0) {
                recording.audioBlob = new Blob(validChunks, { type: recording.metadata.mimeType });
                recording.status = 'completed';
                await recordingStorage.saveRecording(recording);
              }
              
              // Try to add to queue even with failed finalization - the upload queue can handle partial recordings
              await uploadQueue.addToQueue(recordingId);
              canRecover = true;
              errorMessage = "Recording saved with issues but will attempt automatic processing.";
            } else {
              // Log detailed diagnostic information
              console.error(`❌ CRITICAL: Recording ${recordingId} has no recoverable chunks`);
              console.error('Recording state:', recording);
              console.error('Error details:', error);
            }
          } catch (recoveryError) {
            console.error('Failed to recover recording:', recoveryError);
          }
          
          toast({
            title: "Recording Save Warning",
            description: canRecover 
              ? "Recording saved but may need processing. Check the Meetings page to verify."
              : "Recording could not be saved. Please try recording again.",
            variant: canRecover ? "default" : "destructive",
            duration: 5000,
          });
        }
        
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
        setAudioStream(null);
        setRecordingQuality('none');
        
        // Stop quality monitoring
        if (qualityCheckIntervalRef.current) {
          clearInterval(qualityCheckIntervalRef.current);
          qualityCheckIntervalRef.current = null;
        }
        
        // Stop auto-save interval
        if (autoSaveIntervalRef.current) {
          clearInterval(autoSaveIntervalRef.current);
          autoSaveIntervalRef.current = null;
        }
        
        // Release wake lock when recording stops
        if (wakeLockRef.current) {
          wakeLockRef.current.release();
          wakeLockRef.current = null;
          console.log('Wake lock released - screen can sleep again');
        }
      };
      
      mediaRecorderRef.current = mediaRecorder;
      console.log(`🎙️ Starting MediaRecorder with ${mimeType}, 5-second chunks`);
      mediaRecorder.start(5000); // Record in 5-second chunks for better handling of long recordings
      
      // Auto-save mechanism - save progress every 30 seconds during long recordings
      autoSaveIntervalRef.current = setInterval(async () => {
        try {
          const recording = await recordingStorage.getRecording(recordingId);
          if (recording && recording.status === 'recording') {
            recording.duration = recordingTime;
            recording.metadata.size = recording.chunks.reduce((total, chunk) => total + chunk.size, 0);
            await recordingStorage.saveRecordingWithRetry(recording, 2);
            console.log(`🔄 Auto-saved recording progress: ${recording.duration}s, ${recording.chunks.length} chunks`);
          }
        } catch (error) {
          console.error('Auto-save failed:', error);
        }
      }, 30000); // Every 30 seconds
      
      setIsRecording(true);
      setRecordingTime(0);
      setAudioStream(stream);
      setRecordingQuality('good'); // Start with good, will be updated by quality monitoring
      
      // Start timer
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          // Auto-stop at 2 hours (7200 seconds)
          if (newTime >= 7200) {
            stopRecording();
            return 7200;
          }
          return newTime;
        });
      }, 1000);
      
      // Start quality monitoring
      startQualityMonitoring(stream);
      
    } catch (error) {
      console.error("Failed to start recording:", error);
      toast({
        title: "Recording Failed",
        description: "Could not access microphone. Please check your permissions.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const stopRecording = useCallback(async () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      // Update recording duration in storage immediately when stopping
      if (currentRecordingId) {
        try {
          const recording = await recordingStorage.getRecording(currentRecordingId);
          if (recording) {
            const actualDuration = Math.round((Date.now() - recording.timestamp) / 1000);
            recording.duration = actualDuration;
            await recordingStorage.saveRecording(recording);
          }
        } catch (error) {
          console.warn('Failed to update recording duration:', error);
        }
      }
      
      // Stop quality monitoring
      if (qualityCheckIntervalRef.current) {
        clearInterval(qualityCheckIntervalRef.current);
        qualityCheckIntervalRef.current = null;
      }
      
      // Stop auto-save interval
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
        autoSaveIntervalRef.current = null;
      }
      
      // Reset audio state
      setAudioStream(null);
      setRecordingQuality('none');
      
      // Release wake lock when stopping recording manually
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
        console.log('Wake lock released - screen can sleep again');
      }
    }
  }, [isRecording, recordingTime, currentRecordingId]);

  // Clean up wake lock on component unmount or when recording context is destroyed
  useEffect(() => {
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
        console.log('Wake lock cleaned up on unmount');
      }
      
      // Clean up intervals
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current);
        autoSaveIntervalRef.current = null;
      }
      
      if (qualityCheckIntervalRef.current) {
        clearInterval(qualityCheckIntervalRef.current);
        qualityCheckIntervalRef.current = null;
      }
    };
  }, []);

  // Page visibility monitoring - crucial for mobile recordings
  useEffect(() => {
    const handleVisibilityChange = async () => {
      const isHidden = document.hidden;
      pageVisibilityRef.current = !isHidden;
      
      if (isRecording) {
        if (isHidden) {
          console.log('🔄 Page hidden during recording - ensuring background recording continues');
          
          // Force save current recording state when page becomes hidden
          if (currentRecordingId) {
            try {
              const recording = await recordingStorage.getRecording(currentRecordingId);
              if (recording) {
                recording.duration = recordingTime;
                recording.metadata.size = recording.chunks.reduce((total, chunk) => total + chunk.size, 0);
                await recordingStorage.saveRecordingWithRetry(recording, 3);
                console.log('✅ Recording state saved due to page visibility change');
              }
            } catch (error) {
              console.error('Failed to save recording state on visibility change:', error);
            }
          }
          
          // Show user notification about background recording
          toast({
            title: "Recording Continues",
            description: "Your recording is safely continuing in the background. Keep this tab open.",
            duration: 3000,
          });
        } else {
          console.log('📱 Page visible again - recording still active');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isRecording, currentRecordingId, recordingTime, toast]);

  // Network connectivity monitoring
  useEffect(() => {
    const handleOnline = () => {
      networkStatusRef.current = true;
      console.log('🌐 Network connection restored');
      
      // If we have recordings to upload, restart the queue
      uploadQueue.getQueueStatus().then(status => {
        if (status.failed > 0) {
          console.log(`🔄 Retrying ${status.failed} failed uploads after network restoration`);
          uploadQueue.retryFailed();
        }
      });
    };

    const handleOffline = () => {
      networkStatusRef.current = false;
      console.log('📶 Network connection lost - recordings will be saved locally');
      
      if (isRecording) {
        toast({
          title: "Network Lost",
          description: "Recording continues locally. Will upload when connection returns.",
          duration: 4000,
        });
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isRecording, toast]);

  // Browser unload protection - critical for saving recordings before page closes
  useEffect(() => {
    const handleBeforeUnload = async (event: BeforeUnloadEvent) => {
      if (isRecording && currentRecordingId) {
        // Force immediate save of current recording state
        try {
          const recording = await recordingStorage.getRecording(currentRecordingId);
          if (recording) {
            recording.duration = recordingTime;
            recording.metadata.size = recording.chunks.reduce((total, chunk) => total + chunk.size, 0);
            await recordingStorage.saveRecordingWithRetry(recording, 2);
            await recordingStorage.saveEmergencyBackup(currentRecordingId, recording);
            console.log('🛡️ Recording state saved before page unload');
          }
        } catch (error) {
          console.error('Failed to save recording before unload:', error);
        }
        
        // Show browser warning
        event.preventDefault();
        event.returnValue = 'You have an active recording. Are you sure you want to leave?';
        return 'You have an active recording. Are you sure you want to leave?';
      }
    };

    const handlePageHide = async () => {
      if (isRecording && currentRecordingId) {
        // Force save on page hide (mobile browsers)
        try {
          const recording = await recordingStorage.getRecording(currentRecordingId);
          if (recording) {
            recording.duration = recordingTime;
            await recordingStorage.saveRecordingWithRetry(recording, 1);
            await recordingStorage.saveEmergencyBackup(currentRecordingId, recording);
            console.log('🛡️ Recording saved on page hide');
          }
        } catch (error) {
          console.error('Failed to save recording on page hide:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [isRecording, currentRecordingId, recordingTime]);

  const pauseRecording = useCallback(async () => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      // Immediately save pause state to protect against data loss
      if (currentRecordingId) {
        try {
          const recording = await recordingStorage.getRecording(currentRecordingId);
          if (recording) {
            recording.status = 'paused';
            recording.duration = recordingTime;
            recording.metadata.isPaused = true;
            recording.metadata.lastHeartbeat = Date.now();
            await recordingStorage.saveRecording(recording);
            await recordingStorage.saveEmergencyBackup(currentRecordingId, recording);
            console.log('⏸️ Recording paused and state saved immediately');
          }
        } catch (error) {
          console.error('Failed to save pause state:', error);
        }
      }
    }
  }, [isRecording, isPaused, currentRecordingId, recordingTime]);

  const resumeRecording = useCallback(async () => {
    if (mediaRecorderRef.current && isRecording && isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      
      // Resume timer
      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          // Auto-stop at 2 hours (7200 seconds)
          if (newTime >= 7200) {
            stopRecording();
            return 7200;
          }
          return newTime;
        });
      }, 1000);
      
      // Immediately save resume state to protect against data loss
      if (currentRecordingId) {
        try {
          const recording = await recordingStorage.getRecording(currentRecordingId);
          if (recording) {
            recording.status = 'recording';
            recording.duration = recordingTime;
            recording.metadata.isPaused = false;
            recording.metadata.lastHeartbeat = Date.now();
            await recordingStorage.saveRecording(recording);
            await recordingStorage.saveEmergencyBackup(currentRecordingId, recording);
            console.log('▶️ Recording resumed and state saved immediately');
          }
        } catch (error) {
          console.error('Failed to save resume state:', error);
        }
      }
    }
  }, [isRecording, isPaused, stopRecording, currentRecordingId, recordingTime]);

  const processCurrentRecording = useCallback(async () => {
    if (!currentRecordingId) {
      toast({
        title: "No Recording Found",
        description: "Please record audio before processing.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      const progressCallback = (progress: UploadProgress) => {
        setUploadProgress(progress.progress);
        
        if (progress.status === 'completed') {
          queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
          queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
          
          toast({
            title: "🎉 Recording Processed Successfully!",
            description: "Meeting transcribed, summarized, and tasks created automatically.",
            duration: 5000,
          });
          
          // Reset state
          setHasRecording(false);
          setRecordingTime(0);
          setCurrentRecordingId(null);
          setUploadProgress(0);
          
          // Stop heartbeat if active
          if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = null;
          }
        } else if (progress.status === 'failed') {
          toast({
            title: "Processing Failed",
            description: progress.error || "Your recording is saved and will be retried automatically.",
            variant: "destructive",
          });
        }
      };
      
      await uploadQueue.addToQueue(currentRecordingId, progressCallback);
      updateQueueStatus();
      
    } catch (error) {
      console.error("Failed to queue recording for processing:", error);
      setIsProcessing(false);
      toast({
        title: "Processing Error",
        description: "Failed to queue recording for processing. It's saved and will be retried.",
        variant: "destructive",
      });
    }
  }, [currentRecordingId, toast, queryClient, updateQueueStatus]);

  const retryFailedUploads = useCallback(async () => {
    try {
      await uploadQueue.retryFailed();
      updateQueueStatus();
      toast({
        title: "Retrying Failed Uploads",
        description: "All failed recordings are being retried.",
      });
    } catch (error) {
      console.error('Failed to retry uploads:', error);
      toast({
        title: "Retry Failed",
        description: "Could not retry failed uploads. Please try again later.",
        variant: "destructive",
      });
    }
  }, [updateQueueStatus, toast]);

  const getPendingRecordings = useCallback(async () => {
    try {
      return await recordingStorage.getPendingRecordings();
    } catch (error) {
      console.error('Failed to get pending recordings:', error);
      return [];
    }
  }, []);

  const deleteUnrecoverableFailedRecordings = useCallback(async () => {
    try {
      const deletedCount = await uploadQueue.deleteUnrecoverableFailedRecordings();
      updateQueueStatus();
      toast({
        title: "Failed Recordings Deleted",
        description: `Removed ${deletedCount} failed recordings that could not be recovered.`,
      });
      return deletedCount;
    } catch (error) {
      console.error('Failed to delete unrecoverable recordings:', error);
      toast({
        title: "Delete Failed",
        description: "Could not delete failed recordings",
        variant: "destructive",
      });
      return 0;
    }
  }, [updateQueueStatus, toast]);

  const value = {
    isRecording,
    isPaused,
    recordingTime,
    hasRecording,
    isProcessing,
    uploadProgress,
    currentRecordingId,
    queueStatus,
    audioStream,
    recordingQuality,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    processCurrentRecording,
    retryFailedUploads,
    getPendingRecordings,
    deleteUnrecoverableFailedRecordings,
  };

  return (
    <VoiceRecordingContext.Provider value={value}>
      {children}
    </VoiceRecordingContext.Provider>
  );
}

export function useVoiceRecording() {
  const context = useContext(VoiceRecordingContext);
  if (!context) {
    throw new Error('useVoiceRecording must be used within a VoiceRecordingProvider');
  }
  return context;
}