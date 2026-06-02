import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMatrix } from '@/contexts/MatrixContext';
import { useAibitDrawer } from '@/contexts/AibitDrawerContext';
import { Loader2, AlertCircle, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';

const BITE_USER_ID = '@bite:8.217.143.228';

export default function AiBit() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const { rooms, isInitialized, initialize, createDirectMessage, error } = useMatrix();
  const { openDrawer } = useAibitDrawer();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    console.log('[AiBit] 开始跳转流程...');

    const redirectToBiteChat = async () => {
      if (isRedirecting) {
        console.log('[AiBit] 已经在跳转中，跳过');
        return;
      }

      console.log('[AiBit] 检查 Matrix 初始化状态:', { isInitialized });

      if (!isInitialized) {
        console.log('[AiBit] Matrix 未初始化，开始初始化...');
        console.log('[AiBit] ⚠️ 如果 OPC 未登录，Matrix 登录将失败并提示');
        try {
          await initialize();
          console.log('[AiBit] ✓ Matrix 初始化成功');
        } catch (error) {
          console.error('[AiBit] ✗ Matrix 初始化失败:', error);
          console.log('[AiBit] 💡 提示: OPC 没有登录，请先登录 OPC 账号');
          setInitError('Matrix 连接失败，请先登录 OPC 账号');
          return;
        }
      } else {
        console.log('[AiBit] ✓ Matrix 已初始化');
      }

      setIsRedirecting(true);

      console.log('[AiBit] 查找 bite DM 聊天:', {
        totalRooms: rooms.length,
        query: initialQuery
      });
      const biteUserPattern = /@bite:/i;
      const biteDMRooms = rooms.filter(room =>
        room.isDirect && room.directWith && biteUserPattern.test(room.directWith)
      );
      console.log('[AiBit] 找到 bite DM 数量:', biteDMRooms.length);

      const queryParam = initialQuery ? `&q=${encodeURIComponent(initialQuery)}` : '';

      if (biteDMRooms.length > 0) {
        const mostRecentRoom = biteDMRooms[0];
        console.log('[AiBit] ✓ 打开现有 bite 聊天抽屉:', mostRecentRoom.roomId);
        openDrawer();
      } else {
        console.log('[AiBit] 没有现有 bite 聊天，创建新聊天...');
        try {
          const roomId = await createDirectMessage(BITE_USER_ID, 'bite');
        console.log('[AiBit] ✓ 创建新 bite 聊天成功:', roomId);
        openDrawer();
        } catch (error) {
          console.error('[AiBit] ✗ 创建 bite DM 失败:', error);
        console.log('[AiBit] 打开默认 opc-channel 抽屉');
        openDrawer();
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
        <p className="text-sm text-slate-500">正在打开 bite 聊天抽屉...</p>
      </div>
    </div>
  );
}
