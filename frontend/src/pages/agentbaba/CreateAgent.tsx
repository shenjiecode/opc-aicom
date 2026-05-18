import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  Sparkles,
  ArrowLeft,
  Loader2,
  Cpu,
  Brain,
  Settings2,
  MessageSquare,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createSession, generateConfig, buildAgent } from "@/lib/api/agentbaba";

interface AgentConfig {
  name: string;
  description: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  memoryEnabled: boolean;
  agentType: string;
  baseUrl: string; // API Gateway URL
  apiKey: string;  // Optional API Key
}

const modelOptions = [
  { value: "gpt-4-turbo", label: "GPT-4 Turbo", provider: "OpenAI" },
  { value: "gpt-4o", label: "GPT-4o", provider: "OpenAI" },
  { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo", provider: "OpenAI" },
  { value: "claude-3-opus", label: "Claude 3 Opus", provider: "Anthropic" },
  { value: "claude-3-sonnet", label: "Claude 3 Sonnet", provider: "Anthropic" },
  { value: "claude-3-haiku", label: "Claude 3 Haiku", provider: "Anthropic" },
];

const agentTypeOptions = [
  { value: "assistant", label: "对话助手", desc: "通用对话和问答" },
  { value: "coder", label: "代码生成", desc: "编写和调试代码" },
  { value: "analyst", label: "数据分析", desc: "处理和分析数据" },
  { value: "researcher", label: "信息检索", desc: "搜索和整理信息" },
  { value: "executor", label: "任务执行", desc: "执行特定任务流程" },
];

export default function CreateAgentPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  
  const [config, setConfig] = useState<AgentConfig>({
    name: "",
    description: "",
    model: "gpt-4-turbo",
    temperature: 0.7,
    maxTokens: 4096,
    systemPrompt: "",
    memoryEnabled: true,
    agentType: "assistant",
    baseUrl: "https://api.openai-proxy.org/v1",
    apiKey: "",
  });

  const handleCreate = async () => {
    if (!config.name.trim() || !config.description.trim()) {
      return;
    }

    setLoading(true);
    try {
      console.log("[CreateAgent] 开始创建 Agent:", config);
      
      // 1. 创建 Session
      const sessionResult = await createSession({
        title: config.name,
        description: config.description,
      });
      console.log("[CreateAgent] Session 创建成功:", sessionResult);
      
      const sessionId = sessionResult.session_id;
      
      // 2. 生成配置
      setCurrentStep(2);
      const configResult = await generateConfig(sessionId);
      console.log("[CreateAgent] 配置生成成功:", configResult);
      
      // 3. 构建 Agent
      setCurrentStep(3);
      const buildResult = await buildAgent(sessionId);
      console.log("[CreateAgent] Agent 构建成功:", buildResult);
      
      // 4. 跳转到 Agent 列表
      setCurrentStep(4);
      setTimeout(() => {
        navigate("/agentbaba");
      }, 1000);
      
    } catch (err) {
      console.error("[CreateAgent] 创建失败:", err);
      setCurrentStep(1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      {/* Header */}
      <div className="h-16 border-b border-slate-200/80 bg-white/80 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/agentbaba")}
            className="text-slate-500 hover:text-slate-700 dark:text-slate-200"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">创建智能体</h1>
              <p className="text-xs text-slate-500">配置您的专属 AI 助手</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="space-y-6">
          {/* 基本信息 */}
          <Card className="border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <CardTitle className="text-base font-medium">基本信息</CardTitle>
                  <CardDescription className="text-sm">设置智能体的名称和用途</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    智能体名称 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="name"
                    placeholder="例如：代码小助手"
                    value={config.name}
                    onChange={(e) => setConfig({ ...config, name: e.target.value })}
                    className="border-slate-200 focus:border-indigo-400 focus:ring-indigo-400 text-slate-900 dark:text-slate-100 dark:bg-slate-800"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    智能体类型
                  </Label>
                  <Select
                    value={config.agentType}
                    onValueChange={(v) => setConfig({ ...config, agentType: v })}
                  >
                    <SelectTrigger className="border-slate-200 focus:ring-indigo-400">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {agentTypeOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex flex-col">
                            <span>{opt.label}</span>
                            <span className="text-xs text-slate-500">{opt.desc}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  功能描述 <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="description"
                  placeholder="描述这个智能体的主要功能和用途..."
                  value={config.description}
                  onChange={(e) => setConfig({ ...config, description: e.target.value })}
                  className="min-h-[80px] border-slate-200 focus:border-indigo-400 focus:ring-indigo-400 text-slate-900 dark:text-slate-100 dark:bg-slate-800"
                />
              </div>
            </CardContent>
          </Card>

          {/* API Gateway 配置 */}
          <Card className="border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-base font-medium">API Gateway</CardTitle>
                  <CardDescription className="text-sm">配置 LLM API 网关地址</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="baseUrl" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  API Gateway URL
                </Label>
                <Input
                  id="baseUrl"
                  placeholder="https://api.openai-proxy.org/v1"
                  value={config.baseUrl}
                  onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
                  className="border-slate-200 focus:border-indigo-400 focus:ring-indigo-400 text-slate-900 dark:text-slate-100 dark:bg-slate-800"
                />
                <p className="text-xs text-slate-500">
                  支持 OpenAI-compatible API，如 AIGateway、OpenAI Proxy 等
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="apiKey" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  API Key (可选)
                </Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="留空则使用系统默认配置"
                  value={config.apiKey}
                  onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                  className="border-slate-200 focus:border-indigo-400 focus:ring-indigo-400 text-slate-900 dark:text-slate-100 dark:bg-slate-800"
                />
                <p className="text-xs text-slate-500">
                  如果网关需要独立的 API Key，在此填写
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 模型配置 */}
          <Card className="border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Cpu className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <CardTitle className="text-base font-medium">模型配置</CardTitle>
                  <CardDescription className="text-sm">选择底层语言模型和参数</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">语言模型</Label>
                  <Select
                    value={config.model}
                    onValueChange={(v) => setConfig({ ...config, model: v })}
                  >
                    <SelectTrigger className="border-slate-200 focus:ring-indigo-400">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {modelOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center gap-2">
                            <span>{opt.label}</span>
                            <span className="text-xs text-slate-400">({opt.provider})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    最大输出长度: {config.maxTokens}
                  </Label>
                  <Slider
                    value={[config.maxTokens]}
                    onValueChange={(values) => setConfig({ ...config, maxTokens: values[0] })}
                    min={256}
                    max={8192}
                    step={256}
                    className="py-2"
                  />
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>256</span>
                    <span>8192</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    温度 (创造性): {config.temperature.toFixed(1)}
                  </Label>
                  <span className="text-xs text-slate-500">
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
                  className="py-2"
                />
                <div className="flex justify-between text-xs text-slate-400">
                  <span>精确 (0)</span>
                  <span>创意 (1)</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 高级配置 */}
          <Card className="border-slate-200/60 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Settings2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <CardTitle className="text-base font-medium">高级配置</CardTitle>
                  <CardDescription className="text-sm">自定义系统提示和记忆功能</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="systemPrompt" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  系统提示词 (可选)
                </Label>
                <Textarea
                  id="systemPrompt"
                  placeholder="定义智能体的角色、行为和回答风格..."
                  value={config.systemPrompt}
                  onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                  className="min-h-[100px] border-slate-200 focus:border-indigo-400 focus:ring-indigo-400 text-slate-900 dark:text-slate-100 dark:bg-slate-800 font-mono text-sm"
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 flex items-center justify-center">
                    <Brain className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-slate-700 dark:text-slate-200">启用记忆功能</Label>
                    <p className="text-xs text-slate-500">记住历史对话上下文</p>
                  </div>
                </div>
                <Switch
                  checked={config.memoryEnabled}
                  onCheckedChange={(checked) => setConfig({ ...config, memoryEnabled: checked })}
                />
              </div>
            </CardContent>
          </Card>

          {/* 操作按钮 */}
          <div className="flex items-center justify-between pt-4">
            <Button
              variant="outline"
              onClick={() => navigate("/agentbaba")}
              disabled={loading}
              className="border-slate-200"
            >
              取消
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!config.name.trim() || !config.description.trim() || loading}
              className={cn(
                "min-w-[160px] bg-gradient-to-r from-indigo-500 to-purple-600",
                "hover:from-indigo-600 hover:to-purple-700",
                "shadow-lg shadow-indigo-500/20"
              )}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {currentStep === 1 && "创建中..."}
                  {currentStep === 2 && "生成配置..."}
                  {currentStep === 3 && "构建中..."}
                  {currentStep === 4 && "完成!"}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  创建智能体
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
