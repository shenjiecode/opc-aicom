import { useEffect, useState } from "react";
import { useMatrix } from "@/contexts/MatrixContext";
import type { MatrixWorker } from "@/contexts/MatrixContext";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WorkerConfigDialog } from "./WorkerConfigDialog";
import type { WorkerConfig } from "./WorkerConfigDialog";
import {
  Bot,

  LogIn,
  CheckCircle2,
  Circle,
  Settings,
} from "lucide-react";

interface WorkerStatusPanelProps {
  className?: string;
}

export function WorkerStatusPanel({ className }: WorkerStatusPanelProps) {
  const { workers, refreshWorkers, rooms, joinWorkerToRoom, accessToken, allRooms, sendMessageToRoom, client } = useMatrix();
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<string>("");
  const [isJoining, setIsJoining] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configWorker, setConfigWorker] = useState<MatrixWorker | null>(null);

  // Fetch workers on mount and when accessToken changes
  useEffect(() => {
    if (accessToken) {
      refreshWorkers();
    }
  }, [accessToken, refreshWorkers]);

  const handleJoinWorker = async () => {
    if (!selectedWorker || !selectedRoom) return;
    
    setIsJoining(true);
    try {
      await joinWorkerToRoom(selectedWorker, selectedRoom);
      setShowJoinModal(false);
      setSelectedWorker(null);
      setSelectedRoom("");
    } catch (error) {
      console.error("Failed to join worker to room:", error);
    } finally {
      setIsJoining(false);
    }
  };

  const openJoinModal = (workerId: string) => {
    setSelectedWorker(workerId);
    setShowJoinModal(true);
  };

  const openConfigModal = (worker: MatrixWorker) => {
    setConfigWorker(worker);
    setShowConfigModal(true);
  };

  const handleSaveConfig = async (config: WorkerConfig) => {
    if (!configWorker) return;
    
    const configJson = JSON.stringify({
      apiKey: config.llm.apiKey,
      baseUrl: config.llm.baseUrl,
      model: config.llm.model,
      smtpHost: config.smtp.host,
      smtpPort: config.smtp.port,
      smtpUser: config.smtp.user,
      smtpPass: config.smtp.pass,
    });
    
    // Find a room that the worker is in
    const workerRoom = configWorker.rooms[0];
    if (!workerRoom) {
      console.error("Worker has no rooms");
      throw new Error("Worker has no rooms");
    }
    
    try {
      // Send config message to worker via Matrix
      const configMessage = `@${configWorker.workerId} CONFIG_JSON:${configJson}`;
      await sendMessageToRoom(workerRoom, configMessage);
      console.log('[WorkerConfig] Config sent to', configWorker.workerId);
    } catch (error) {
      console.error('[WorkerConfig] Failed to send config:', error);
      throw error;
    }
  };

  // Use allRooms for the room selection dropdown
  const availableRooms = allRooms.length > 0 ? allRooms : rooms;

  return (
    <Card className={cn("bg-[#1a1b26] border-slate-800", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-emerald-400" />
            <CardTitle className="text-sm font-medium text-slate-300">
              Workers 状态
            </CardTitle>
          </div>
        </div>
      </CardHeader>

      <div className="px-4 pb-4 space-y-3">
        {workers.length === 0 ? (
          <div className="text-xs text-slate-500 text-center py-4">
            暂无 Worker，请检查配置
          </div>
        ) : (
          workers.map((worker) => (
            <div
              key={worker.workerId}
              className="bg-slate-800/50 rounded-lg p-3"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">
                    {worker.name}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    {worker.isOnline ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">在线</span>
                      </>
                    ) : (
                      <>
                        <Circle className="w-3 h-3 text-slate-500" />
                        <span className="text-slate-500">离线</span>
                      </>
                    )}
                  </div>
                </div>
                {/* Settings and Join Room buttons per worker */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-slate-400 hover:text-white hover:bg-slate-700"
                    onClick={() => openConfigModal(worker)}
                    title="配置"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                    onClick={() => openJoinModal(worker.workerId)}
                  >
                    <LogIn className="w-3 h-3 mr-1" />
                    加入房间
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Join Worker Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1a1b26] border border-slate-800 rounded-xl p-6 w-96 max-w-full shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-4">
              添加 Worker 到房间
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Worker
                </label>
                <div className="w-full bg-[#242636] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white">
                  {workers.find(w => w.workerId === selectedWorker)?.name || selectedWorker}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  选择房间
                </label>
                <select
                  value={selectedRoom}
                  onChange={(e) => setSelectedRoom(e.target.value)}
                  className="w-full bg-[#242636] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">请选择...</option>
                  {availableRooms.map((room) => (
                    <option key={room.roomId} value={room.roomId}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowJoinModal(false);
                  setSelectedWorker(null);
                  setSelectedRoom("");
                }}
                className="text-slate-400 hover:text-white"
              >
                取消
              </Button>
              <Button
                onClick={handleJoinWorker}
                disabled={!selectedWorker || !selectedRoom || isJoining}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {isJoining ? "添加中..." : "添加"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Config Modal */}
      {showConfigModal && configWorker && (
<WorkerConfigDialog
worker={configWorker}
roomId={configWorker.rooms[0] || ""}
client={client}
sendMessageToRoom={sendMessageToRoom}
isOpen={showConfigModal}
onClose={() => {
setShowConfigModal(false);
setConfigWorker(null);
}}
onSave={handleSaveConfig}
/>
      )}
    </Card>
  );
}