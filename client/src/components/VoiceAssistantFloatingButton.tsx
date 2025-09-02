import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Brain, Mic, Volume2 } from "lucide-react";
import { useVoiceAssistant } from "@/contexts/VoiceAssistantContext";
import VoiceAssistantModal from "@/components/modals/VoiceAssistantModal";
import "@/styles/floating-buttons.css";

export default function VoiceAssistantFloatingButton() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { isListening, isProcessing, isSpeaking, supportsSpeechRecognition } = useVoiceAssistant();

  const isActive = isListening || isProcessing || isSpeaking;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          bottom: '100px',
          right: '20px',
          zIndex: 999998,
          width: '70px',
          height: '70px',
          backgroundColor: '#8b5cf6',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          border: '4px solid gold'
        }}
        onClick={() => setIsModalOpen(true)}
        data-testid="voice-assistant-button"
      >
        {isListening ? (
          <Mic style={{ color: 'white', fontSize: '28px', width: '28px', height: '28px' }} />
        ) : isProcessing ? (
          <Brain style={{ color: 'white', fontSize: '28px', width: '28px', height: '28px' }} />
        ) : isSpeaking ? (
          <Volume2 style={{ color: 'white', fontSize: '28px', width: '28px', height: '28px' }} />
        ) : (
          <Brain style={{ color: 'white', fontSize: '28px', width: '28px', height: '28px' }} />
        )}
      </div>

      <VoiceAssistantModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </>
  );
}