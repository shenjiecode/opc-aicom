import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMatrix } from '@/contexts/MatrixContext';
import { Loader2, AlertCircle, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';

const BITE_USER_ID = '@bite:8.217.143.228';

export default function AiBit() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const { rooms, isInitialized, initialize, createDirectMessage, error } = useMatrix();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    const redirectToBiteChat = async () => {
      if (isRedirecting) return;
      
      if (!isInitialized) {
        try {
          await initialize();
        } catch (error) {
          console.error('Failed to initialize Matrix:', error);
          setInitError('Matrix 连接失败，请先登录 OPC 账号');
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

  if (initError || error) {
    return (
      <div className="h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center px-4">
          <AlertCircle className="w-12 h-12 text-amber-500" />
          <h2 className="text-xl font-semibold text-slate-800">需要登录</h2>
          <p className="text-sm text-slate-500 max-w-md">{initError || error || '请先登录 OPC 账号后使用 AI比特 功能'}</p>
          <Button
            onClick={() => navigate('/login')}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl px-6"
          >
            <LogIn className="w-4 h-4 mr-2" />
            去登录
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        <p className="text-sm text-slate-500">正在跳转到 bite 聊天...</p>
      </div>
    </div>
  );
}
