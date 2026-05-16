import { useEffect, useState, useRef } from "react";
import { useMatrix } from "@/contexts/MatrixContext";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Terminal, Trash2 } from "lucide-react";

interface LogEntry {
  id: string;
  timestamp: Date;
  type: "join" | "leave" | "message" | "system";
  userId: string;
  userName: string;
  roomId: string;
  roomName: string;
  action: string;
}

interface ServerLogTerminalProps {
  className?: string;
}

export function ServerLogTerminal({ className }: ServerLogTerminalProps) {
  const { client, isInitialized, rooms } = useMatrix();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  const logIdRef = useRef(0);

  // Auto scroll to bottom when new logs arrive
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Listen to Matrix events
  useEffect(() => {
    if (!client || !isInitialized) return;

    const addLog = (
      type: LogEntry["type"],
      userId: string,
      roomId: string,
      action: string
    ) => {
      const room = rooms.find((r) => r.roomId === roomId);
      const userName = userId.split(":")[0].replace("@", "");

      const entry: LogEntry = {
        id: `log-${++logIdRef.current}`,
        timestamp: new Date(),
        type,
        userId,
        userName,
        roomId,
        roomName: room?.name || roomId,
        action,
      };

      setLogs((prev) => [...prev.slice(-99), entry]); // Keep last 100 entries
    };

    // Listen to timeline events for messages
    const handleTimelineEvent = (event: unknown, room: unknown) => {
      const evt = event as {
        getType: () => string;
        getSender: () => string;
        getContent: () => { body?: string; msgtype?: string; membership?: string };
        getTs: () => number;
      };
      const roomObj = room as { roomId: string } | undefined;
      if (!roomObj) return;

      const type = evt.getType();

      if (type === "m.room.member") {
        const sender = evt.getSender();
        const roomId = roomObj.roomId;
        const content = evt.getContent();
        const membership = content.membership;

        if (membership === "join") {
          addLog("join", sender, roomId, "加入房间");
        } else if (membership === "leave") {
          addLog("leave", sender, roomId, "离开房间");
        }
      } else if (type === "m.room.message") {
        const sender = evt.getSender();
        const roomId = roomObj.roomId;
        const content = evt.getContent();
        const body = content.body || "";
        // Skip STATUS messages (they're system internal)
        if (body.startsWith("STATUS:")) return;
        // Truncate long messages
        const displayBody = body.length > 50 ? body.slice(0, 50) + "..." : body;
        addLog("message", sender, roomId, `说: ${displayBody}`);
      }
    };

    client.on("Room.timeline" as never, handleTimelineEvent as never);

    // Add initial system log
    addLog("system", "@system", "system", "日志终端已启动");

    return () => {
      client.removeListener("Room.timeline" as never, handleTimelineEvent as never);
    };
  }, [client, isInitialized, rooms]);

  const clearLogs = () => {
    setLogs([]);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getLogColor = (type: LogEntry["type"]) => {
    switch (type) {
      case "join":
        return "text-emerald-400";
      case "leave":
        return "text-amber-400";
      case "message":
        return "text-violet-400";
      case "system":
        return "text-slate-400";
      default:
        return "text-slate-300";
    }
  };

  const getLogIcon = (type: LogEntry["type"]) => {
    switch (type) {
      case "join":
        return "→";
      case "leave":
        return "←";
      case "message":
        return "💬";
      case "system":
        return "⚙";
      default:
        return "•";
    }
  };

  return (
    <Card className={cn("bg-[#1a1b26] border-slate-800 flex flex-col", className)}>
      <CardHeader className="pb-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <CardTitle className="text-sm font-medium text-slate-300">
              Server Log
            </CardTitle>
            <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">
              {logs.length} 条记录
            </span>
          </div>
          <button
            onClick={clearLogs}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
            清空
          </button>
        </div>
      </CardHeader>

      {/* Log Terminal */}
      <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-4 font-mono text-xs scrollbar-thin">
        <div className="bg-[#0d0e14] rounded-lg p-3 h-full">
          {logs.length === 0 ? (
            <div className="text-slate-500 text-center py-4">
              等待事件...
            </div>
          ) : (
            <div className="space-y-1.5">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={cn("flex items-start gap-2", getLogColor(log.type))}
                >
                  <span className="text-slate-500 shrink-0">
                    [{formatTime(log.timestamp)}]
                  </span>
                  <span className="shrink-0">{getLogIcon(log.type)}</span>
                  <span className="break-all">
                    <span className="font-semibold">{log.userName}</span>
                    <span className="text-slate-400 mx-1">{log.action}</span>
                    <span className="text-violet-300">#{log.roomName}</span>
                  </span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
