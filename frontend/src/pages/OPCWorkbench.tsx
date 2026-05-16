import { useEffect } from "react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bot,
  Users,
  Zap,
  MoreHorizontal,
  RefreshCw,
  WifiOff,
} from "lucide-react";
import { useMatrix } from "@/contexts/MatrixContext";
import { MatrixRoomList, MatrixChat, WorkerStatusPanel, ServerLogTerminal } from "@/components/matrix";
import { useAuth } from "@/contexts/AuthContext";

export default function OPCWorkbench() {
  const { user } = useAuth();
const {
    isInitialized,
    isLoading,
    error,
    initialize,
    currentRoom,
    workers,
  } = useMatrix();

  // Initialize Matrix client on mount
  useEffect(() => {
    if (user && !isInitialized && !isLoading) {
      initialize();
    }
    
    return () => {
      // Don't disconnect on unmount to preserve connection
    };
  }, [user, isInitialized, isLoading, initialize]);


  return (
    <div className="min-h-screen bg-[#0a0a0f] p-4 lg:p-6 overflow-y-auto">
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* Left Panel: AI Team & Rooms */}
        <div className="w-full lg:w-72 flex flex-col gap-6">
          {/* Header Card */}
          <Card className="bg-[#1a1b26] border-slate-800">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-300 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-white text-base">
                    OPC Command Center
                  </CardTitle>
                  <p className="text-xs text-slate-400">AI 团队协作工作台</p>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Connection Status */}
          <Card className="bg-[#1a1b26] border-slate-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  {isLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-violet-400" />
                      <span>正在连接 Matrix...</span>
                    </>
                  ) : isInitialized ? (
                    <>
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-emerald-400">Matrix 已连接</span>
                    </>
                  ) : error ? (
                    <>
                      <WifiOff className="w-3.5 h-3.5 text-red-400" />
                      <span className="text-red-400">连接失败</span>
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-3.5 h-3.5 text-slate-500" />
                      <span>未连接</span>
                    </>
                  )}
                </div>
                {!isInitialized && !isLoading && (
                  <button
                    onClick={initialize}
                    className="text-xs text-violet-400 hover:text-violet-300"
                  >
                    重试
                  </button>
                )}
              </div>
            </CardHeader>
          </Card>

          {/* CEO Panel */}
          <Card className="bg-[#1a1b26] border-slate-800">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                <Users className="w-3.5 h-3.5" />
                <span>CEO 指令台</span>
              </div>
              <div className="bg-gradient-to-br from-violet-500/20 to-violet-500/5 border border-violet-500/30 rounded-xl p-4 flex items-center gap-3 cursor-pointer hover:border-violet-500/50 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center text-lg">
                  🔥
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">
                    {user?.username || "你 (CEO)"}
                  </div>
                  <div className="text-xs text-violet-300">总指挥</div>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Matrix Room List - Replaces static AI Agents list */}
          <MatrixRoomList className="flex-1" />



          {/* Worker Status Panel */}
          <WorkerStatusPanel />
        </div>

        {/* Middle Panel: Matrix Chat */}
        <div className="flex-1 flex flex-col min-h-0">
          <MatrixChat className="flex-1" />
        </div>

        {/* Right Panel: Status & Analytics */}
        <div className="w-full lg:w-80 flex flex-col gap-6">
          {/* Current Room Info */}
          {currentRoom && (
            <Card className="bg-[#1a1b26] border-slate-800">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-4">
                  <MoreHorizontal className="w-3.5 h-3.5" />
                  <span>当前房间</span>
                </div>
                <div className="bg-violet-500/10 border border-violet-500/30 rounded-xl p-4">
                  <div className="text-lg font-semibold text-white mb-1">
                    # {currentRoom.name}
                  </div>
                  {currentRoom.topic && (
                    <div className="text-xs text-slate-400 mb-2">
                      {currentRoom.topic}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Users className="w-3.5 h-3.5" />
                    <span>{currentRoom.members.length} 成员</span>
                  </div>
                  {/* Workers in this room */}
                  {workers.filter(w => w.rooms.includes(currentRoom.roomId)).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-violet-500/20">
                      <div className="text-xs text-slate-400 mb-2">房间内 Workers:</div>
                      <div className="flex flex-wrap gap-2">
                        {workers.filter(w => w.rooms.includes(currentRoom.roomId)).map(w => (
                          <div key={w.workerId} className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs">
                            <Bot className="w-3 h-3" />
                            <span>{w.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardHeader>
            </Card>
          )}

          {/* Server Log Terminal */}
          <ServerLogTerminal className="flex-1 min-h-0" />
        </div>
      </div>
    </div>
  );
}
