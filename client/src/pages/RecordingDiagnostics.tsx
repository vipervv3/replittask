import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { recordingStorage, type StoredRecording } from "@/lib/recordingStorage";
import { uploadQueue } from "@/lib/uploadQueue";
import { useVoiceRecording } from "@/contexts/VoiceRecordingContext";
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Database,
  Mic,
  Upload,
  Trash2,
  RotateCcw
} from "lucide-react";

export default function RecordingDiagnostics() {
  const [recordings, setRecordings] = useState<StoredRecording[]>([]);
  const [queueStatus, setQueueStatus] = useState({ queued: 0, uploading: 0, failed: 0, unrecoverable: 0 });
  const [systemHealth, setSystemHealth] = useState({
    indexedDB: false,
    mediaRecorder: false,
    storage: false
  });
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { deleteUnrecoverableFailedRecordings } = useVoiceRecording();

  const checkSystemHealth = async () => {
    const health = {
      indexedDB: false,
      mediaRecorder: false,
      storage: false
    };

    // Check IndexedDB support
    try {
      await recordingStorage.init();
      health.indexedDB = true;
    } catch (error) {
      console.error('IndexedDB check failed:', error);
    }

    // Check MediaRecorder support
    health.mediaRecorder = typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm');

    // Check storage quota
    try {
      if ('storage' in navigator && 'estimate' in navigator.storage) {
        const estimate = await navigator.storage.estimate();
        const usedMB = (estimate.usage || 0) / 1024 / 1024;
        const quotaMB = (estimate.quota || 0) / 1024 / 1024;
        health.storage = quotaMB > 0 && usedMB < quotaMB * 0.9; // Less than 90% full
      }
    } catch (error) {
      console.error('Storage check failed:', error);
    }

    setSystemHealth(health);
  };

  const loadDiagnostics = async () => {
    try {
      setIsLoading(true);
      
      // Load all recordings from IndexedDB
      const allRecordings = await recordingStorage.getAllRecordings();
      setRecordings(allRecordings);
      
      // Get upload queue status
      const status = await uploadQueue.getQueueStatus();
      setQueueStatus(status);
      
      // Check system health
      await checkSystemHealth();
    } catch (error) {
      console.error('Failed to load diagnostics:', error);
      toast({
        title: "Diagnostic Error",
        description: "Failed to load recording diagnostics",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const retryFailedRecordings = async () => {
    try {
      await uploadQueue.retryFailed();
      toast({
        title: "Recovery Started",
        description: "Processing all pending recordings (failed and stuck recordings)..."
      });
      
      // Reload diagnostics after 8 seconds to allow time for processing
      setTimeout(() => {
        loadDiagnostics();
      }, 8000);
    } catch (error) {
      toast({
        title: "Recovery Failed", 
        description: "Could not process pending recordings",
        variant: "destructive"
      });
    }
  };

  const cleanupOldRecordings = async () => {
    try {
      await recordingStorage.cleanup();
      await loadDiagnostics();
      toast({
        title: "Cleanup Complete",
        description: "Old recordings have been cleaned up"
      });
    } catch (error) {
      toast({
        title: "Cleanup Failed",
        description: "Could not clean up old recordings",
        variant: "destructive"
      });
    }
  };

  const deleteRecording = async (recordingId: string) => {
    try {
      await recordingStorage.deleteRecording(recordingId);
      await loadDiagnostics();
      toast({
        title: "Recording Deleted",
        description: "Recording has been removed from local storage"
      });
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "Could not delete recording",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    loadDiagnostics();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'uploaded': return 'bg-blue-100 text-blue-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'processing': return 'bg-yellow-100 text-yellow-800';
      case 'recording': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Recording System Diagnostics</h1>
        <Button onClick={loadDiagnostics} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* System Health */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Database className="h-4 w-4" />
              IndexedDB
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {systemHealth.indexedDB ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <span className={systemHealth.indexedDB ? "text-green-600" : "text-red-600"}>
                {systemHealth.indexedDB ? "Working" : "Failed"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Mic className="h-4 w-4" />
              MediaRecorder
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {systemHealth.mediaRecorder ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <span className={systemHealth.mediaRecorder ? "text-green-600" : "text-red-600"}>
                {systemHealth.mediaRecorder ? "Supported" : "Unsupported"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Upload className="h-4 w-4" />
              Storage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {systemHealth.storage ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
              )}
              <span className={systemHealth.storage ? "text-green-600" : "text-yellow-600"}>
                {systemHealth.storage ? "Available" : "Limited"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upload Queue Status */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Queue Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">{queueStatus.queued}</div>
              <div className="text-sm text-gray-600">Queued</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">{queueStatus.uploading}</div>
              <div className="text-sm text-gray-600">Uploading</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{queueStatus.failed}</div>
              <div className="text-sm text-gray-600">Failed (Retryable)</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-600">{queueStatus.unrecoverable || 0}</div>
              <div className="text-sm text-gray-600">Unrecoverable</div>
            </div>
          </div>
          
          <div className="mt-4 text-xs text-gray-500">
            Debug: Queue Status = {JSON.stringify(queueStatus)}
          </div>
          
          {(queueStatus.failed > 0 || queueStatus.unrecoverable > 0) && (
            <div className="mt-4 space-y-3">
              {queueStatus.failed > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    {queueStatus.failed} recordings failed to upload. Try recovery to retry them.
                  </AlertDescription>
                </Alert>
              )}
              {queueStatus.unrecoverable > 0 && (
                <Alert>
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    {queueStatus.unrecoverable} failed recordings cannot be recovered (no audio data). You can delete them to clean up space.
                  </AlertDescription>
                </Alert>
              )}
              <div className="flex gap-2">
                {queueStatus.failed > 0 && (
                  <Button onClick={retryFailedRecordings} variant="outline">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Retry Failed Uploads
                  </Button>
                )}
                {queueStatus.unrecoverable > 0 && (
                  <Button 
                    onClick={async () => {
                      const deletedCount = await deleteUnrecoverableFailedRecordings();
                      if (deletedCount > 0) {
                        await loadDiagnostics(); // Refresh the display
                      }
                    }} 
                    variant="destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Failed Recordings
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recordings List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Local Recordings ({recordings.length})</CardTitle>
          <div className="flex gap-2">
            <Button onClick={cleanupOldRecordings} variant="outline" size="sm">
              <Trash2 className="h-4 w-4 mr-2" />
              Cleanup Old
            </Button>
            <Button 
              onClick={async () => {
                const deletedCount = await deleteUnrecoverableFailedRecordings();
                if (deletedCount > 0) {
                  await loadDiagnostics(); // Refresh the display
                } else {
                  toast({
                    title: "No Failed Recordings",
                    description: "There are no unrecoverable failed recordings to delete.",
                  });
                }
              }} 
              variant="destructive"
              size="sm"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Failed
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {recordings.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              No local recordings found
            </div>
          ) : (
            <div className="space-y-3">
              {recordings.map((recording) => (
                <div key={recording.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">{recording.metadata.title}</div>
                    <div className="text-sm text-gray-600">
                      {new Date(recording.timestamp).toLocaleString()} • 
                      {Math.round(recording.metadata.size / 1024 / 1024 * 100) / 100}MB • 
                      {recording.duration}s •
                      {recording.chunks?.length || 0} chunks
                    </div>
                    {recording.lastError && (
                      <div className="text-sm text-red-600 mt-1">
                        Error: {recording.lastError}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(recording.status)}>
                      {recording.status}
                    </Badge>
                    {recording.retryCount > 0 && (
                      <Badge variant="outline">
                        Retry {recording.retryCount}
                      </Badge>
                    )}
                    <Button 
                      onClick={() => deleteRecording(recording.id)}
                      variant="ghost" 
                      size="sm"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}