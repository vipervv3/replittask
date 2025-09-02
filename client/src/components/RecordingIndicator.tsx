import { useVoiceRecording } from "@/contexts/VoiceRecordingContext";
import { Mic, Square, Shield, Wifi, WifiOff, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

export default function RecordingIndicator() {
  const { isRecording, isPaused, recordingTime, stopRecording, pauseRecording, resumeRecording, recordingQuality } = useVoiceRecording();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isRecording) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getQualityColor = () => {
    switch (recordingQuality) {
      case 'excellent': return 'text-green-400';
      case 'good': return 'text-yellow-400';
      case 'poor': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className={`fixed top-2 left-1/2 transform -translate-x-1/2 z-50 text-white px-4 py-2 rounded-full shadow-lg ${isPaused ? 'bg-yellow-600' : 'bg-red-600 animate-pulse'}`}>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <Mic className="w-4 h-4" />
          <span className="text-sm font-medium">REC</span>
        </div>
        
        <div className="text-sm font-bold">{formatTime(recordingTime)}</div>
        
        {/* Recording safety indicators */}
        <div className="flex items-center gap-1">
          <div title="Recording saved locally">
            <Shield className="w-3 h-3 text-green-400" />
          </div>
          {isOnline ? (
            <div title="Online - will upload automatically">
              <Wifi className="w-3 h-3 text-green-400" />
            </div>
          ) : (
            <div title="Offline - will upload when connection returns">
              <WifiOff className="w-3 h-3 text-yellow-400" />
            </div>
          )}
          <div className={`w-2 h-2 rounded-full ${getQualityColor()}`} title={`Audio quality: ${recordingQuality}`} />
        </div>
        
        <div className="flex gap-1">
          {!isPaused ? (
            <Button
              onClick={pauseRecording}
              size="sm"
              variant="outline"
              className="h-6 w-6 p-0 bg-white text-yellow-600 hover:bg-gray-100"
              title="Pause recording"
            >
              <Pause className="w-3 h-3" />
            </Button>
          ) : (
            <Button
              onClick={resumeRecording}
              size="sm"
              variant="outline"
              className="h-6 w-6 p-0 bg-white text-green-600 hover:bg-gray-100"
              title="Resume recording"
            >
              <Play className="w-3 h-3" />
            </Button>
          )}
          <Button
            onClick={stopRecording}
            size="sm"
            variant="outline"
            className="h-6 w-6 p-0 bg-white text-red-600 hover:bg-gray-100"
            title="Stop recording"
          >
            <Square className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}