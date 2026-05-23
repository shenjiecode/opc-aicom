import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Bot,
  ArrowLeft,
  Loader2,
  Cpu,
  Brain,
  Settings2,
  MessageSquare,
  Save,
  RotateCcw,
  Send,
  User,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getSession,
  updateSession,
  buildAgent,
} from "@/lib/api/agentbaba";
import { apiFetch } from "@/lib/api";
import type { AgentConfig } from "@/types/agentbaba";
import ApiKeySection from "@/components/credit/ApiKeySection";

interface EditFormConfig {
  name: string;
  description: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  memoryEnabled: boolean;
  agentType: string;
  baseUrl: string;
  apiKey: string;
}

const agentTypeOptions = [
  { value: "assistant", label: "对话助手", desc: "通用对话和问答" },
  { value: "coder", label: "代码生成", desc: "编写和调试代码" },
  { value: "analyst", label: "数据分析", desc: "处理和分析数据" },
  { value: "researcher", label: "信息检索", desc: "搜索和整理信息" },
  { value: "executor", label: "任务执行", desc: "执行特定任务流程" },
];

const defaultConfig: EditFormConfig = {
  name: "",
  description: "",
  model: "gpt-4-turbo",
  temperature: 0.7,
  maxTokens: 4096,
  systemPrompt: "",
  memoryEnabled: true,
  agentType: "assistant",
  baseUrl: "",
  apiKey: "",
};

export default function EditAgentPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<EditFormConfig>(defaultConfig);
  const [agentInstanceId, setAgentInstanceId] = useState<number | null>(null);
  useEffect(() => {
    if (!sessionId) {
      setError("缺少 sessionId 参数");
      setInitialLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const result = await getSession(Number(sessionId));
        if (cancelled) return;

        const session = result.session;
        let formConfig: EditFormConfig = {
          ...defaultConfig,
          name: session.title,
          description: session.description,
        };

        // 优先从 agent 运行时配置读取
        if (session.agent_instance_id) {
          try {
            const instanceConfig = await apiFetch<{ instance: unknown; config: AgentConfig }>(
              `/agent-instances/${session.agent_instance_id}/chat/config`
            );
            if (!cancelled && instanceConfig?.config) {
              const c = instanceConfig.config;
              formConfig = {
                name: c.name || session.title,
                description: c.description || session.description,
                model: c.model || defaultConfig.model,
                temperature: c.temperature ?? defaultConfig.temperature,
                maxTokens: c.max_tokens ?? defaultConfig.maxTokens,
                systemPrompt: c.system_prompt || "",
                memoryEnabled: c.memory?.enable_summary ?? true,
                agentType: c.planner?.type || "assistant",
                baseUrl: c.base_url || "",
                apiKey: c.api_key || "",
              };
              setConfig(formConfig);
              setAgentInstanceId(session.agent_instance_id);
              setError(null);
              setInitialLoading(false);
              return;
            }
          } catch (e) {
            console.warn("[EditAgent] Failed to load agent instance config, fallback to session config", e);
          }
        }

        // 回退：从 session 的 agent_config_json 读取
        if (session.agent_config_json) {
          try {
            const parsed: AgentConfig = JSON.parse(session.agent_config_json);
            formConfig = {
              name: parsed.name || session.title,
              description: parsed.description || session.description,
              model: parsed.model || defaultConfig.model,
              temperature: parsed.temperature ?? defaultConfig.temperature,
              maxTokens: parsed.max_tokens ?? defaultConfig.maxTokens,
              systemPrompt: parsed.system_prompt || "",
              memoryEnabled: parsed.memory?.enable_summary ?? true,
              agentType: parsed.planner?.type || "assistant",
              baseUrl: parsed.base_url || "",
              apiKey: parsed.api_key || "",
            };
          } catch {
            // agent_config_json parse failed
          }
        }

        setConfig(formConfig);
        setAgentInstanceId(session.agent_instance_id);
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError("加载配置失败，请检查网络或会话是否存在");
          console.error("[EditAgent] loadSession failed:", err);
        }
      } finally {
        if (!cancelled) {
          setInitialLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const buildAgentConfigJson = (): string => {
    const agentConfig: AgentConfig = {
      name: config.name,
      description: config.description,
      model: config.model,
      system_prompt: config.systemPrompt,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      base_url: config.baseUrl,
      api_key: config.apiKey,
      skills: [],
      mcp_servers: [],
      memory: {
        type: "conversation",
        max_messages: 20,
        enable_summary: config.memoryEnabled,
      },
      planner: {
        type: config.agentType,
        max_iterations: 6,
      },
    };
    return JSON.stringify(agentConfig);
  };

  const handleSave = async (rebuild = false) => {
    if (!config.name.trim() || !config.description.trim()) return;
    if (!sessionId) return;

    setLoading(true);
    setError(null);
    try {
      const agentConfigJson = buildAgentConfigJson();
      await updateSession(Number(sessionId), {
        title: config.name,
        description: config.description,
        agent_config_json: agentConfigJson,
      });

      // 如果存在 agentInstanceId，同步回写到 agent 运行时配置
      if (agentInstanceId) {
        try {
          await apiFetch(`/agent-instances/${agentInstanceId}/config`, {
            method: "PUT",
            body: agentConfigJson,
          });
        } catch (e) {
          console.warn("[EditAgent] Failed to write back to agent instance config", e);
        }
      }

      if (rebuild) {
        await buildAgent(Number(sessionId));
      }

      navigate("/agentbaba");
    } catch (err) {
      setError("保存失败，请稍后重试");
      console.error("[EditAgent] save failed:", err);
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-full bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p className="text-sm text-slate-500">加载配置中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-screen bg-slate-50/50">
      {/* Header */}
      <div className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/agentbaba")}
            className="text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">编辑智能体</h1>
              <p className="text-xs text-slate-500">修改您的 AI 助手配置</p>
            </div>
          </div>
        </div>

        {/* Save Buttons in Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => navigate("/agentbaba")}
            disabled={loading}
            className="border-slate-200 text-slate-600 hidden sm:flex"
          >
            取消
          </Button>
          <Button
            onClick={() => handleSave(false)}
            disabled={!config.name.trim() || !config.description.trim() || loading}
            variant="outline"
            className="border-indigo-200 text-indigo-600 hover:bg-indigo-50 hidden md:flex"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            保存更改
          </Button>
          <Button
            onClick={() => handleSave(true)}
            disabled={!config.name.trim() || !config.description.trim() || loading}
            className={cn(
              "min-w-[140px] bg-gradient-to-r from-indigo-500 to-purple-600",
              "hover:from-indigo-600 hover:to-purple-700",
              "shadow-lg shadow-indigo-500/20"
            )}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4 mr-2" />
                保存并重建
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {error && (
          <div className="p-4 m-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Two Column Layout */}
        <div className="flex flex-col md:flex-row h-full">
          {/* Left: Config Panel (1/3) */}
          <div className="w-full md:w-[38%] lg:w-[35%] xl:w-[33%] bg-white border-r border-slate-200 overflow-y-auto">
            <div className="p-4 lg:p-5 space-y-4">
              {/* Basic Info Card */}
              <Card className="border border-slate-200 shadow-sm bg-white">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-indigo-50 flex items-center justify-center">
                      <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold text-slate-900">基本信息</CardTitle>
                      <CardDescription className="text-xs mt-0.5">设置智能体的名称和用途</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-xs font-medium text-slate-700">
                      智能体名称 <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="name"
                      placeholder="例如：代码小助手"
                      value={config.name}
                      onChange={(e) => setConfig({ ...config, name: e.target.value })}
                      className="h-9 text-sm border-slate-200 focus:border-indigo-400 focus:ring-indigo-400"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="type" className="text-xs font-medium text-slate-700">
                      智能体类型
                    </Label>
                    <Select
                      value={config.agentType}
                      onValueChange={(v) => setConfig({ ...config, agentType: v })}
                    >
                      <SelectTrigger className="h-9 text-sm border-slate-200 focus:ring-indigo-400">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {agentTypeOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <div className="flex flex-col py-0.5">
                              <span className="text-sm">{opt.label}</span>
                              <span className="text-xs text-slate-500">{opt.desc}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="description" className="text-xs font-medium text-slate-700">
                      功能描述 <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="description"
                      placeholder="描述这个智能体的主要功能和用途..."
                      value={config.description}
                      onChange={(e) => setConfig({ ...config, description: e.target.value })}
                      className="min-h-[72px] text-sm border-slate-200 focus:border-indigo-400 focus:ring-indigo-400 resize-none"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Model Config Card */}
              <Card className="border border-slate-200 shadow-sm bg-white">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-purple-50 flex items-center justify-center">
                      <Cpu className="w-3.5 h-3.5 text-purple-600" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold text-slate-900">模型配置</CardTitle>
                      <CardDescription className="text-xs mt-0.5">选择底层语言模型和参数</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-700">语言模型</Label>
                    <Input
                      value={config.model}
                      onChange={(e) => setConfig({ ...config, model: e.target.value })}
                      placeholder="例如：gpt-4o"
                      className="h-9 text-sm border-slate-200 focus:ring-indigo-400"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-700">
                      最大输出长度: <span className="text-indigo-600 font-medium">{config.maxTokens}</span>
                    </Label>
                    <Slider
                      value={[config.maxTokens]}
                      onValueChange={(values) => setConfig({ ...config, maxTokens: values[0] })}
                      min={256}
                      max={8192}
                      step={256}
                      className="py-1.5"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>256</span>
                      <span>8192</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium text-slate-700">
                        温度 (创造性): <span className="text-indigo-600 font-medium">{config.temperature.toFixed(1)}</span>
                      </Label>
                      <span className="text-[10px] px-2 py-0.5 bg-slate-100 rounded-full text-slate-600">
                        {config.temperature < 0.3 ? "精确模式" :
                         config.temperature < 0.7 ? "平衡模式" : "创意模式"}
                      </span>
                    </div>
                    <Slider
                      value={[config.temperature]}
                      onValueChange={(values) => setConfig({ ...config, temperature: values[0] })}
                      min={0}
                      max={1}
                      step={0.1}
                      className="py-1.5"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>精确 (0)</span>
                      <span>创意 (1)</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Advanced Config Card */}
              <Card className="border border-slate-200 shadow-sm bg-white">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-emerald-50 flex items-center justify-center">
                      <Settings2 className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold text-slate-900">高级配置</CardTitle>
                      <CardDescription className="text-xs mt-0.5">自定义系统提示和记忆功能</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="space-y-1.5">
                    <Label htmlFor="systemPrompt" className="text-xs font-medium text-slate-700">
                      系统提示词 (可选)
                    </Label>
                    <Textarea
                      id="systemPrompt"
                      placeholder="定义智能体的角色、行为和回答风格..."
                      value={config.systemPrompt}
                      onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                      className="min-h-[90px] text-sm border-slate-200 focus:border-indigo-400 focus:ring-indigo-400 font-mono resize-none"
                    />
                  </div>

                  {/* LLM Provider 配置 */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-700">
                      API Gateway URL (可选)
                    </Label>
                    <Input
                      placeholder="https://api.openai-proxy.org/v1"
                      value={config.baseUrl}
                      onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
                      className="text-sm border-slate-200 focus:border-indigo-400 focus:ring-indigo-400"
                    />
                    <p className="text-[10px] text-slate-500">使用代理网关转发 LLM 请求</p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-700">
                      API Key (可选)
                    </Label>
                    <Input
                      type="password"
                      placeholder="sk-..."
                      value={config.apiKey}
                      onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                      className="text-sm border-slate-200 focus:border-indigo-400 focus:ring-indigo-400"
                    />
                    <p className="text-[10px] text-slate-500">Per-agent API Key，留空使用全局环境变量</p>
                  </div>


                  <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-md bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                        <Brain className="w-4 h-4 text-indigo-500" />
                      </div>
                      <div>
                      <Label className="text-xs font-medium text-slate-800">启用记忆功能</Label>
                        <p className="text-[10px] text-slate-500">记住历史对话上下文</p>
                      </div>
                    </div>
                    <Switch
                      checked={config.memoryEnabled}
                      onCheckedChange={(checked) => setConfig({ ...config, memoryEnabled: checked })}
                    />
                  </div>
                </CardContent>
              </Card>

            {/* API Key Section */}
            <ApiKeySection />

              {/* Mobile Save Buttons */}
              <div className="flex flex-col gap-2 md:hidden pt-2">
                <Button
                  onClick={() => handleSave(true)}
                  disabled={!config.name.trim() || !config.description.trim() || loading}
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RotateCcw className="w-4 h-4 mr-2" />
                  )}
                  保存并重建
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/agentbaba")}
                  disabled={loading}
                  className="w-full border-slate-200"
                >
                  取消
                </Button>
              </div>
            </div>
          </div>

          {/* Right: Chat Test Panel (2/3) */}
          <div className="flex-1 bg-slate-50/50 overflow-hidden flex flex-col">
            <ChatTestPanel agentName={config.name} systemPrompt={config.systemPrompt} agentInstanceId={agentInstanceId} />
          </div>
        </div>
      </div>
    </div>
  );
}


// ==================== ChatTestPanel Component ====================

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatTestPanelProps {
  agentName: string;
  systemPrompt: string;
  agentInstanceId: number | null;
}

function ChatTestPanel({ agentName, systemPrompt: _systemPrompt, agentInstanceId }: ChatTestPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `你好！我是 ${agentName || 'AI 助手'}，有什么可以帮助你的吗？`,
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Update welcome message when agent name changes
  useEffect(() => {
    if (messages.length === 1 && messages[0].id === 'welcome') {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: `你好！我是 ${agentName || 'AI 助手'}，有什么可以帮助你的吗？`,
          timestamp: new Date(),
        },
      ]);
    }
  }, [agentName]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // 如果有 agentInstanceId，调用真实 API
      if (agentInstanceId) {
        const result = await apiFetch<{ response: string; model: string }>(
          `/agent-instances/${agentInstanceId}/chat`,
          {
            method: 'POST',
            body: JSON.stringify({ message: userMessage.content }),
          },
          60000 // 60 秒超时，LLM 可能需要较长响应时间
        );

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: result.response,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        // 如果没有 agent instance，显示提示
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '请先保存并构建 Agent 后再进行对话测试。',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (err) {
      console.error('Chat error:', err);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '抱歉，发生了错误。请检查您的 API 配置或网络连接。',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: `你好！我是 ${agentName || 'AI 助手'}，有什么可以帮助你的吗？`,
        timestamp: new Date(),
      },
    ]);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">测试对话</h2>
            <p className="text-xs text-slate-500">实时预览智能体回复效果</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearChat}
          className="text-slate-500 hover:text-slate-700"
        >
          <RotateCcw className="w-4 h-4 mr-1.5" />
          清空
        </Button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4 bg-slate-50/50">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300',
              message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
            )}
          >
            {/* Avatar */}
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm',
                message.role === 'user'
                  ? 'bg-gradient-to-br from-blue-500 to-indigo-600'
                  : 'bg-gradient-to-br from-indigo-500 to-purple-600'
              )}
            >
              {message.role === 'user' ? (
                <User className="w-4 h-4 text-white" />
              ) : (
                <Bot className="w-4 h-4 text-white" />
              )}
            </div>

            {/* Message Bubble */}
            <div
              className={cn(
                'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm shadow-sm',
                message.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-md'
                  : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md'
              )}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
              <span
                className={cn(
                  'text-[10px] mt-1.5 block',
                  message.role === 'user' ? 'text-indigo-200' : 'text-slate-400'
                )}
              >
                {message.timestamp.toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3 flex-row">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-sm">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 lg:p-5 bg-white border-t border-slate-200 flex-shrink-0">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息测试智能体..."
              className="min-h-[52px] max-h-[120px] pr-12 resize-none border-slate-200 focus:border-indigo-400 focus:ring-indigo-400 bg-slate-50/50 text-slate-900"
              rows={1}
            />
          </div>
          <Button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className={cn(
              'h-[52px] w-[52px] p-0 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 shadow-md',
              !inputValue.trim() && 'opacity-50 cursor-not-allowed'
            )}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-slate-400 mt-2 text-center">
          按 Enter 发送，Shift + Enter 换行
        </p>
      </div>
    </div>
  );
}
