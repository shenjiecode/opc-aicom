import { MessageCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useMatrix } from '@/contexts/MatrixContext';
import { useAibitDrawer } from '@/contexts/AibitDrawerContext';
import { Button } from '@/components/ui/button';

export function AibitFloatingButton() {
  const { isAuthenticated } = useAuth();
  const { unreadNotificationCount } = useMatrix();
  const { toggleDrawer } = useAibitDrawer();

  const handleClick = () => {
    if (isAuthenticated) {
      toggleDrawer();
    } else {
      // For unauthenticated users, redirect to login
      window.location.href = '/login';
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Button
        size="icon"
        className="h-12 w-12 rounded-full shadow-lg"
        onClick={handleClick}
        data-testid="aibit-floating-btn"
        aria-label={isAuthenticated ? '打开聊天助手' : '登录后使用聊天助手'}
      >
        <MessageCircle className="h-5 w-5" />
      </Button>
      {unreadNotificationCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
          {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
        </span>
      )}
    </div>
  );
}
