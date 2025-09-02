import { useEffect, useRef } from 'react';

interface AudioLevelIndicatorProps {
  audioStream?: MediaStream | null;
  isRecording: boolean;
  className?: string;
}

export default function AudioLevelIndicator({ audioStream, isRecording, className = "" }: AudioLevelIndicatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const analyserRef = useRef<AnalyserNode>();
  const dataArrayRef = useRef<Uint8Array>();

  useEffect(() => {
    if (!audioStream || !isRecording) {
      // Stop visualization
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      return;
    }

    // Set up audio analysis
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(audioStream);
    
    source.connect(analyser);
    analyser.fftSize = 256;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    analyserRef.current = analyser;
    dataArrayRef.current = dataArray;

    const draw = () => {
      if (!canvasRef.current || !analyserRef.current || !dataArrayRef.current) return;
      
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      analyserRef.current.getByteFrequencyData(dataArrayRef.current);
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Calculate average audio level
      const average = dataArrayRef.current.reduce((sum, value) => sum + value, 0) / dataArrayRef.current.length;
      const normalizedLevel = average / 255; // Normalize to 0-1
      
      // Draw audio level bars
      const barCount = 8;
      const barWidth = canvas.width / barCount;
      const maxBarHeight = canvas.height;
      
      for (let i = 0; i < barCount; i++) {
        const barHeight = (normalizedLevel * maxBarHeight) * (Math.random() * 0.3 + 0.7); // Add some variation
        
        // Color based on audio level
        let color;
        if (normalizedLevel < 0.1) {
          color = '#ef4444'; // Red for very low/no audio
        } else if (normalizedLevel < 0.3) {
          color = '#f59e0b'; // Yellow for low audio
        } else if (normalizedLevel < 0.7) {
          color = '#10b981'; // Green for good audio
        } else {
          color = '#3b82f6'; // Blue for high audio
        }
        
        ctx.fillStyle = color;
        ctx.fillRect(i * barWidth + 1, maxBarHeight - barHeight, barWidth - 2, barHeight);
      }
      
      animationFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContext.state !== 'closed') {
        audioContext.close();
      }
    };
  }, [audioStream, isRecording]);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="text-xs text-gray-500">Audio:</div>
      <canvas
        ref={canvasRef}
        width={60}
        height={20}
        className="border border-gray-200 rounded bg-gray-50"
      />
      {!isRecording && (
        <div className="text-xs text-gray-400">Ready</div>
      )}
    </div>
  );
}