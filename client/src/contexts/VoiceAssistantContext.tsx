import { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// TypeScript declarations for browser APIs
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface VoiceAssistantContextType {
  isListening: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  lastCommand: string | null;
  lastResponse: string | null;
  startListening: () => Promise<void>;
  stopListening: () => void;
  speakResponse: (text: string) => Promise<void>;
  executeVoiceCommand: (command: string, conversationHistory?: Array<{user: string, ai: string}>) => Promise<void>;
  processingProgress: number;
  supportsSpeechRecognition: boolean;
  supportsSpeechSynthesis: boolean;
}

export const VoiceAssistantContext = createContext<VoiceAssistantContextType | null>(null);

export function VoiceAssistantProvider({ children }: { children: ReactNode }) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  
  const recognitionRef = useRef<any>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check browser support
  const supportsSpeechRecognition = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
  const supportsSpeechSynthesis = typeof window !== 'undefined' && 
    ('speechSynthesis' in window);


  // Initialize speech synthesis
  useEffect(() => {
    if (supportsSpeechSynthesis) {
      synthesisRef.current = window.speechSynthesis;
    }
  }, [supportsSpeechSynthesis]);

  const startListening = useCallback(async () => {
    if (!supportsSpeechRecognition) {
      // Voice not supported, but user will use text mode
      return;
    }

    try {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;
      
      // Add timeout to prevent hanging (longer timeout for better experience)
      const timeoutId = setTimeout(() => {
        if (recognitionRef.current && isListening) {
          recognition.stop();
          setLastResponse("I'm still listening. Please try speaking your command again or use the text input.");
        }
      }, 15000); // 15 second timeout

      recognition.onstart = () => {
        setIsListening(true);
        console.log('🎤 Voice Assistant listening...');
      };

      recognition.onresult = async (event: any) => {
        const command = event.results[0][0].transcript;
        const confidence = event.results[0][0].confidence;
        
        console.log('🗣️ Voice command received:', command, 'Confidence:', confidence);
        
        // Only process commands with reasonable confidence and length (more permissive)
        if (command && command.trim().length > 1 && (!confidence || confidence > 0.1)) {
          setLastCommand(command);
          setIsListening(false);
          
          // Process the command
          await executeVoiceCommand(command);
        } else {
          console.log('🚫 Command rejected due to low confidence or length:', command, confidence);
          setIsListening(false);
          // More encouraging message, don't make user feel bad
          setLastResponse("Please try speaking a bit louder and clearer, or use the text input below for better results.");
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        
        // More graceful error handling - different messages for different errors
        if (event.error === 'no-speech') {
          setLastResponse("I didn't hear anything. Please try speaking your command again.");
        } else if (event.error === 'audio-capture') {
          setLastResponse("Microphone access issue. Please check your microphone permissions and try again.");
        } else {
          setLastResponse("Voice recognition had an issue. Please try again or use the text input below.");
        }
        
        // Don't auto-switch to text mode, let user decide
      };

      recognition.onend = () => {
        setIsListening(false);
        clearTimeout(timeoutId);
        console.log('🎤 Voice Assistant stopped listening');
      };

      recognitionRef.current = recognition;
      recognition.start();
      
    } catch (error) {
      console.error("Failed to start voice assistant:", error);
      setIsListening(false);
      // Voice failed, user will use text mode
    }
  }, [supportsSpeechRecognition, toast]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const speakResponse = useCallback(async (text: string): Promise<void> => {
    if (!supportsSpeechSynthesis || !synthesisRef.current) {
      console.log('Speech synthesis not supported, showing text only');
      return;
    }

    return new Promise((resolve) => {
      // Stop any current speech
      if (currentUtteranceRef.current) {
        synthesisRef.current?.cancel();
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9; // Slightly slower for clarity
      utterance.pitch = 1;
      utterance.volume = 0.8;

      utterance.onstart = () => {
        setIsSpeaking(true);
        console.log('🔊 AI Assistant speaking...');
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        currentUtteranceRef.current = null;
        console.log('🔊 AI Assistant finished speaking');
        resolve();
      };

      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        setIsSpeaking(false);
        currentUtteranceRef.current = null;
        resolve();
      };

      currentUtteranceRef.current = utterance;
      synthesisRef.current?.speak(utterance);
    });
  }, [supportsSpeechSynthesis]);

  const executeVoiceCommand = useCallback(async (command: string, conversationHistory: Array<{user: string, ai: string}> = []) => {
    setIsProcessing(true);
    setProcessingProgress(0);

    try {
      console.log(`🧠 Processing voice command: "${command}"`);
      console.log('📤 Sending API request to /api/ai/voice-command');
      setProcessingProgress(25);

      // Send command to AI service for processing
      const response = await apiRequest("POST", "/api/ai/voice-command", {
        command: command.toLowerCase(),
        timestamp: new Date().toISOString(),
        conversationHistory: conversationHistory
      });

      console.log('📥 API response received:', response.status);
      setProcessingProgress(50);
      const result = await response.json();
      console.log('🧠 AI result:', result);
      setProcessingProgress(75);

      if (result.success) {
        setLastResponse(result.response);
        
        // Invalidate relevant queries if data was modified
        if (result.dataModified) {
          queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
          queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
        }

        // Speak the response
        if (result.response) {
          await speakResponse(result.response);
        }

        setProcessingProgress(100);
        
        // Return the result so modal can access it
        return result;

      } else {
        throw new Error(result.error || "Command processing failed");
      }

    } catch (error: any) {
      console.error("Voice command processing error:", error);
      
      const errorMessage = error.message?.includes('401') 
        ? "Please log in to use voice commands"
        : "Sorry, I couldn't process that command. Please try again.";
      
      setLastResponse(errorMessage);
      await speakResponse(errorMessage);

      // Error will only show in the AI modal
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
    }
  }, [toast, queryClient, speakResponse]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (synthesisRef.current && currentUtteranceRef.current) {
        synthesisRef.current.cancel();
      }
    };
  }, []);

  const value = {
    isListening,
    isProcessing,
    isSpeaking,
    lastCommand,
    lastResponse,
    startListening,
    stopListening,
    speakResponse,
    executeVoiceCommand,
    processingProgress,
    supportsSpeechRecognition,
    supportsSpeechSynthesis,
  };

  return (
    <VoiceAssistantContext.Provider value={value}>
      {children}
    </VoiceAssistantContext.Provider>
  );
}

export function useVoiceAssistant() {
  const context = useContext(VoiceAssistantContext);
  if (!context) {
    throw new Error('useVoiceAssistant must be used within a VoiceAssistantProvider');
  }
  return context;
}