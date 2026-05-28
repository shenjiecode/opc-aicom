import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
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
  Bot,
  User,
  Crown,
  Star,
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
    <div className="h-screen bg-[#13141f] flex overflow-hidden">
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
          {/* System Section */}
          <div className="mb-4">
            <div className="text-xs font-semibold text-slate-500 px-2 py-1 uppercase mb-1">
              系统
            </div>
            <button
              onClick={() => {
                // 连接到 bite 系统
                initialize();
              }}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors text-left",
                isInitialized
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              )}
            >
              {/* 章鱼图标 SVG */}
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                <path d="M12 2C10.34 2 9 3.34 9 5v2.5c-3.5 0.5-6 2.5-6 5.5 0 2 1 3.5 2.5 4.5-0.5 1.5-1.5 2.5-2.5 3 1.5 0 3-1 4-2 1 0.5 2 1 3.5 1s2.5-0.5 3.5-1c1 1 2.5 2 4 2-1-0.5-2-1.5-2.5-3 1.5-1 2.5-2.5 2.5-4.5 0-3-2.5-5-6-5.5V5c0-1.66-1.34-3-3-3zm0 2c0.55 0 1 0.45 1 1v2h-2V5c0-0.55 0.45-1 1-1zm-3 7c0.55 0 1 0.45 1 1s-0.45 1-1 1-1-0.45-1-1 0.45-1 1-1zm6 0c0.55 0 1 0.45 1 1s-0.45 1-1 1-1-0.45-1-1 0.45-1 1-1z"/>
              </svg>
              <span className="truncate text-sm font-medium">bite</span>
              {isInitialized ? (
                <span className="ml-auto text-xs text-emerald-400">已连接</span>
              ) : (
                <span className="ml-auto text-xs text-slate-500">离线</span>
              )}
            </button>
          </div>

          <div className="space-y-0.5">
            <div className="text-xs font-semibold text-slate-500 px-2 py-1 uppercase">
              文字频道
            </div>
            {rooms.map((room) => (
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

        {/* Messages - Scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
          {/* Custom scrollbar styling via CSS */}
          <style>{`
            .chat-scroll::-webkit-scrollbar {
              width: 8px;
            }
            .chat-scroll::-webkit-scrollbar-track {
              background: #1a1b26;
            }
            .chat-scroll::-webkit-scrollbar-thumb {
              background: #4a4b5e;
              border-radius: 4px;
            }
            .chat-scroll::-webkit-scrollbar-thumb:hover {
              background: #5a5b6e;
            }
          `}</style>
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
            <div className="space-y-4 chat-scroll">
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

      {/* Right Sidebar - Member List - Discord Style */}
      <div className="w-60 bg-[#1a1b26] border-l border-slate-800 shrink-0 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 shrink-0">
          <div className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-2">
            <Users className="w-4 h-4" />
            成员 — {currentRoom?.members.length || 0}
          </div>
        </div>
        
        {/* Member List - Scrollable */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {currentRoom ? (
            <div className="space-y-1">
              {currentRoom.members.map((memberId) => {
                const worker = workers.find((w) => w.userId === memberId);
                const displayName = worker?.name || memberId.split(":")[0].replace("@", "");
                const isAgent = !!worker;
                const isOnline = worker?.isOnline ?? (memberId === matrixUserId);
                const isCurrentUser = memberId === matrixUserId;
                
                // 根据用户名生成随机颜色
                const avatarColors = [
                  "from-violet-500 to-purple-500",
                  "from-blue-500 to-cyan-500",
                  "from-emerald-500 to-teal-500",
                  "from-orange-500 to-amber-500",
                  "from-pink-500 to-rose-500",
                ];
                const colorIndex = Math.abs(displayName.charCodeAt(0) % avatarColors.length);
                const avatarGradient = avatarColors[colorIndex];
                
                // 模拟用户状态/简介
                const statusMessages = isCurrentUser 
                  ? ["在线"] 
                  : isAgent 
                    ? ["待命中", "准备就绪", "工作中", "等待任务"] 
                    : ["在线", "忙碌中", "正在工作", "请勿打扰"];
                const statusMessage = statusMessages[Math.abs(displayName.charCodeAt(1) % statusMessages.length)] || statusMessages[0];
                
                // 模拟标签
                const tags: string[] = [];
                if (isCurrentUser) {
                  tags.push("你");
                }
                if (isAgent) {
                  tags.push("Agent");
                }
                
                return (
                  <div
                    key={memberId}
                    className="group p-2 rounded-lg hover:bg-[#2a2b36] transition-colors cursor-pointer"
                  >
                    {/* Top: Avatar + Name + Status + Badge */}
                    <div className="flex items-start gap-3">
                      {/* Avatar with Status Indicator */}
                      <div className="relative shrink-0">
                        <div className={cn(
                          "w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center",
                          avatarGradient
                        )}>
                          <span className="text-white text-sm font-bold">
                            {displayName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        {/* Online Status Indicator */}
                        <div className={cn(
                          "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#1a1b26]",
                          isOnline ? "bg-emerald-500" : "bg-slate-500"
                        )} />
                      </div>
                      
                      {/* Name + Status + Badge */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-white truncate">
                            {displayName}
                          </span>
                          {/* Agent/Human Badge */}
                          {isAgent ? (
                            <Bot className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                          ) : (
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          )}
                          {/* Owner Badge */}
                          {isCurrentUser && (
                            <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          )}
                        </div>
                        {/* Status Message */}
                        <div className="text-xs text-slate-400 truncate mt-0.5">
                          {statusMessage}
                        </div>
                      </div>
                    </div>
                    
                    {/* Tags */}
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded",
                              tag === "你" 
                                ? "bg-amber-500/20 text-amber-400" 
                                : tag === "Agent" 
                                  ? "bg-violet-500/20 text-violet-400"
                                  : "bg-slate-700 text-slate-400"
                            )}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 py-8">
              <Users className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm">选择频道查看成员</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
