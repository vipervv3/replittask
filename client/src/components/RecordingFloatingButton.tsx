import { Mic } from "lucide-react";

interface RecordingFloatingButtonProps {
  onOpen: () => void;
}

export default function RecordingFloatingButton({ onOpen }: RecordingFloatingButtonProps) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 999999,
        width: '70px',
        height: '70px',
        backgroundColor: '#ff0000',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        border: '4px solid white'
      }}
      onClick={onOpen}
      data-testid="recording-button"
    >
      <Mic style={{ color: 'white', fontSize: '28px', width: '28px', height: '28px' }} />
    </div>
  );
}