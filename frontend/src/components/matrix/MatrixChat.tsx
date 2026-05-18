import { useState, useRef, useEffect } from "react";
import { useMatrix } from "@/contexts/MatrixContext";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Send, Users, MoreHorizontal, Bot, Circle } from "lucide-react";

interface MatrixChatProps {
  className?: string;
}

interface MentionMember {
  id: string;
  name: string;
  isWorker: boolean;
  isOnline: boolean;
}

export function MatrixChat({ className }: MatrixChatProps) {
  const { currentRoom, messages, sendMessage, isLoading, isInitialized, matrixUserId, workers } = useMatrix();
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(-1);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState(-1);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);



  // Get filtered members for @ mention autocomplete
  const getFilteredMembers = (): MentionMember[] => {
    if (!currentRoom || mentionStart < 0) return [];

    return currentRoom.members
      .filter(m => m !== matrixUserId)
      .map(m => {
        const worker = workers.find(w => w.userId === m);
        return {
          id: m,
          name: worker?.name || m.split(":")[0].replace("@", ""),
          isWorker: !!worker,
          isOnline: worker?.isOnline ?? false,
        };
      })
      .filter(m => m.name.toLowerCase().includes(mentionQuery.toLowerCase()))
      .sort((a, b) => {
        // Workers first, then alphabetically
        if (a.isWorker !== b.isWorker) return a.isWorker ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 10);
  };

  const filteredMembers = getFilteredMembers();

  // Handle input change and detect @ mentions
  const handleInputChange = (text: string) => {
    setInputText(text);

    // Find @ position - look for @ that starts a new mention
    const lastAtIndex = text.lastIndexOf("@");
    if (lastAtIndex >= 0) {
      // Check if @ is at start or preceded by a space
      const charBefore = lastAtIndex > 0 ? text[lastAtIndex - 1] : " ";
      if (charBefore === " " || charBefore === "\n" || lastAtIndex === 0) {
        const afterAt = text.slice(lastAtIndex + 1);
        // No space after @ means still typing mention
        if (!afterAt.includes(" ") && afterAt.length <= 20) {
          setMentionStart(lastAtIndex);
          setMentionQuery(afterAt);
          setMentionIndex(0);
          return;
        }
      }
    }
    // No active mention
    setMentionStart(-1);
    setMentionQuery("");
    setMentionIndex(-1);
  };

  // Select a member from the dropdown
  const selectMember = (member: MentionMember) => {
    if (mentionStart >= 0) {
      const beforeMention = inputText.slice(0, mentionStart);
      const afterMention = inputText.slice(mentionStart + mentionQuery.length + 1);
      const newText = beforeMention + `@${member.name} ` + afterMention;
      setInputText(newText);
      setMentionStart(-1);
      setMentionQuery("");
      setMentionIndex(-1);
      inputRef.current?.focus();
    }
  };

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || isSending) return;

    setIsSending(true);
    setMentionStart(-1);
    try {
      await sendMessage(inputText.trim());
      setInputText("");
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsSending(false);
    }
  };

  // Handle keyboard navigation in mention dropdown
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (filteredMembers.length > 0 && mentionStart >= 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex(prev => Math.min(prev + 1, filteredMembers.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex(prev => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === "Enter" && mentionIndex >= 0) {
        e.preventDefault();
        selectMember(filteredMembers[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        setMentionStart(-1);
        setMentionQuery("");
        setMentionIndex(-1);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      handleSend();
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
      <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4 space-y-6 scrollbar-thin">
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
      <div className="p-4 border-t border-slate-800">
        <div className="flex gap-3 relative">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`发送消息到 #${currentRoom?.name || "房间"}... (输入 @ 提及成员)`}
              disabled={isLoading || isSending}
              className="flex-1 w-full bg-[#1e1f2e] border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50 transition-colors disabled:opacity-50"
            />
            {/* Mention Dropdown */}
            {filteredMembers.length > 0 && mentionStart >= 0 && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#1a1b26] border border-slate-700 rounded-lg overflow-hidden shadow-lg z-50">
                <div className="text-xs text-slate-400 px-3 py-2 bg-slate-800 flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  选择成员 (↑↓ 选择, Enter 确认, Esc 关闭)
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {filteredMembers.map((member, idx) => (
                    <button
                      key={member.id}
                      onClick={() => selectMember(member)}
                      className={cn(
                        "w-full px-3 py-2 text-sm flex items-center gap-2 hover:bg-violet-500/10 transition-colors",
                        idx === mentionIndex ? "bg-violet-500/20" : ""
                      )}
                    >
                      <div className={cn(
                        "w-6 h-6 rounded flex items-center justify-center text-white text-xs",
                        member.isWorker
                          ? "bg-gradient-to-br from-emerald-500 to-teal-500"
                          : "bg-gradient-to-br from-blue-500 to-indigo-500"
                      )}>
                        {member.isWorker ? (
                          <Bot className="w-3 h-3" />
                        ) : (
                          member.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <span className="text-white flex-1 text-left">{member.name}</span>
                      <div className="flex items-center gap-1">
                        {member.isWorker ? (
                          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">AI</span>
                        ) : (
                          <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
                            <Circle className={cn("w-1.5 h-1.5", member.isOnline ? "fill-blue-400 text-blue-400" : "fill-slate-500 text-slate-500")} />
                            {member.isOnline ? "在线" : "离线"}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
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
