import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  UserPlus,
  Check,
  X,
  ChevronRight,
  Settings,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Types
type MatrixInvitation = {
  roomId: string;
  roomName: string;
  inviterId: string;
  inviterName?: string;
  timestamp: number;
};

interface NotificationDropdownProps {
  className?: string;
  // Optional: pass Matrix context data from parent
  invitations?: MatrixInvitation[];
  notifications?: any[];
  unreadCount?: number;
  isMatrixConnected?: boolean;
  onAcceptInvite?: (roomId: string) => Promise<void>;
  onRejectInvite?: (roomId: string) => Promise<void>;
  onClearAll?: () => void;
}

export function NotificationDropdown({ 
  className,
  invitations = [],
  unreadCount = 0,
  isMatrixConnected = false,
  onAcceptInvite,
  onRejectInvite,
  onClearAll,
}: NotificationDropdownProps) {
  const navigate = useNavigate();
  const [processingInvite, setProcessingInvite] = useState<string | null>(null);

  const handleAcceptInvite = async (roomId: string) => {
    if (!onAcceptInvite) return;
    setProcessingInvite(roomId);
    try {
      await onAcceptInvite(roomId);
    } catch (error) {
      console.error("Failed to accept invitation:", error);
    } finally {
      setProcessingInvite(null);
    }
  };

  const handleRejectInvite = async (roomId: string) => {
    if (!onRejectInvite) return;
    setProcessingInvite(roomId);
    try {
      await onRejectInvite(roomId);
    } catch (error) {
      console.error("Failed to reject invitation:", error);
    } finally {
      setProcessingInvite(null);
    }
  };

  const handleGoToWorkbench = () => {
    navigate("/opc-workbench");
  };

  const totalUnread = unreadCount + invitations.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-muted)]",
            className
          )}
        >
          <Bell className="h-5 w-5" />
          {totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--primary-500)] text-white text-xs flex items-center justify-center font-medium">
              {totalUnread > 9 ? "9+" : totalUnread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-80 bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)] p-0"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)]">
          <span className="font-medium text-sm">消息中心</span>
          {totalUnread > 0 && onClearAll && (
            <button
              onClick={onClearAll}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--primary-500)] transition-colors"
            >
              清除全部
            </button>
          )}
        </div>

        {/* Not connected warning */}
        {!isMatrixConnected && (
          <div className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>请先登录 OPC 工作台以接收消息</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGoToWorkbench}
              className="mt-2 text-[var(--primary-500)]"
            >
              进入工作台
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Invitations Section */}
        {isMatrixConnected && invitations.length > 0 && (
          <div className="border-b border-[var(--border-default)]">
            <div className="px-4 py-2 bg-violet-500/10 text-xs text-violet-400 font-medium flex items-center gap-2">
              <UserPlus className="w-3.5 h-3.5" />
              房间邀请 ({invitations.length})
            </div>
            <div className="max-h-[200px] overflow-y-auto">
              {invitations.map((invite: MatrixInvitation) => (
                <div
                  key={invite.roomId}
                  className="px-4 py-3 hover:bg-[var(--bg-muted)] transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {invite.roomName}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] mt-1">
                        邀请人: {invite.inviterName || invite.inviterId}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-green-500 hover:text-green-400 hover:bg-green-500/10"
                        disabled={processingInvite === invite.roomId}
                        onClick={() => handleAcceptInvite(invite.roomId)}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                        disabled={processingInvite === invite.roomId}
                        onClick={() => handleRejectInvite(invite.roomId)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {isMatrixConnected && invitations.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>暂无新消息</p>
          </div>
        )}

        <DropdownMenuSeparator className="bg-[var(--border-default)]" />

        {/* Footer */}
        <DropdownMenuItem
          className="px-4 py-2 text-[var(--text-muted)] focus:text-[var(--text-primary)] focus:bg-[var(--bg-muted)] cursor-pointer"
          onClick={handleGoToWorkbench}
        >
          <Settings className="w-4 h-4 mr-2" />
          OPC 工作台
          <ChevronRight className="w-4 h-4 ml-auto" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default NotificationDropdown;