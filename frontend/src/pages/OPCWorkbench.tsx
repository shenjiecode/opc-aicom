import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bot,
  Users,
  Zap,
  MoreHorizontal,
  RefreshCw,
  WifiOff,
  User,
  AtSign,
  Circle,
} from "lucide-react";
import { useMatrix } from "@/contexts/MatrixContext";
import { MatrixRoomList, MatrixChat, WorkerStatusPanel, ServerLogTerminal, MatrixUserList } from "@/components/matrix";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

export default function OPCWorkbench() {
  const { user } = useAuth();
  const location = useLocation();
  const {
    isInitialized,
    isLoading,
    error,
    initialize,
    currentRoom,
    selectRoom,
    workers,
    homeserverUrl,
    matrixUserId,
    userOnline,
    updateActivity,
  } = useMatrix();

  useEffect(() => {
    const handleActivity = () => {
      updateActivity();
    };
    
    // Listen for user activity
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);
    
    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', handleActivity);
    };
  }, [updateActivity]);

  // Initialize Matrix client on mount
  useEffect(() => {
    if (user && !isInitialized && !isLoading) {
      initialize();
    }
    
    return () => {
      // Don't disconnect on unmount to preserve connection
    };
  }, [user, isInitialized, isLoading, initialize]);
  
  // Select room from URL parameter
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const roomId = params.get('room');
    if (roomId && isInitialized && selectRoom) {
      // Wait a bit for rooms to load
      setTimeout(() => {
        selectRoom(roomId);
      }, 500);
    }
  }, [location.search, isInitialized, selectRoom]);

  return (
    <div className="h-screen bg-[#0a0a0f] p-4 lg:p-6 flex flex-col overflow-hidden">
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 flex-1 min-h-0 h-full">
        {/* Left Panel: AI Team & Rooms */}
        <div className="w-full lg:w-72 flex flex-col gap-6 overflow-y-auto scrollbar-thin shrink-0 pb-4">
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

              {/* User identity info */}

              {user && (
                <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-1.5">
                  {/* User info with online status */}
                  <div className="flex items-center gap-2 text-xs">
                    <User className="w-3.5 h-3.5 text-violet-400" />
                    <span className="text-slate-400">OPC:</span>
                    <span className="text-white font-medium">{user.username}</span>
                    {/* Online status indicator */}
                    <div className="flex items-center gap-1 ml-auto">
                      <Circle className={cn(
                        "w-2 h-2",
                        userOnline ? "fill-green-500 text-green-500" : "fill-slate-500 text-slate-500"
                      )} />
                      <span className={cn(
                        "font-medium",
                        userOnline ? "text-green-400" : "text-slate-500"
                      )}>
                        {userOnline ? "在线" : "离线"}
                      </span>
                    </div>
                  </div>
                  {matrixUserId && (
                    <div className="flex items-center gap-2 text-xs">
                      <AtSign className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-slate-400">Matrix:</span>
                      <span className="text-emerald-400 font-medium">{matrixUserId.split(':')[0].replace('@', '')}</span>
                      {/* Matrix online indicator */}
                      {isInitialized && (
                        <div className="flex items-center gap-1 ml-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span className="text-emerald-400 text-[10px]">已连接</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

            </CardHeader>

          </Card>

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
                      <span className="text-slate-500 ml-1">
                        | {homeserverUrl ? homeserverUrl.replace('http://', '').replace('https://', '') : 'localhost:8008'}
                      </span>
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




          {/* Matrix Room List - Replaces static AI Agents list */}
          <MatrixRoomList className="flex-1" />



          {/* Worker Status Panel */}
          <WorkerStatusPanel />

          {/* Server User List */}
          <MatrixUserList />
        </div>

        {/* Middle Panel: Matrix Chat */}
        <div className="flex-1 flex flex-col min-h-0">
          <MatrixChat className="flex-1" />
        </div>

        {/* Right Panel: Status & Analytics */}
        <div className="w-full lg:w-80 flex flex-col gap-6 overflow-y-auto scrollbar-thin shrink-0 pb-4">
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
                  {/* Members in this room */}
                  {currentRoom.members.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-violet-500/20">
                      <div className="text-xs text-slate-400 mb-2">房间成员:</div>
                      <div className="flex flex-wrap gap-2">
                        {currentRoom.members.map(userId => {
                          const worker = workers.find(w => w.userId === userId);
                          if (worker) {
                            return (
                              <div key={userId} className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs">
                                <Bot className="w-3 h-3 shrink-0" />
                                <span className="truncate max-w-[100px]">{worker.name}</span>
                              </div>
                            );
                          }
                          return (
                            <div key={userId} className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 text-slate-300 text-xs">
                              <Users className="w-3 h-3 shrink-0" />
                              <span className="truncate max-w-[100px]">{userId.split(':')[0].replace('@', '')}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </CardHeader>
            </Card>
          )}

          {/* Server Log Terminal */}
          <ServerLogTerminal className="h-[300px] shrink-0" />
        </div>
      </div>
    </div>
  );
}
