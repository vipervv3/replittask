import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mic, Play, Square, MicOff, Pause } from "lucide-react";
import { useVoiceRecording } from "@/contexts/VoiceRecordingContext";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import AudioLevelIndicator from "../AudioLevelIndicator";

interface VoiceRecordingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function VoiceRecordingModal({ isOpen, onClose }: VoiceRecordingModalProps) {
  const [selectedProject, setSelectedProject] = useState<string>("");
  const { toast } = useToast();
  const { 
    isRecording, 
    isPaused,
    recordingTime, 
    startRecording, 
    stopRecording,
    pauseRecording,
    resumeRecording,
    hasRecording, 
    processCurrentRecording,
    isProcessing,
    uploadProgress,
    queueStatus,
    audioStream,
    recordingQuality
  } = useVoiceRecording();

  const { data: projects } = useQuery({
    queryKey: ["/api/projects"],
  });

  const handleClose = () => {
    if (isRecording) {
      stopRecording();
    }
    setSelectedProject(""); // Reset project selection when closing
    onClose();
  };

  const handleStartRecording = async () => {
    if (!selectedProject) {
      return; // Should not happen due to disabled button, but safety check
    }
    await startRecording(selectedProject, 'Voice Recording from Modal');
    // Minimize modal after starting recording so user can navigate
    onClose();
  };

  const handleProcessRecording = useCallback(async () => {
    try {
      await processCurrentRecording();
      onClose();
    } catch (error) {
      console.error("Failed to process recording:", error);
    }
  }, [processCurrentRecording, selectedProject, onClose]);

  // Auto-process when recording stops if project is selected
  useEffect(() => {
    if (hasRecording && selectedProject && !isProcessing) {
      // Auto-process the recording when it's complete and project is selected
      handleProcessRecording();
    }
  }, [hasRecording, selectedProject, isProcessing, handleProcessRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm max-w-[90vw] max-h-[75vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center">Voice Recording</DialogTitle>
        </DialogHeader>
        
        <div className="text-center space-y-4">
          {/* RECORDING CONTROLS AT THE TOP */}
          <div className="bg-gray-50 border rounded-lg p-4">
            {/* Timer Display */}
            <div className="text-3xl font-bold text-gray-900 mb-3 text-center">
              {formatTime(recordingTime)}
            </div>
            
            {/* Recording Status */}
            <div className="text-sm text-gray-500 text-center mb-4">
              {isRecording ? (
                <span className="flex items-center justify-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`}></div>
                  {isPaused ? 'Recording paused...' : 'Recording in progress...'}
                </span>
              ) : hasRecording ? (
                <span className="text-green-600">✅ Recording complete - Ready to process</span>
              ) : (
                "Ready to record (Max 2 hours)"
              )}
            </div>
            
            {/* Recording Control Buttons */}
            <div className="flex flex-col sm:flex-row justify-center gap-3 sm:space-x-3 sm:gap-0">
              {!isRecording && !hasRecording && (
                <Button
                  onClick={handleStartRecording}
                  disabled={!selectedProject}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 text-base w-full sm:w-auto"
                >
                  <Mic className="w-5 h-5 mr-2" />
                  Start Recording
                </Button>
              )}

              {isRecording && (
                <>
                  {!isPaused ? (
                    <Button
                      onClick={pauseRecording}
                      variant="outline"
                      className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 text-base w-full sm:w-auto"
                    >
                      <Pause className="w-5 h-5 mr-2" />
                      Pause
                    </Button>
                  ) : (
                    <Button
                      onClick={resumeRecording}
                      className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 text-base w-full sm:w-auto"
                    >
                      <Play className="w-5 h-5 mr-2" />
                      Resume
                    </Button>
                  )}
                  <Button
                    onClick={stopRecording}
                    variant="destructive"
                    className="px-6 py-3 text-base w-full sm:w-auto"
                  >
                    <Square className="w-5 h-5 mr-2" />
                    Stop
                  </Button>
                </>
              )}

              {hasRecording && !isProcessing && (
                <>
                  <Button
                    onClick={handleProcessRecording}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-3 text-base w-full sm:w-auto"
                  >
                    <Play className="w-5 h-5 mr-2" />
                    Process Recording
                  </Button>
                  <Button
                    onClick={() => {
                      // Reset recording state
                      setSelectedProject("");
                      handleClose();
                    }}
                    variant="outline"
                    className="px-4 py-3 text-base w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                </>
              )}

              {isProcessing && (
                <div className="text-center">
                  <div className="text-sm text-blue-600 mb-2">
                    {uploadProgress ? `Uploading... ${uploadProgress}%` : 'Processing with AI...'}
                    {queueStatus.failed > 0 && ` (${queueStatus.failed} failed)`}
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                      style={{ width: uploadProgress ? `${uploadProgress}%` : '50%' }}
                    />
                  </div>
                </div>
              )}
            </div>
            
            {/* Always show cancel button */}
            <div className="mt-3">
              <Button
                onClick={handleClose}
                variant="outline"
                className="px-4 py-3 text-base w-full sm:w-auto"
              >
                {isRecording || hasRecording ? 'Close' : 'Cancel'}
              </Button>
            </div>
          </div>

          {/* Project Selection */}
          {!hasRecording && !isRecording && (
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-2 text-left">
                📁 Select Project First *
              </label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="bg-blue-50 border-blue-200">
                  <SelectValue placeholder="Choose project for your meeting..." />
                </SelectTrigger>
                <SelectContent>
                  {(projects as any[])?.map((project: any) => (
                    <SelectItem key={project.id} value={project.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{project.name}</span>
                        <span className="text-xs text-gray-500 ml-2">
                          {project.progress}% complete
                        </span>
                      </div>
                    </SelectItem>
                  )) || []}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                AI will automatically create tasks and assign them to this project when recording completes
              </p>
            </div>
          )}

          {/* Selected Project Display - Show during recording */}
          {(isRecording || hasRecording) && selectedProject && (
            <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-800">
                <strong>📁 Recording for:</strong> {(projects as any[])?.find(p => p.id === selectedProject)?.name || 'Selected Project'}
              </p>
            </div>
          )}

          {/* Compact Description */}
          <div className="mb-3">
            <p className="text-sm text-gray-600 mb-3">
              Record your meeting or project discussion. AI will transcribe, summarize, and automatically extract actionable tasks.
            </p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-green-50 border border-green-200 rounded p-2">
                <div className="text-xs text-green-600 font-semibold">✅ WILL EXTRACT</div>
                <div className="text-xs text-green-800">Tasks • Deadlines • Assignees • Priorities</div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded p-2">
                <div className="text-xs text-blue-600 font-semibold">📝 WILL CREATE</div>
                <div className="text-xs text-blue-800">Summary • Action items • Follow-ups</div>
              </div>
            </div>
            
            {/* Compact Tips */}
            <div className="space-y-2 text-xs">
              <div className="bg-amber-50 border border-amber-200 rounded p-2">
                <span className="font-medium text-amber-800">📱 Mobile Recording Tips:</span> Hold phone 6-8 inches from mouth. Keep screen on during long recordings. Consider plugging in your device.
              </div>
              <div className="bg-green-50 border border-green-200 rounded p-2">
                <span className="font-medium text-green-800">💾 Auto-Backup Protection:</span> All recordings are automatically saved locally. Screen sleep won't stop recordings on modern phones.
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded p-2">
                <span className="font-medium text-blue-800">🎯 For best results:</span> Mention specific people, dates, and deliverables during your recording.
              </div>
            </div>
          </div>

          {/* Additional backup option if needed */}
          {hasRecording && !isProcessing && (
            <div className="text-center">
              <Button 
                variant="outline" 
                onClick={() => {
                toast({ title: "Recording Saved", description: "Your recording is automatically saved locally." });
              }}
                className="text-xs px-4 py-2"
              >
                💾 Save Backup Locally
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}