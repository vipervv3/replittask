import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, Clock, CheckCircle, AlertCircle, Trash2 } from "lucide-react";
import { useVoiceRecording } from "@/hooks/useVoiceRecording";
import { recordingStorage, type StoredRecording } from "@/lib/recordingStorage";
import { useToast } from "@/hooks/use-toast";

export default function RecordingQueue() {
  const [recordings, setRecordings] = useState<StoredRecording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { queueStatus, retryFailedUploads } = useVoiceRecording();
  const { toast } = useToast();

  const loadRecordings = async () => {
    try {
      setIsLoading(true);
      const allRecordings = await recordingStorage.getAllRecordings();
      // Sort by timestamp (newest first)
      const sortedRecordings = allRecordings.sort((a, b) => b.timestamp - a.timestamp);
      setRecordings(sortedRecordings);
    } catch (error) {
      console.error('Failed to load recordings:', error);
      toast({
        title: "Failed to Load Recordings",
        description: "Could not retrieve recording history.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRecordings();
    
    // Refresh every 10 seconds to show updated status
    const interval = setInterval(loadRecordings, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleDeleteRecording = async (id: string) => {
    try {
      await recordingStorage.deleteRecording(id);
      setRecordings(prev => prev.filter(r => r.id !== id));
      toast({
        title: "Recording Deleted",
        description: "The recording has been removed from storage.",
      });
    } catch (error) {
      console.error('Failed to delete recording:', error);
      toast({
        title: "Delete Failed",
        description: "Could not delete the recording.",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: StoredRecording['status']) => {
    switch (status) {
      case 'recording':
        return <Badge variant="outline" className="text-red-600 border-red-600"><Clock className="w-3 h-3 mr-1" />Recording</Badge>;
      case 'completed':
        return <Badge variant="outline" className="text-blue-600 border-blue-600"><Clock className="w-3 h-3 mr-1" />Ready</Badge>;
      case 'processing':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-600"><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Processing</Badge>;
      case 'uploaded':
        return <Badge variant="outline" className="text-green-600 border-green-600"><CheckCircle className="w-3 h-3 mr-1" />Complete</Badge>;
      case 'failed':
        return <Badge variant="outline" className="text-red-600 border-red-600"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Recording Queue</h1>
            <p className="text-muted-foreground">
              Manage your voice recordings and their processing status
            </p>
          </div>
          <Button onClick={loadRecordings} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Queue Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Queued</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{queueStatus.queued}</div>
              <p className="text-xs text-muted-foreground">Waiting to upload</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Uploading</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{queueStatus.uploading}</div>
              <p className="text-xs text-muted-foreground">Currently processing</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{queueStatus.failed}</div>
              <p className="text-xs text-muted-foreground">Need retry</p>
              {queueStatus.failed > 0 && (
                <Button onClick={retryFailedUploads} size="sm" className="mt-2">
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Retry All
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recordings List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">All Recordings</h2>
          
          {recordings.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">No recordings found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Start recording voice memos to see them here
                </p>
              </CardContent>
            </Card>
          ) : (
            recordings.map((recording) => (
              <Card key={recording.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{recording.metadata.title}</CardTitle>
                      <CardDescription>
                        {new Date(recording.timestamp).toLocaleString()}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(recording.status)}
                      {(recording.status === 'uploaded' || recording.status === 'failed') && (
                        <Button
                          onClick={() => handleDeleteRecording(recording.id)}
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="font-medium">Duration</div>
                      <div className="text-muted-foreground">{formatDuration(recording.duration)}</div>
                    </div>
                    <div>
                      <div className="font-medium">Size</div>
                      <div className="text-muted-foreground">{formatFileSize(recording.metadata.size)}</div>
                    </div>
                    <div>
                      <div className="font-medium">Format</div>
                      <div className="text-muted-foreground">{recording.metadata.mimeType}</div>
                    </div>
                    <div>
                      <div className="font-medium">Retry Count</div>
                      <div className="text-muted-foreground">{recording.retryCount}/4</div>
                    </div>
                  </div>
                  
                  {recording.status === 'processing' && (
                    <div className="mt-4">
                      <Progress value={50} className="w-full" />
                      <p className="text-xs text-muted-foreground mt-1">Processing recording...</p>
                    </div>
                  )}
                  
                  {recording.lastError && (
                    <div className="mt-4 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-md">
                      <p className="text-sm text-red-800 dark:text-red-200 font-medium">Error:</p>
                      <p className="text-xs text-red-600 dark:text-red-300">{recording.lastError}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}