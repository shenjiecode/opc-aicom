import { useState } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Bell,
  UserPlus,
  MessageSquare,
  Check,
  X,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMatrix } from "@/contexts/MatrixContext";

// Types are inferred from MatrixContext
type MatrixInvitation = {
  roomId: string;
  roomName: string;
  inviterId: string;
  inviterName?: string;
  timestamp: number;
};

type MatrixNotification = {
  type: 'invitation' | 'message' | 'system';
  id: string;
  roomId?: string;
  roomName?: string;
  content?: string;
  senderId?: string;
  senderName?: string;
  timestamp: number;
  read: boolean;
};

interface MessageCenterProps {
  className?: string;
}

export function MessageCenter({ className }: MessageCenterProps) {
  const {
    invitations,
    notifications,
    acceptInvitation,
    rejectInvitation,
    markNotificationRead,
    clearAllNotifications,
    isInitialized,
  } = useMatrix();

  const [processingInvite, setProcessingInvite] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"invitations" | "notifications">("invitations");

  const handleAcceptInvite = async (roomId: string) => {
    setProcessingInvite(roomId);
    try {
      await acceptInvitation(roomId);
    } catch (error) {
      console.error("Failed to accept invitation:", error);
    } finally {
      setProcessingInvite(null);
    }
  };

  const handleRejectInvite = async (roomId: string) => {
    setProcessingInvite(roomId);
    try {
      await rejectInvitation(roomId);
    } catch (error) {
      console.error("Failed to reject invitation:", error);
    } finally {
      setProcessingInvite(null);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return "刚刚";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    return date.toLocaleDateString();
  };

  const totalUnread = invitations.length + notifications.filter(n => !n.read).length;

  if (!isInitialized) {
    return (
      <Card className={cn("bg-[#1a1b26] border-slate-800", className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-slate-400" />
            <CardTitle className="text-sm font-medium text-slate-300">消息中心</CardTitle>
          </div>
        </CardHeader>
        <div className="px-4 pb-4 text-center text-xs text-slate-500 py-4">
          Matrix 未连接
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("bg-[#1a1b26] border-slate-800", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-violet-400" />
            <CardTitle className="text-sm font-medium text-slate-300">
              消息中心
            </CardTitle>
            {totalUnread > 0 && (
              <span className="text-xs bg-violet-500 text-white px-1.5 py-0.5 rounded-full">
                {totalUnread}
              </span>
            )}
          </div>
          {totalUnread > 0 && (
            <button
              onClick={clearAllNotifications}
              className="text-xs text-slate-500 hover:text-violet-400 transition-colors"
            >
              清除
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setActiveTab("invitations")}
            className={cn(
              "flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors",
              activeTab === "invitations"
                ? "bg-violet-500/20 text-violet-400"
                : "text-slate-500 hover:text-slate-300"
            )}
          >
            <UserPlus className="w-3 h-3" />
            邀请 {invitations.length > 0 && `(${invitations.length})`}
          </button>
          <button
            onClick={() => setActiveTab("notifications")}
            className={cn(
              "flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors",
              activeTab === "notifications"
                ? "bg-blue-500/20 text-blue-400"
                : "text-slate-500 hover:text-slate-300"
            )}
          >
            <MessageSquare className="w-3 h-3" />
            消息 {notifications.filter(n => !n.read).length > 0 && `(${notifications.filter(n => !n.read).length})`}
          </button>
        </div>
      </CardHeader>

      {/* Content */}
      <div className="px-4 pb-4 max-h-[250px] overflow-y-auto">
        {activeTab === "invitations" && (
          <>
            {invitations.length === 0 ? (
              <div className="text-center text-xs text-slate-500 py-4">
                <UserPlus className="w-6 h-6 mx-auto mb-2 opacity-50" />
                暂无待处理的邀请
              </div>
            ) : (
              <div className="space-y-2">
                {invitations.map((invite: MatrixInvitation) => (
                  <div
                    key={invite.roomId}
                    className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {invite.roomName}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(invite.timestamp)}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          邀请人: {invite.inviterName || invite.inviterId}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-green-500 hover:text-green-400 hover:bg-green-500/10"
                          disabled={processingInvite === invite.roomId}
                          onClick={() => handleAcceptInvite(invite.roomId)}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-400 hover:bg-red-500/10"
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
            )}
          </>
        )}

        {activeTab === "notifications" && (
          <>
            {notifications.filter(n => !n.read).length === 0 ? (
              <div className="text-center text-xs text-slate-500 py-4">
                <MessageSquare className="w-6 h-6 mx-auto mb-2 opacity-50" />
                暂无新消息
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.filter(n => !n.read).map((notification: MatrixNotification) => (
                  <div
                    key={notification.id}
                    className="bg-slate-800/50 rounded-lg p-3 border border-slate-700/50 cursor-pointer hover:bg-slate-800/70 transition-colors"
                    onClick={() => markNotificationRead(notification.id)}
                  >
                    <div className="flex items-start gap-2">
                      <div className={cn(
                        "w-2 h-2 rounded-full mt-1.5 shrink-0",
                        notification.read ? "bg-slate-600" : "bg-blue-500"
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-200 line-clamp-2">
                          {notification.content}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                          <span>{notification.roomName || "系统"}</span>
                          <span>•</span>
                          <span>{formatTime(notification.timestamp)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}

export default MessageCenter;