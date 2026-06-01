import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMatrix } from '@/contexts/MatrixContext';
import { Loader2 } from 'lucide-react';

const BITE_USER_ID = '@bite:8.217.143.228';

export default function AiBit() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const { rooms, isInitialized, initialize, createDirectMessage } = useMatrix();
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    const redirectToBiteChat = async () => {
      if (isRedirecting) return;
      
      if (!isInitialized) {
        try {
          await initialize();
        } catch (error) {
          console.error('Failed to initialize Matrix:', error);
          return;
        }
      }

      setIsRedirecting(true);

      const biteUserPattern = /@bite:/i;
      const biteDMRooms = rooms.filter(room => 
        room.isDirect && room.directWith && biteUserPattern.test(room.directWith)
      );

      const queryParam = initialQuery ? `&q=${encodeURIComponent(initialQuery)}` : '';

      if (biteDMRooms.length > 0) {
        const mostRecentRoom = biteDMRooms[0];
        navigate(`/opc-channel?room=${encodeURIComponent(mostRecentRoom.roomId)}${queryParam}`);
      } else {
        try {
          const roomId = await createDirectMessage(BITE_USER_ID, 'bite');
          navigate(`/opc-channel?room=${encodeURIComponent(roomId)}${queryParam}`);
        } catch (error) {
          console.error('Failed to create bite DM:', error);
          navigate(`/opc-channel${queryParam ? '?' + queryParam.slice(1) : ''}`);
        }
      }
    };

    redirectToBiteChat();
  }, [isInitialized, rooms, initialize, createDirectMessage, navigate, isRedirecting, initialQuery]);

  return (
    <div className="h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        <p className="text-sm text-slate-500">正在跳转到 bite 聊天...</p>
      </div>
    </div>
  );
}
