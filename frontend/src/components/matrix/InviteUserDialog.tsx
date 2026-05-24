import { useState, useMemo } from "react";
import { useMatrix } from "@/contexts/MatrixContext";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, UserPlus, Check, AlertCircle, Loader2, User } from "lucide-react";

interface InviteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
  roomName: string;
  existingMembers: string[];
}

export function InviteUserDialog({
  open,
  onOpenChange,
  roomId,
  roomName,
  existingMembers,
}: InviteUserDialogProps) {
  const { users, inviteUser, refreshUsers } = useMatrix();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [isInviting, setIsInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteProgress, setInviteProgress] = useState<{ current: number; total: number } | null>(null);
  const [inviteResults, setInviteResults] = useState<{ success: string[]; failed: Map<string, string> } | null>(null);

  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(
      (user) =>
        user.userId.toLowerCase().includes(query) ||
        user.displayName?.toLowerCase().includes(query) ||
        user.name.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  // Check if user is already in room
  const isUserInRoom = (userId: string) => {
    return existingMembers.includes(userId);
  };

  // Toggle user selection
  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const handleInvite = async () => {
    if (selectedUsers.size === 0) return;

    const usersToInvite = Array.from(selectedUsers);
    const total = usersToInvite.length;
    const successUsers: string[] = [];
    const failedUsers = new Map<string, string>();

    setIsInviting(true);
    setInviteError(null);
    setInviteSuccess(false);
    setInviteResults(null);

    try {
      for (let i = 0; i < total; i++) {
        setInviteProgress({ current: i + 1, total });
        const userId = usersToInvite[i];
        try {
          await inviteUser(roomId, userId);
          successUsers.push(userId);
        } catch (error) {
          failedUsers.set(
            userId,
            error instanceof Error ? error.message : "邀请失败"
          );
        }
      }

      setInviteProgress(null);
      setInviteResults({ success: successUsers, failed: failedUsers });

      if (failedUsers.size === 0) {
        setInviteSuccess(true);
        await refreshUsers();
        setTimeout(() => {
          setInviteSuccess(false);
          setSelectedUsers(new Set());
          setSearchQuery("");
          onOpenChange(false);
        }, 1500);
      }
    } catch (error) {
      setInviteError(
        error instanceof Error ? error.message : "邀请失败，请重试"
      );
    } finally {
      setIsInviting(false);
      setInviteProgress(null);
    }
  };

  const handleClose = () => {
    if (isInviting) return;
    setSearchQuery("");
    setSelectedUsers(new Set());
    setInviteError(null);
    setInviteSuccess(false);
    setInviteProgress(null);
    setInviteResults(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-[#1a1b26] border-slate-800 rounded-xl max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-lg font-semibold text-white flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-violet-400" />
            邀请用户加入房间
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-sm">
            邀请用户加入房间 &quot;{roomName}&quot;
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              placeholder="搜索用户 ID 或名称..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-[#242636] border-slate-700 text-white placeholder:text-slate-500 focus:border-violet-500 rounded-lg"
            />
          </div>

          {/* User List */}
          <div className="border border-slate-800 rounded-lg overflow-hidden bg-[#242636]">
            {/* Selection Counter */}
            {selectedUsers.size > 0 && (
              <div className="px-4 py-2 bg-violet-500/20 border-b border-slate-800 text-sm text-violet-300">
                已选择 {selectedUsers.size} 个用户
              </div>
            )}
            <div className="max-h-[300px] overflow-y-auto">
              {filteredUsers.length === 0 ? (
                <div className="p-8 text-center">
                  <User className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">
                    {searchQuery ? "无匹配用户" : "暂无可用用户"}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {filteredUsers.map((user) => {
                    const alreadyInRoom = isUserInRoom(user.userId);
                    const isSelected = selectedUsers.has(user.userId);

                    return (
                      <button
                        key={user.userId}
                        onClick={() => !alreadyInRoom && toggleUserSelection(user.userId)}
                        disabled={alreadyInRoom}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                          alreadyInRoom
                            ? "opacity-50 cursor-not-allowed bg-slate-800/30"
                            : isSelected
                              ? "bg-violet-500/20 hover:bg-violet-500/30"
                              : "hover:bg-slate-800/50"
                        )}
                      >
                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-slate-400" />
                        </div>

                        {/* User Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white truncate">
                              {user.displayName || user.name}
                            </span>
                            {alreadyInRoom && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 shrink-0">
                                已加入
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 truncate">
                            {user.userId}
                          </p>
                        </div>

                        {/* Online Status */}
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full shrink-0",
                            user.isOnline ? "bg-green-400" : "bg-slate-600"
                          )}
                          title={user.isOnline ? "在线" : "离线"}
                        />

                        {/* Selection Indicator (Checkbox Style) */}
                        {!alreadyInRoom && (
                          <div
                            className={cn(
                              "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                              isSelected
                                ? "border-violet-500 bg-violet-500"
                                : "border-slate-600 hover:border-violet-400"
                            )}
                          >
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Invite Results */}
          {inviteResults && (
            <div className="text-sm bg-slate-800/50 rounded-lg px-3 py-2">
              <div className="text-green-400 mb-1">
                成功: {inviteResults.success.length} 人
              </div>
              {inviteResults.failed.size > 0 && (
                <div className="text-red-400">
                  失败: {inviteResults.failed.size} 人
                  <span className="text-slate-400 text-xs ml-2">
                    ({Array.from(inviteResults.failed.keys()).join(", ")})
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {inviteError && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{inviteError}</span>
            </div>
          )}

          {/* Success Message */}
          {inviteSuccess && (
            <div className="flex items-center gap-2 text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>邀请发送成功！</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={handleClose}
              disabled={isInviting}
              className="text-slate-400 hover:text-white hover:bg-slate-800"
            >
              取消
            </Button>
            <Button
              onClick={handleInvite}
              disabled={selectedUsers.size === 0 || isInviting || inviteSuccess}
              className="bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isInviting && inviteProgress ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  邀请中 ({inviteProgress.current}/{inviteProgress.total})...
                </>
              ) : inviteSuccess ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  已发送
                </>
              ) : (
                <>发送邀请 ({selectedUsers.size})</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
