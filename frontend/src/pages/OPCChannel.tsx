import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Hash,
  Bell,
  Settings,
  Users,
  Send,
  Plus,
  MoreHorizontal,
  Circle,
  RefreshCw,
  MessageSquare,
} from "lucide-react";
import { useMatrix } from "@/contexts/MatrixContext";
import { cn } from "@/lib/utils";

export default function OPCChannel() {
  const {
    rooms,
    currentRoom,
    messages,
    sendMessage,
    isInitialized,
    matrixUserId,
    workers,
    selectRoom,
    initialize,
  } = useMatrix();

  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter rooms by search
  const filteredRooms = rooms.filter((room) =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSend = async () => {
    if (!inputText.trim() || isSending) return;
    setIsSending(true);
    try {
      await sendMessage(inputText.trim());
      setInputText("");
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return "今天";
    }
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return "昨天";
    }
    return date.toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric",
    });
  };

  // Group messages by date
  const groupedMessages = messages.reduce<{ date: string; messages: typeof messages }[]>(
    (groups, message) => {
      const date = formatDate(message.timestamp);
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.date === date) {
        lastGroup.messages.push(message);
      } else {
        groups.push({ date, messages: [message] });
      }
      return groups;
    },
    []
  );

  return (
    <div className="min-h-screen bg-[#13141f] flex">
      {/* Server/Workspace Sidebar - Discord style narrow bar */}
      <div className="w-[72px] bg-[#1e1f2e] flex flex-col items-center py-3 shrink-0 gap-2">
        {/* Home Button */}
        <button
          className="w-12 h-12 rounded-2xl bg-violet-500 flex items-center justify-center hover:rounded-xl transition-all duration-200"
          title="首页"
        >
          <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center">
            <div className="w-3 h-3 bg-violet-500 rounded-full" />
          </div>
        </button>

        <div className="w-8 h-0.5 bg-slate-700 rounded-full" />

        {/* Workspace/Server Icons */}
        <button
          className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center hover:rounded-xl hover:bg-violet-500 transition-all duration-200 group"
          title="OPC 工作区"
        >
          <span className="text-slate-300 group-hover:text-white text-sm font-bold">OPC</span>
        </button>

        <button
          className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center hover:rounded-xl hover:bg-violet-500 transition-all duration-200 group"
          title="AI Agent 工作区"
        >
          <span className="text-slate-300 group-hover:text-white text-sm font-bold">AI</span>
        </button>

        {/* Add Server Button */}
        <button
          className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center hover:rounded-xl hover:bg-emerald-500 transition-all duration-200 group"
          title="添加工作区"
        >
          <Plus className="w-5 h-5 text-emerald-400 group-hover:text-white" />
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Settings Button */}
        <button
          className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center hover:rounded-xl hover:bg-slate-600 transition-all duration-200"
          title="设置"
        >
          <Settings className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      {/* Left Sidebar - Channel List */}
      <div className="w-60 bg-[#1a1b26] flex flex-col shrink-0 border-r border-slate-800">
        {/* Server Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <h1 className="font-bold text-white truncate">OPC Channels</h1>
          <button className="text-slate-400 hover:text-white">
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Channel List */}
        <div className="flex-1 overflow-y-auto py-2 px-2">
          {/* Search */}
          <div className="px-2 mb-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input
                className="pl-8 h-8 bg-[#13141f] border-slate-700 text-slate-300 placeholder:text-slate-500 text-sm"
                placeholder="搜索频道..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Channels */}
          <div className="space-y-0.5">
            <div className="text-xs font-semibold text-slate-500 px-2 py-1 uppercase">
              文字频道
            </div>
            {filteredRooms.map((room) => (
              <button
                key={room.roomId}
                onClick={() => selectRoom(room.roomId)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors text-left",
                  currentRoom?.roomId === room.roomId
                    ? "bg-violet-500/20 text-violet-400"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                )}
              >
                <Hash className="w-4 h-4 shrink-0" />
                <span className="truncate text-sm">{room.name}</span>
                {room.unreadCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-xs px-1.5 rounded-full min-w-[18px] text-center">
                    {room.unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* User Panel */}
        <div className="h-14 px-3 flex items-center gap-2 bg-[#13141f] border-t border-slate-800 shrink-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
            <span className="text-white text-xs font-bold">
              {matrixUserId ? matrixUserId.charAt(1).toUpperCase() : "?"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate">
              {matrixUserId ? matrixUserId.split(":")[0].replace("@", "") : "未登录"}
            </div>
            <div className="flex items-center gap-1">
              <Circle
                className={cn(
                  "w-2 h-2 fill-current",
                  isInitialized ? "text-emerald-400" : "text-slate-500"
                )}
              />
              <span className="text-xs text-slate-500">
                {isInitialized ? "在线" : "离线"}
              </span>
            </div>
          </div>
          <button className="text-slate-400 hover:text-white p-1">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Middle - Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Channel Header */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-slate-800 bg-[#13141f] shrink-0">
          <div className="flex items-center gap-2">
            <Hash className="w-5 h-5 text-slate-400" />
            <h2 className="font-bold text-white">
              {currentRoom?.name || "选择频道"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button className="text-slate-400 hover:text-white p-2">
              <Bell className="w-5 h-5" />
            </button>
            <button className="text-slate-400 hover:text-white p-2">
              <MoreHorizontal className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
          {!isInitialized ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <Users className="w-16 h-16 mb-4 opacity-50" />
              <p className="mb-4">正在连接 Matrix...</p>
              <Button onClick={initialize} variant="outline" size="sm">
                <RefreshCw className="w-4 h-4 mr-2" />
                连接
              </Button>
            </div>
          ) : !currentRoom ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <MessageSquare className="w-16 h-16 mb-4 opacity-50" />
              <p>选择一个频道开始聊天</p>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedMessages.map((group) => (
                <div key={group.date}>
                  {/* Date Separator */}
                  <div className="flex items-center justify-center my-4">
                    <div className="bg-slate-800 text-xs text-slate-500 px-3 py-1 rounded-full">
                      {group.date}
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="space-y-3">
                    {group.messages.map((message, index) => {
                      const showAvatar =
                        index === 0 ||
                        group.messages[index - 1].sender !== message.sender;

                      return (
                        <div
                          key={message.id}
                          className={cn(
                            "flex gap-3",
                            message.isOwn ? "flex-row-reverse" : ""
                          )}
                        >
                          {showAvatar ? (
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shrink-0">
                              <span className="text-white text-sm">
                                {message.senderName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          ) : (
                            <div className="w-9 shrink-0" />
                          )}

                          <div
                            className={cn(
                              "flex flex-col max-w-[70%]",
                              message.isOwn ? "items-end" : "items-start"
                            )}
                          >
                            {showAvatar && (
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium text-white">
                                  {message.isOwn ? "你" : message.senderName}
                                </span>
                                <span className="text-xs text-slate-500">
                                  {formatTime(message.timestamp)}
                                </span>
                              </div>
                            )}
                            <div
                              className={cn(
                                "px-3 py-2 rounded-lg text-sm",
                                message.isOwn
                                  ? "bg-violet-500 text-white"
                                  : "bg-slate-800 text-slate-200"
                              )}
                            >
                              {message.content}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Message Input */}
        <div className="p-4 border-t border-slate-800 bg-[#13141f] shrink-0">
          <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-4 py-2">
            <button className="text-slate-400 hover:text-white">
              <Plus className="w-5 h-5" />
            </button>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={
                currentRoom
                  ? `发送消息到 #${currentRoom.name}...`
                  : "选择频道后发送消息"
              }
              disabled={!currentRoom || isSending}
              className="flex-1 bg-transparent text-white placeholder:text-slate-500 outline-none text-sm disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || !currentRoom || isSending}
              className="text-slate-400 hover:text-violet-400 disabled:opacity-50 disabled:hover:text-slate-400"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Right Sidebar - Member List */}
      <div className="w-60 bg-[#1a1b26] border-l border-slate-800 shrink-0 overflow-y-auto py-4 px-2">
        <div className="text-xs font-semibold text-slate-500 px-2 py-1 uppercase mb-2">
          成员 — {currentRoom?.members.length || 0}
        </div>

        {currentRoom ? (
          <div className="space-y-0.5">
            {currentRoom.members.map((memberId) => {
              const worker = workers.find((w) => w.userId === memberId);
              const displayName = worker?.name || memberId.split(":")[0].replace("@", "");

              return (
                <button
                  key={memberId}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-800 transition-colors text-left"
                >
                  <div className="relative">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                      <span className="text-white text-xs">
                        {displayName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    {worker?.isOnline && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#1a1b26]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-200 truncate">{displayName}</div>
                    {worker && (
                      <div className="text-xs text-violet-400">AI Agent</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-slate-500 px-2">
            选择频道查看成员
          </div>
        )}
      </div>
    </div>
  );
}
