import { useContext } from "react";
import { VoiceRecordingContext } from "@/contexts/VoiceRecordingContext";

export function useVoiceRecording() {
  const context = useContext(VoiceRecordingContext);
  
  if (!context) {
    throw new Error('useVoiceRecording must be used within a VoiceRecordingProvider');
  }
  
  return context;
}