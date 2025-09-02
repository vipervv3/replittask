import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Mic, MicOff, Volume2, VolumeX, Brain, Zap, Type, Send } from "lucide-react";
import { useVoiceAssistant } from "@/contexts/VoiceAssistantContext";

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function VoiceAssistantModal({ isOpen, onClose }: VoiceAssistantModalProps) {
  const { 
    isListening, 
    isProcessing, 
    isSpeaking,
    lastCommand,
    lastResponse,
    startListening,
    stopListening,
    executeVoiceCommand,
    processingProgress,
    supportsSpeechRecognition,
    supportsSpeechSynthesis
  } = useVoiceAssistant();

  const [showExamples, setShowExamples] = useState(false);
  const [textCommand, setTextCommand] = useState("");
  const [useTextMode, setUseTextMode] = useState(true); // Default to text mode since voice fails in Replit
  const [conversationHistory, setConversationHistory] = useState<Array<{user: string, ai: string}>>([]);

  // Auto-switch to text mode when voice fails
  useEffect(() => {
    const handleVoiceFailed = () => {
      setUseTextMode(true);
    };

    window.addEventListener('voice-failed', handleVoiceFailed);
    return () => window.removeEventListener('voice-failed', handleVoiceFailed);
  }, []);

  const handleClose = () => {
    if (isListening) {
      stopListening();
    }
    onClose();
  };

  const handleCommand = async (command: string) => {
    console.log('🎯 handleCommand called with:', command);
    
    // Add to conversation history
    setConversationHistory(prev => [...prev, { user: command, ai: "..." }]);
    
    try {
      // Execute command with conversation context
      await executeVoiceCommand(command, conversationHistory);
      setTextCommand("");
    } catch (error) {
      console.error('❌ handleCommand error:', error);
      setConversationHistory(prev => {
        const newHistory = [...prev];
        if (newHistory.length > 0) {
          newHistory[newHistory.length - 1].ai = "Sorry, I couldn't process that command. Please try again.";
        }
        return newHistory;
      });
      setTextCommand("");
    }
  };

  // Update conversation history when AI responds
  useEffect(() => {
    if (lastResponse && conversationHistory.length > 0) {
      const lastEntry = conversationHistory[conversationHistory.length - 1];
      if (lastEntry && lastEntry.ai === "...") {
        setConversationHistory(prev => {
          const newHistory = [...prev];
          newHistory[newHistory.length - 1] = {
            ...newHistory[newHistory.length - 1],
            ai: lastResponse
          };
          return newHistory;
        });
      }
    }
  }, [lastResponse, conversationHistory]);

  const voiceCommands = [
    {
      category: "Information",
      examples: [
        "What should I work on today?",
        "How many tasks are due this week?",
        "Show me my project status",
        "What are my urgent priorities?"
      ]
    },
    {
      category: "Quick Actions", 
      examples: [
        "Create a task: Review marketing proposal",
        "Mark task completed: Fix login bug",
        "Set priority urgent for user authentication",
        "Schedule meeting for tomorrow at 2 PM"
      ]
    },
    {
      category: "Smart Queries",
      examples: [
        "Give me today's briefing",
        "What projects need attention?",
        "Suggest focus time for deep work",
        "Help me prioritize my tasks"
      ]
    }
  ];

  if (!supportsSpeechRecognition) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">Voice Assistant Unavailable</DialogTitle>
          </DialogHeader>
          <div className="text-center space-y-4">
            <div className="text-6xl">🎤</div>
            <p className="text-gray-600">
              Voice recognition is not supported in your browser. 
              Please use Chrome, Edge, or Safari for voice features.
            </p>
            <Button onClick={handleClose} className="w-full">
              Understood
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-center gap-2">
            <Brain className="w-5 h-5 text-blue-600" />
            AI Assistant
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Voice Status */}
          <div className="text-center">
            <div className="relative mb-4">
              <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center transition-all duration-300 ${
                isListening ? 'bg-red-100 animate-pulse' : 
                isProcessing ? 'bg-blue-100' :
                isSpeaking ? 'bg-green-100 animate-pulse' : 'bg-gray-100'
              }`}>
                {isListening ? (
                  <Mic className="w-12 h-12 text-red-600" />
                ) : isProcessing ? (
                  <Brain className="w-12 h-12 text-blue-600 animate-spin" />
                ) : isSpeaking ? (
                  <Volume2 className="w-12 h-12 text-green-600" />
                ) : (
                  <Mic className="w-12 h-12 text-gray-400" />
                )}
              </div>
              
              {/* Status indicators */}
              {(isListening || isProcessing || isSpeaking) && (
                <div className="absolute -top-2 -right-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    isListening ? 'bg-red-600' :
                    isProcessing ? 'bg-blue-600' : 'bg-green-600'
                  }`}>
                    {isListening ? (
                      <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    ) : isProcessing ? (
                      <Zap className="w-3 h-3 text-white" />
                    ) : (
                      <Volume2 className="w-3 h-3 text-white" />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Status Text */}
            <div className="mb-4">
              {isListening ? (
                <div>
                  <Badge variant="outline" className="text-red-600 border-red-600 mb-2">
                    🎤 Listening...
                  </Badge>
                  <p className="text-sm text-gray-600">Speak your command clearly</p>
                </div>
              ) : isProcessing ? (
                <div>
                  <Badge variant="outline" className="text-blue-600 border-blue-600 mb-2">
                    🧠 Processing...
                  </Badge>
                  <Progress value={processingProgress} className="w-full mb-2" />
                  <p className="text-sm text-gray-600">AI is analyzing your request</p>
                </div>
              ) : isSpeaking ? (
                <div>
                  <Badge variant="outline" className="text-green-600 border-green-600 mb-2">
                    🔊 Speaking...
                  </Badge>
                  <p className="text-sm text-gray-600">AI Assistant is responding</p>
                </div>
              ) : (
                <div>
                  <Badge variant="outline" className="text-gray-600 border-gray-600 mb-2">
                    ⚡ Ready
                  </Badge>
                  <p className="text-sm text-gray-600">
                    {supportsSpeechSynthesis ? 
                      "Click to start voice conversation" : 
                      "Voice recognition available (text responses)"
                    }
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Conversation History */}
          {conversationHistory.length > 0 && (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              <div className="text-sm font-medium text-gray-900 mb-2">Conversation History</div>
              {conversationHistory.slice(-3).map((exchange, index) => (
                <div key={index} className="space-y-2">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="text-sm font-medium text-blue-900 mb-1">You:</div>
                    <div className="text-blue-800">{exchange.user}</div>
                  </div>
                  
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="text-sm font-medium text-green-900 mb-1 flex items-center gap-1">
                      <Brain className="w-4 h-4" />
                      AI Assistant:
                    </div>
                    <div className="text-green-800">{exchange.ai}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Current Exchange */}
          {(lastCommand || lastResponse) && conversationHistory.length === 0 && (
            <div className="space-y-3">
              {lastCommand && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="text-sm font-medium text-blue-900 mb-1">You:</div>
                  <div className="text-blue-800">"{lastCommand}"</div>
                </div>
              )}
              
              {lastResponse && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="text-sm font-medium text-green-900 mb-1 flex items-center gap-1">
                    <Brain className="w-4 h-4" />
                    AI Assistant:
                  </div>
                  <div className="text-green-800">{lastResponse}</div>
                </div>
              )}
            </div>
          )}

          {/* Input Section */}
          <div className="space-y-3">
            {/* Voice Control Buttons */}
            {!useTextMode && (
              <div className="flex gap-2 justify-center">
                <Button
                  onClick={isListening ? stopListening : startListening}
                  disabled={isProcessing}
                  size="lg"
                  className={isListening ? "bg-red-600 hover:bg-red-700" : ""}
                >
                  {isListening ? (
                    <>
                      <MicOff className="w-4 h-4 mr-2" />
                      Stop Listening
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4 mr-2" />
                      Start Voice Command
                    </>
                  )}
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => setUseTextMode(true)}
                  disabled={isProcessing}
                >
                  <Type className="w-4 h-4 mr-2" />
                  Switch to Text
                </Button>
              </div>
            )}
            
            {/* Text Input (always available) */}
            <div className="flex gap-2">
              <Input
                placeholder="Ask me anything about your projects..."
                value={textCommand}
                onChange={(e) => setTextCommand(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && textCommand.trim() && !isProcessing) {
                    handleCommand(textCommand.trim());
                  }
                }}
                disabled={isProcessing}
                autoFocus={useTextMode}
              />
              <Button
                onClick={() => {
                  if (textCommand.trim()) {
                    handleCommand(textCommand.trim());
                  }
                }}
                disabled={!textCommand.trim() || isProcessing}
                size="icon"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
            
            {useTextMode && !isListening && (
              <div className="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setUseTextMode(false)}
                  disabled={isProcessing || !supportsSpeechRecognition}
                >
                  <Mic className="w-3 h-3 mr-1" />
                  Try Voice Commands
                </Button>
              </div>
            )}
          </div>

          {/* Examples Button */}
          <div className="text-center">
            <Button 
              variant="outline" 
              onClick={() => setShowExamples(!showExamples)}
              disabled={isProcessing}
            >
              Show Example Commands
            </Button>
          </div>

          {/* Voice Command Examples */}
          {showExamples && (
            <div className="space-y-4">
              <div className="text-sm font-medium text-gray-900">Try these voice commands:</div>
              
              {voiceCommands.map((section, index) => (
                <div key={index} className="space-y-2">
                  <div className="text-xs font-medium text-gray-700 uppercase tracking-wide">
                    {section.category}
                  </div>
                  <div className="space-y-1">
                    {section.examples.map((example, exampleIndex) => (
                      <div 
                        key={exampleIndex}
                        className="text-sm text-gray-600 bg-gray-50 rounded px-2 py-1 border-l-2 border-blue-300"
                      >
                        "{example}"
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-sm text-blue-800">
                  💡 <strong>Tip:</strong> Speak clearly and naturally. The AI understands context and can help with project management, task creation, and productivity insights.
                </div>
              </div>
            </div>
          )}

          {/* Browser Compatibility Note */}
          <div className="text-xs text-gray-500 text-center">
            {supportsSpeechSynthesis ? 
              "🎤 Voice recognition and 🔊 voice responses supported" :
              "🎤 Voice recognition supported • Text responses only"
            }
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}