import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Send,
  Bot,
  Settings,
  User,
  Sparkles,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";
import type { AgentInstance } from "@/types/agentbaba";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface AgentConfig {
  model: string;
  temperature: number;
  max_tokens: number;
  system_prompt: string;
}

export default function AgentChatPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [instance, setInstance] = useState<AgentInstance | null>(null);
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) {
      loadAgent();
    }
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadAgent = async () => {
    try {
      const result = await apiFetch<{
        instance: AgentInstance;
        config: AgentConfig;
      }>(`/agent-instances/${id}/chat/config`);
      setInstance(result.instance);
      setConfig(result.config);
    } catch (err) {
      console.error("Failed to load agent:", err);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const result = await apiFetch<{ response: string; model: string }>(
        `/agent-instances/${id}/chat`,
        {
          method: "POST",
          body: JSON.stringify({ message: input }),
        }
      );

      const assistantMessage: Message = {
        role: "assistant",
        content: result.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error("Chat error:", err);
      const errorMessage: Message = {
        role: "assistant",
        content: "抱歉，发生了错误。请检查您的 API 配置。",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateConfig = async (updates: Partial<AgentConfig>) => {
    try {
      await apiFetch(`/agent-instances/${id}/config`, {
        method: "PUT",
        body: JSON.stringify(updates),
      });
      setConfig((prev) => prev ? { ...prev, ...updates } : prev);
      setShowSettings(false);
    } catch (err) {
      console.error("Failed to update config:", err);
    }
  };

  if (!instance) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary-500)]" />
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col bg-[var(--bg-default)]">
      {/* Header */}
      <div className="bg-[var(--bg-elevated)] border-b border-[var(--border-default)] px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/agentbaba")}
              className="text-[var(--text-secondary)]"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10 bg-gradient-to-br from-[var(--primary-500)] to-purple-500">
                <AvatarFallback className="text-white">
                  <Bot className="w-5 h-5" />
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-lg font-semibold text-[var(--text-primary)]">
                  {instance.name}
                </h1>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      instance.status === "running"
                        ? "bg-green-500/10 text-green-400"
                        : "bg-gray-500/10 text-gray-400"
                    }
                  >
                    {instance.status}
                  </Badge>
                  {config && (
                    <span className="text-xs text-[var(--text-muted)]">
                      {config.model}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowSettings(!showSettings)}
            className="border-[var(--border-default)]"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-[var(--bg-elevated)] border-b border-[var(--border-default)] px-6 py-4">
          <div className="max-w-4xl mx-auto">
            <Card className="bg-[var(--bg-muted)] border-[var(--border-default)]">
              <CardHeader>
                <CardTitle className="text-sm text-[var(--text-primary)]">
                  LLM 配置
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-[var(--text-muted)] mb-1 block">
                      模型
                    </label>
                    <Input
                      value={config?.model || ""}
                      onChange={(e) =>
                        handleUpdateConfig({ model: e.target.value })
                      }
                      placeholder="gpt-4-turbo"
                      className="bg-[var(--bg-default)] border-[var(--border-default)]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-muted)] mb-1 block">
                      Temperature
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      value={config?.temperature || 0.7}
                      onChange={(e) =>
                        handleUpdateConfig({
                          temperature: parseFloat(e.target.value),
                        })
                      }
                      className="bg-[var(--bg-default)] border-[var(--border-default)]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--text-muted)] mb-1 block">
                      Max Tokens
                    </label>
                    <Input
                      type="number"
                      value={config?.max_tokens || 4096}
                      onChange={(e) =>
                        handleUpdateConfig({
                          max_tokens: parseInt(e.target.value),
                        })
                      }
                      className="bg-[var(--bg-default)] border-[var(--border-default)]"
                    />
                  </div>
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  提示：API Key 和 URL 需要在后端环境变量中配置 (OPENAI_API_KEY, OPENAI_BASE_URL)
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 max-w-4xl mx-auto px-6 py-4 overflow-y-auto">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-full bg-[var(--primary-500)]/20 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-[var(--primary-400)]" />
              </div>
              <p className="text-[var(--text-secondary)]">
                开始与 {instance.name} 聊天吧！
              </p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={cn(
                "flex gap-3",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "assistant" && (
                <Avatar className="w-8 h-8 bg-gradient-to-br from-[var(--primary-500)] to-purple-500">
                  <AvatarFallback className="text-white text-xs">
                    <Bot className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
              )}
              <div
                className={cn(
                  "max-w-[70%] rounded-lg px-4 py-2",
                  msg.role === "user"
                    ? "bg-[var(--primary-500)] text-white"
                    : "bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[var(--text-primary)]"
                )}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                <span className="text-xs opacity-60 mt-1 block">
                  {msg.timestamp.toLocaleTimeString()}
                </span>
              </div>
              {msg.role === "user" && (
                <Avatar className="w-8 h-8 bg-[var(--bg-muted)]">
                  <AvatarFallback className="text-xs">
                    <User className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <Avatar className="w-8 h-8 bg-gradient-to-br from-[var(--primary-500)] to-purple-500">
                <AvatarFallback className="text-white text-xs">
                  <Bot className="w-4 h-4" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-lg px-4 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-[var(--primary-400)]" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-[var(--bg-elevated)] border-t border-[var(--border-default)] px-6 py-4">
        <div className="max-w-4xl mx-auto flex gap-4">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入消息..."
            disabled={loading}
            className="bg-[var(--bg-muted)] border-[var(--border-default)] flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="bg-[var(--primary-500)] hover:bg-[var(--primary-400)]"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}