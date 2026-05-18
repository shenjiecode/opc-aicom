import { useState, useRef, useEffect } from "react";
import { useMatrix } from "@/contexts/MatrixContext";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Hash,
  Users,
  MessageSquare,
  Bot,
  LogIn,
  Pencil,
  Circle,
} from "lucide-react";

interface MatrixRoomListProps {
  className?: string;
}

export function MatrixRoomList({ className }: MatrixRoomListProps) {
  const { allRooms, currentRoom, selectRoom, createRoom, isLoading, workers, joinRoom, renameRoom } = useMatrix();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomTopic, setNewRoomTopic] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);

  // Rename state
  const [renamingRoomId, setRenamingRoomId] = useState<string | null>(null);
  const [renamingValue, setRenamingValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingRoomId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingRoomId]);

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;

    setIsCreating(true);
    try {
      await createRoom(newRoomName, newRoomTopic || undefined);
      setShowCreateModal(false);
      setNewRoomName("");
      setNewRoomTopic("");
    } catch (error) {
      console.error("Failed to create room:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async (roomId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setJoiningRoomId(roomId);
    try {
      await joinRoom(roomId);
    } catch (error) {
      console.error("Failed to join room:", error);
    } finally {
      setJoiningRoomId(null);
    }
  };

  const handleStartRename = (roomId: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingRoomId(roomId);
    setRenamingValue(currentName);
  };

  const handleFinishRename = async () => {
    if (renamingRoomId && renamingValue.trim()) {
      try {
        await renameRoom(renamingRoomId, renamingValue.trim());
      } catch (error) {
        console.error("Failed to rename room:", error);
      }
    }
    setRenamingRoomId(null);
    setRenamingValue("");
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleFinishRename();
    } else if (e.key === "Escape") {
      setRenamingRoomId(null);
      setRenamingValue("");
    }
  };

  // Check if a non-worker member is online by matching against workers list
  const isMemberOnline = (userId: string): boolean => {
    const worker = workers.find(w => w.userId === userId);
    return worker?.isOnline ?? false;
  };

  const displayRooms = allRooms.length > 0 ? allRooms : [];

  return (
    <Card className={cn("bg-[#1a1b26] border-slate-800", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-violet-400" />
            <CardTitle className="text-sm font-medium text-slate-300">
              房间列表
            </CardTitle>
            <span className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
              {displayRooms.length}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-slate-400 hover:text-white"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <div className="px-4 pb-4 space-y-1">
        {isLoading ? (
          <div className="text-xs text-slate-500 text-center py-4">
            加载中...
          </div>
        ) : displayRooms.length === 0 ? (
          <div className="text-xs text-slate-500 text-center py-4">
            暂无房间，点击 + 创建
          </div>
        ) : (
          displayRooms.map((room) => {
            const isJoined = room.joined !== false;
            const isCurrentRoom = currentRoom?.roomId === room.roomId;
            const isRenaming = renamingRoomId === room.roomId;

            // Separate workers and human members
            const workerMembers = room.members.filter(userId =>
              workers.some(w => w.userId === userId)
            );
            const humanMembers = room.members.filter(userId =>
              !workers.some(w => w.userId === userId)
            );

            return (
              <div
                key={room.roomId}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left",
                  isCurrentRoom
                    ? "bg-violet-500/20 text-white border border-violet-500/30"
                    : isJoined
                      ? "hover:bg-slate-800/50 text-slate-300 cursor-pointer"
                      : "hover:bg-slate-800/30 text-slate-400 cursor-pointer"
                )}
                onClick={() => isJoined && !isRenaming && selectRoom(room.roomId)}
              >
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                  isJoined ? "bg-slate-700" : "bg-slate-800"
                )}>
                  {room.avatarUrl ? (
                    <img
                      src={room.avatarUrl}
                      alt={room.name}
                      className="w-8 h-8 rounded-lg object-cover"
                    />
                  ) : (
                    <Hash className={cn("w-4 h-4", isJoined ? "text-slate-400" : "text-slate-600")} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {/* Room name with rename support */}
                  {isRenaming ? (
                    <input
                      ref={renameInputRef}
                      type="text"
                      value={renamingValue}
                      onChange={(e) => setRenamingValue(e.target.value)}
                      onBlur={handleFinishRename}
                      onKeyDown={handleRenameKeyDown}
                      className="w-full bg-[#242636] border border-violet-500 rounded px-2 py-0.5 text-sm text-white focus:outline-none"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div className="flex items-center gap-1.5 group">
                      <span className="text-sm font-medium truncate">{room.name}</span>
                      {isJoined && (
                        <button
                          onClick={(e) => handleStartRename(room.roomId, room.name, e)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        >
                          <Pencil className="w-3 h-3 text-slate-500 hover:text-violet-400" />
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-xs text-slate-500 flex-wrap mt-1">
                    {!isJoined && (
                      <span className="text-amber-500 text-[10px] mr-1">未加入</span>
                    )}
                    {/* Worker member badges */}
                    {workerMembers.slice(0, 3).map(userId => {
                      const worker = workers.find(w => w.userId === userId);
                      return (
                        <div
                          key={userId}
                          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400"
                        >
                          <Bot className="w-2.5 h-2.5 shrink-0" />
                          <span className="text-[10px] truncate max-w-[60px]">{worker?.name || userId.split(':')[0].replace('@', '')}</span>
                        </div>
                      );
                    })}
                    {/* Human member badges with online status */}
                    {humanMembers.slice(0, 4).map(userId => {
                      const online = isMemberOnline(userId);
                      return (
                        <div
                          key={userId}
                          className={cn(
                            "flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px]",
                            online
                              ? "bg-blue-500/20 text-blue-400"
                              : "bg-slate-800 text-slate-400"
                          )}
                        >
                          <Circle className={cn("w-1.5 h-1.5 shrink-0", online ? "fill-blue-400 text-blue-400" : "fill-slate-500 text-slate-500")} />
                          <Users className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate max-w-[60px]">
                            {userId.split(':')[0].replace('@', '')}
                          </span>
                        </div>
                      );
                    })}
                    {room.members.length > 7 && (
                      <div className="flex items-center px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                        +{room.members.length - 7}
                      </div>
                    )}
                  </div>
                </div>
                {room.unreadCount > 0 && (
                  <div className="w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
                    <span className="text-xs text-white">
                      {room.unreadCount > 99 ? "99+" : room.unreadCount}
                    </span>
                  </div>
                )}
                {!isJoined && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 shrink-0"
                    disabled={joiningRoomId === room.roomId}
                    onClick={(e) => handleJoinRoom(room.roomId, e)}
                  >
                    <LogIn className="w-3 h-3 mr-1" />
                    {joiningRoomId === room.roomId ? "加入中" : "加入"}
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1a1b26] border border-slate-800 rounded-xl p-6 w-96 max-w-full shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-4">
              创建新房间
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  房间名称
                </label>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="输入房间名称..."
                  className="w-full bg-[#242636] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  房间主题（可选）
                </label>
                <input
                  type="text"
                  value={newRoomTopic}
                  onChange={(e) => setNewRoomTopic(e.target.value)}
                  placeholder="输入房间主题..."
                  className="w-full bg-[#242636] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="ghost"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                取消
              </Button>
              <Button
                onClick={handleCreateRoom}
                disabled={!newRoomName.trim() || isCreating}
                className="bg-violet-600 hover:bg-violet-500 text-white"
              >
                {isCreating ? "创建中..." : "创建"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
