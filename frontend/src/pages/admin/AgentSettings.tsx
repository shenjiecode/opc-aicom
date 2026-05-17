import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Save,
  RefreshCw,
  CheckCircle,
  Cpu,
  MessageSquare,
  Settings,
} from "lucide-react";

interface AgentConfig {
  name: string;
  description: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
  mcpTools: string;
  dailyLimit: number;
  enabled: boolean;
}

type AgentType = "bit" | "little-o";

const MODELS = [
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4", label: "GPT-4" },
  { value: "claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
  { value: "claude-3-haiku", label: "Claude 3 Haiku" },
];

const DEFAULT_CONFIG: AgentConfig = {
  name: "",
  description: "",
  systemPrompt: "",
  model: "gpt-4o",
  temperature: 0.7,
  maxTokens: 2048,
  mcpTools: "",
  dailyLimit: 100,
  enabled: true,
};

export default function AgentSettings() {
  const [activeTab, setActiveTab] = useState<AgentType>("bit");
  const [bitConfig, setBitConfig] = useState<AgentConfig>(DEFAULT_CONFIG);
  const [littleOConfig, setLittleOConfig] = useState<AgentConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    setError(null);
    try {
      const [bitResult, littleOResult] = await Promise.all([
        apiFetch<AgentConfig>("/admin/agents/bit/config"),
        apiFetch<AgentConfig>("/admin/agents/little-o/config"),
      ]);
      setBitConfig({ ...DEFAULT_CONFIG, ...bitResult });
      setLittleOConfig({ ...DEFAULT_CONFIG, ...littleOResult });
    } catch (err) {
      console.error("Failed to fetch agent configs:", err);
      setError("加载智能体配置失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setError(null);
    try {
      const endpoint =
        activeTab === "bit"
          ? "/admin/agents/bit/config"
          : "/admin/agents/little-o/config";
      const config = activeTab === "bit" ? bitConfig : littleOConfig;

      await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify(config),
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save config:", err);
      setError("保存配置失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (field: keyof AgentConfig, value: string | number | boolean) => {
    if (activeTab === "bit") {
      setBitConfig((prev) => ({ ...prev, [field]: value }));
    } else {
      setLittleOConfig((prev) => ({ ...prev, [field]: value }));
    }
  };

  const currentConfig = activeTab === "bit" ? bitConfig : littleOConfig;

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">智能体设置</h2>
          <p className="text-slate-500 mt-1">配置 AI 智能体参数和模型设置</p>
        </div>
        <Button variant="outline" onClick={fetchConfigs} disabled={loading}>
          <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
          刷新
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab("bit")}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === "bit"
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            <Cpu className="w-4 h-4" />
            比特 (Bit)
          </button>
          <button
            onClick={() => setActiveTab("little-o")}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === "little-o"
                ? "border-rose-500 text-rose-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            <MessageSquare className="w-4 h-4" />
            小欧 (LittleO)
          </button>
        </div>
      </div>

      {/* Config Form */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            {activeTab === "bit" ? "比特配置" : "小欧配置"}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-500 border-r-transparent" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-500 mb-4">{error}</p>
              <Button onClick={fetchConfigs}>重试</Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Success Message */}
              {saveSuccess && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-700 rounded-lg">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm">配置保存成功</span>
                </div>
              )}

              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-slate-700">
                    名称
                  </Label>
                  <Input
                    id="name"
                    value={currentConfig.name}
                    onChange={(e) => updateConfig("name", e.target.value)}
                    placeholder="智能体名称"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model" className="text-slate-700">
                    模型
                  </Label>
                  <select
                    id="model"
                    className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    value={currentConfig.model}
                    onChange={(e) => updateConfig("model", e.target.value)}
                  >
                    {MODELS.map((model) => (
                      <option key={model.value} value={model.value}>
                        {model.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-slate-700">
                  描述
                </Label>
                <textarea
                  id="description"
                  rows={2}
                  className="w-full px-3 py-2 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                  value={currentConfig.description}
                  onChange={(e) => updateConfig("description", e.target.value)}
                  placeholder="智能体的简短描述..."
                />
              </div>

              {/* System Prompt */}
              <div className="space-y-2">
                <Label htmlFor="systemPrompt" className="text-slate-700">
                  系统提示词 (System Prompt)
                </Label>
                <textarea
                  id="systemPrompt"
                  rows={8}
                  className="w-full px-3 py-2 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none font-mono"
                  value={currentConfig.systemPrompt}
                  onChange={(e) => updateConfig("systemPrompt", e.target.value)}
                  placeholder="输入系统提示词，定义智能体的行为和能力..."
                />
              </div>

              {/* Model Parameters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="temperature" className="text-slate-700">
                    Temperature (0-2)
                  </Label>
                  <Input
                    id="temperature"
                    type="number"
                    min={0}
                    max={2}
                    step={0.1}
                    value={currentConfig.temperature}
                    onChange={(e) =>
                      updateConfig("temperature", parseFloat(e.target.value) || 0)
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxTokens" className="text-slate-700">
                    Max Tokens
                  </Label>
                  <Input
                    id="maxTokens"
                    type="number"
                    min={1}
                    value={currentConfig.maxTokens}
                    onChange={(e) =>
                      updateConfig("maxTokens", parseInt(e.target.value) || 0)
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dailyLimit" className="text-slate-700">
                    每日限额
                  </Label>
                  <Input
                    id="dailyLimit"
                    type="number"
                    min={0}
                    value={currentConfig.dailyLimit}
                    onChange={(e) =>
                      updateConfig("dailyLimit", parseInt(e.target.value) || 0)
                    }
                  />
                </div>
              </div>

              {/* MCP Tools */}
              <div className="space-y-2">
                <Label htmlFor="mcpTools" className="text-slate-700">
                  MCP 工具 (逗号分隔)
                </Label>
                <Input
                  id="mcpTools"
                  value={currentConfig.mcpTools}
                  onChange={(e) => updateConfig("mcpTools", e.target.value)}
                  placeholder="例如: tool1, tool2, tool3"
                />
                <p className="text-xs text-slate-500">
                  输入可用的 MCP 工具名称，用逗号分隔
                </p>
              </div>

              {/* Enabled Toggle */}
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={currentConfig.enabled}
                  onChange={(e) => updateConfig("enabled", e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <Label htmlFor="enabled" className="text-slate-700 mb-0 cursor-pointer">
                  启用此智能体
                </Label>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-4 border-t border-slate-200">
                <Button onClick={handleSave} disabled={saving} className="min-w-[120px]">
                  {saving ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  {saving ? "保存中..." : "保存配置"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
