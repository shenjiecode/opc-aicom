import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMatrix } from '@/contexts/MatrixContext';
import { Loader2 } from 'lucide-react';

// Bite user ID on Matrix server
const BITE_USER_ID = '@bite:8.217.143.228';

export default function AiBit() {
  const navigate = useNavigate();
  const { rooms, isInitialized, initialize, createDirectMessage } = useMatrix();
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    const redirectToBiteChat = async () => {
      if (isRedirecting) return;
      
      // Initialize Matrix if not already
      if (!isInitialized) {
        try {
          await initialize();
        } catch (error) {
          console.error('Failed to initialize Matrix:', error);
          return;
        }
      }

      setIsRedirecting(true);

      // Filter bite DM rooms
      const biteUserPattern = /@bite:/i;
      const biteDMRooms = rooms.filter(room => 
        room.isDirect && room.directWith && biteUserPattern.test(room.directWith)
      );

      if (biteDMRooms.length > 0) {
        // Sort by most recent activity (assuming rooms are sorted by last activity)
        // Navigate to OPCChannel with the first bite DM room selected
        const mostRecentRoom = biteDMRooms[0];
        navigate(`/opc-channel?room=${encodeURIComponent(mostRecentRoom.roomId)}`);
      } else {
        // No existing bite DM, create a new one
        try {
          const roomId = await createDirectMessage(BITE_USER_ID, 'bite');
          navigate(`/opc-channel?room=${encodeURIComponent(roomId)}`);
        } catch (error) {
          console.error('Failed to create bite DM:', error);
          // Fallback: just navigate to OPCChannel
          navigate('/opc-channel');
        }
      }
    };

    redirectToBiteChat();
  }, [isInitialized, rooms, initialize, createDirectMessage, navigate, isRedirecting]);

  return (
    <div className="h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        <p className="text-sm text-slate-500">正在跳转到 bite 聊天...</p>
      </div>
    </div>
  );
}
