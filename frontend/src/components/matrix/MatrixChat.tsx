import { useState, useRef, useEffect } from "react";
import { useMatrix } from "@/contexts/MatrixContext";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Send, Users, MoreHorizontal } from "lucide-react";

interface MatrixChatProps {
  className?: string;
}

export function MatrixChat({ className }: MatrixChatProps) {
  const { currentRoom, messages, sendMessage, isLoading, isInitialized } = useMatrix();
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  if (!isInitialized) {
    return (
      <Card className={cn("bg-[#13141f] border-slate-800 flex-1 flex flex-col", className)}>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-violet-500/10 flex items-center justify-center">
              <Users className="w-8 h-8 text-violet-400" />
            </div>
            <p className="text-slate-400">正在连接 Matrix...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!currentRoom) {
    return (
      <Card className={cn("bg-[#13141f] border-slate-800 flex-1 flex flex-col", className)}>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-700 flex items-center justify-center">
              <Users className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-400">选择一个房间开始聊天</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("bg-[#13141f] border-slate-800 flex-1 flex flex-col overflow-hidden", className)}>
      {/* Header */}
      <CardHeader className="border-b border-slate-800 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-violet-400" />
              <span className="text-white font-semibold">
                # {currentRoom.name}
              </span>
              <span className="text-xs font-normal text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                {currentRoom.members.length} 成员
              </span>
            </div>
            {currentRoom.topic && (
              <p className="text-xs text-slate-500 mt-1">
                {currentRoom.topic}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-slate-400 hover:text-white"
          >
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4 space-y-6">
        {groupedMessages.map((group) => (
          <div key={group.date}>
            {/* Date separator */}
            <div className="flex items-center justify-center my-4">
              <div className="bg-slate-800 text-xs text-slate-500 px-3 py-1 rounded-full">
                {group.date}
              </div>
            </div>
            
            {/* Messages */}
            <div className="space-y-4">
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
                    {/* Avatar */}
                    {showAvatar && (
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shrink-0">
                        <span className="text-sm text-white">
                          {message.senderName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    
                    {/* Message content */}
                    <div
                      className={cn(
                        "flex flex-col",
                        message.isOwn ? "items-end" : "items-start",
                        !showAvatar && "ml-11"
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
                          "px-4 py-2.5 rounded-2xl max-w-md text-sm leading-relaxed",
                          message.isOwn
                            ? "bg-violet-500 text-white rounded-tr-none"
                            : "bg-[#1e1f2e] border border-slate-800 text-slate-300 rounded-tl-none"
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
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}

      {/* Input */}
      <div className="p-4 border-t border-slate-800">
        <div className="flex gap-3">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={`发送消息到 #${currentRoom.name}...`}
            disabled={isLoading || isSending}
            className="flex-1 bg-[#1e1f2e] border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50 transition-colors disabled:opacity-50"
          />
          <Button
            onClick={handleSend}
            disabled={!inputText.trim() || isLoading || isSending}
            className="bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white font-medium px-5 py-3 rounded-xl flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">发送</span>
          </Button>
        </div>
      </div>
    </Card>
  );
}
