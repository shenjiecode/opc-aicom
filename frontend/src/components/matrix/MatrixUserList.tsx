import { useMatrix } from "@/contexts/MatrixContext";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Circle, RefreshCw, Bot } from "lucide-react";

interface MatrixUserListProps {
  className?: string;
}

export function MatrixUserList({ className }: MatrixUserListProps) {
  const { users, workers, refreshUsers, isLoading } = useMatrix();

  // Check if a user is a worker
  const isWorker = (userId: string): boolean => {
    return workers.some(w => w.userId === userId);
  };

  // Check if worker is online
  const isWorkerOnline = (userId: string): boolean => {
    const worker = workers.find(w => w.userId === userId);
    return worker?.isOnline ?? false;
  };

  return (
    <Card className={cn("bg-[#1a1b26] border-slate-800", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            <CardTitle className="text-sm font-medium text-slate-300">
              服务器用户
            </CardTitle>
            <span className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
              {users.length}
            </span>
          </div>
          <button
            onClick={refreshUsers}
            className="h-7 w-7 p-0 text-slate-400 hover:text-white hover:bg-slate-800 rounded flex items-center justify-center"
            disabled={isLoading}
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </button>
        </div>
      </CardHeader>

      <div className="px-4 pb-4 space-y-1 max-h-[200px] overflow-y-auto scrollbar-thin">
        {users.length === 0 ? (
          <div className="text-xs text-slate-500 text-center py-4">
            暂无用户数据
          </div>
        ) : (
          users.map((user) => {
            const worker = isWorker(user.userId);
            // Non-worker users are assumed online (they must be logged in to appear)
            const online = worker ? isWorkerOnline(user.userId) : true;
            const displayName = user.displayName || user.name || user.userId.split(':')[0].replace('@', '');
            return (
              <div
                key={user.userId}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition-colors"
              >
                <Circle
                  className={cn(
                    "w-2 h-2 shrink-0",
                    online ? "fill-green-500 text-green-500" : "fill-slate-500 text-slate-500"
                  )}
                />
                {worker && <Bot className="w-3 h-3 text-emerald-400 shrink-0" />}
                {!worker && <Users className="w-3 h-3 text-blue-400 shrink-0" />}
                <span className="text-xs text-slate-300 truncate">
                  {displayName}
                </span>
                {/* Online status badge for all users */}
                <span className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded ml-auto",
                  online ? "bg-green-500/20 text-green-400" : "bg-slate-700 text-slate-500"
                )}>
                  {online ? "在线" : "离线"}
                </span>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
