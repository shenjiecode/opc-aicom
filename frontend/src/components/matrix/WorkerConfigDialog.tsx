import { useState, useEffect, useRef } from "react";
import type { MatrixWorker } from "@/contexts/MatrixContext";
import type { MatrixClient } from "matrix-js-sdk";
import { RoomEvent } from "matrix-js-sdk";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Settings,
  Brain,
  Wrench,
  FileText,
  X,
  Save,
  Loader2,
  Mail,
} from "lucide-react";

interface WorkerConfigDialogProps {
  worker: MatrixWorker;
  roomId: string;
  client: MatrixClient | null;
  sendMessageToRoom: (roomId: string, text: string) => Promise<void>;
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: WorkerConfig) => Promise<void>;
}

export interface WorkerConfig {
  llm: {
    apiKey: string;
    baseUrl: string;
    model: string;
  };
  smtp: {
    host: string;
    port: string;
    user: string;
    pass: string;
  };
  mcpSkills: string[];
  agentMd: string;
}

const DEFAULT_CONFIG: WorkerConfig = {
  llm: {
    apiKey: "",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4",
  },
  smtp: {
    host: "",
    port: "587",
    user: "",
    pass: "",
  },
  mcpSkills: [],
  agentMd: `# Agent Configuration

## Role
You are an intelligent AI assistant that helps users with various tasks.

## Capabilities
- Answer questions
- Process documents
- Execute tasks
- Send emails

## Behavior
- Be helpful and concise
- Ask for clarification when needed
- Report errors clearly
`,
};

// Available MCP skills
const AVAILABLE_MCP_SKILLS = [
  { id: "email", name: "Email", description: "Send emails via SMTP" },
  { id: "xiaohongshu", name: "Xiaohongshu", description: "Search Xiaohongshu content" },
  { id: "filesystem", name: "Filesystem", description: "Read and write files" },
  { id: "websearch", name: "Web Search", description: "Search the web" },
  { id: "weather", name: "Weather", description: "Get weather information" },
];

export function WorkerConfigDialog({
  worker,
  roomId,
  client,
  sendMessageToRoom,
  isOpen,
  onClose,
  onSave,
}: WorkerConfigDialogProps) {
  const [activeTab, setActiveTab] = useState<"llm" | "smtp" | "mcp" | "agent">("llm");
  const [config, setConfig] = useState<WorkerConfig>(DEFAULT_CONFIG);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const listenerRef = useRef<((event: any, room: any) => void) | null>(null);

  // Fetch config from worker when dialog opens
  useEffect(() => {
    if (!isOpen || !client || configLoaded) return;

    const handleTimelineEvent = (event: any, room: any) => {
      if (room?.roomId !== roomId) return;

      const content = event.getContent();
      const sender = event.getSender();
      const body = content?.body || "";

      // Check if this is CONFIG_RESPONSE from our worker
      if (sender?.includes(worker.workerId) && body.startsWith("CONFIG_RESPONSE:")) {
        try {
          const jsonStr = body.replace("CONFIG_RESPONSE:", "");
          const parsed = JSON.parse(jsonStr);

          setConfig((prev) => ({
            ...prev,
            llm: {
              apiKey: parsed.apiKey || "",
              baseUrl: parsed.baseUrl || prev.llm.baseUrl,
              model: parsed.model || prev.llm.model,
            },
            smtp: {
              host: parsed.smtpHost || "",
              port: parsed.smtpPort || "587",
              user: parsed.smtpUser || "",
              pass: parsed.smtpPass || "",
            },
          }));
          setConfigLoaded(true);
          setIsLoading(false);
          console.log("[WorkerConfig] Config loaded from worker:", parsed);
        } catch (e) {
          console.error("[WorkerConfig] Failed to parse config response:", e);
          setIsLoading(false);
        }
      }
    };

    listenerRef.current = handleTimelineEvent;
    client.on(RoomEvent.Timeline, handleTimelineEvent);

    const sendRequest = async () => {
      setIsLoading(true);
      try {
        const requestMsg = `@${worker.workerId} GET_CONFIG`;
        await sendMessageToRoom(roomId, requestMsg);
        console.log("[WorkerConfig] Sent GET_CONFIG to", worker.workerId);

        // Timeout after 5 seconds if no response
        setTimeout(() => {
          setIsLoading((prev) => {
            if (prev) {
              console.log("[WorkerConfig] No response from worker, using defaults");
              return false;
            }
            return prev;
          });
        }, 5000);
      } catch (error) {
        console.error("[WorkerConfig] Failed to send GET_CONFIG:", error);
        setIsLoading(false);
      }
    };

    sendRequest();

    // Cleanup listener when dialog closes or component unmounts
    return () => {
      if (listenerRef.current && client) {
        client.removeListener(RoomEvent.Timeline, listenerRef.current);
        listenerRef.current = null;
      }
    };
  }, [isOpen, client, roomId, worker.workerId, sendMessageToRoom, configLoaded]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setConfigLoaded(false);
      setConfig(DEFAULT_CONFIG);
      setIsLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(config);
      onClose();
    } catch (error) {
      console.error("Failed to save config:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const updateLlmConfig = (key: keyof WorkerConfig["llm"], value: string) => {
    setConfig((prev) => ({
      ...prev,
      llm: { ...prev.llm, [key]: value },
    }));
  };

  const updateSmtpConfig = (key: keyof WorkerConfig["smtp"], value: string) => {
    setConfig((prev) => ({
      ...prev,
      smtp: { ...prev.smtp, [key]: value },
    }));
  };

  const toggleMcpSkill = (skillId: string) => {
    setConfig((prev) => ({
      ...prev,
      mcpSkills: prev.mcpSkills.includes(skillId)
        ? prev.mcpSkills.filter((id) => id !== skillId)
        : [...prev.mcpSkills, skillId],
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-[#1a1b26] border-slate-700">
        {/* Header */}
        <CardHeader className="border-b border-slate-700 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Settings className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-white">{worker.name} 配置</CardTitle>
                <CardDescription className="text-slate-400">
                  配置大模型、邮件和智能体指令
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isLoading && (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  读取配置中...
                </div>
              )}
              {configLoaded && (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                  已同步
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="text-slate-400 hover:text-white hover:bg-slate-700"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-4 flex-wrap">
            <Button
              variant={activeTab === "llm" ? "default" : "outline"}
              onClick={() => setActiveTab("llm")}
              size="sm"
              className={activeTab === "llm"
                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                : "border-slate-600 text-slate-300 hover:text-white hover:bg-slate-700"
              }
            >
              <Brain className="mr-2 h-4 w-4" />
              大模型配置
            </Button>
            <Button
              variant={activeTab === "smtp" ? "default" : "outline"}
              onClick={() => setActiveTab("smtp")}
              size="sm"
              className={activeTab === "smtp"
                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                : "border-slate-600 text-slate-300 hover:text-white hover:bg-slate-700"
              }
            >
              <Mail className="mr-2 h-4 w-4" />
              邮件配置
            </Button>
            <Button
              variant={activeTab === "mcp" ? "default" : "outline"}
              onClick={() => setActiveTab("mcp")}
              size="sm"
              className={activeTab === "mcp"
                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                : "border-slate-600 text-slate-300 hover:text-white hover:bg-slate-700"
              }
            >
              <Wrench className="mr-2 h-4 w-4" />
              MCP 技能
            </Button>
            <Button
              variant={activeTab === "agent" ? "default" : "outline"}
              onClick={() => setActiveTab("agent")}
              size="sm"
              className={activeTab === "agent"
                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                : "border-slate-600 text-slate-300 hover:text-white hover:bg-slate-700"
              }
            >
              <FileText className="mr-2 h-4 w-4" />
              Agent.md
            </Button>
          </div>
        </CardHeader>

        {/* Content */}
        <CardContent className="flex-1 overflow-y-auto py-4">
          {activeTab === "llm" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="apiKey" className="text-slate-300">
                  API Key
                </Label>
                <Input
                  id="apiKey"
                  type="password"
                  placeholder="sk-..."
                  value={config.llm.apiKey}
                  onChange={(e) => updateLlmConfig("apiKey", e.target.value)}
                  className="bg-[#242636] border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="baseUrl" className="text-slate-300">
                  API Base URL
                </Label>
                <Input
                  id="baseUrl"
                  placeholder="https://api.openai.com/v1"
                  value={config.llm.baseUrl}
                  onChange={(e) => updateLlmConfig("baseUrl", e.target.value)}
                  className="bg-[#242636] border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model" className="text-slate-300">
                  Model Name
                </Label>
                <Input
                  id="model"
                  placeholder="gpt-4"
                  value={config.llm.model}
                  onChange={(e) => updateLlmConfig("model", e.target.value)}
                  className="bg-[#242636] border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="text-xs text-slate-500 mt-4">
                配置将安全发送给 Worker，不会存储在后端服务器
              </div>
            </div>
          )}

          {activeTab === "smtp" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="smtpHost" className="text-slate-300">
                  SMTP 服务器
                </Label>
                <Input
                  id="smtpHost"
                  placeholder="smtp.example.com"
                  value={config.smtp.host}
                  onChange={(e) => updateSmtpConfig("host", e.target.value)}
                  className="bg-[#242636] border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpPort" className="text-slate-300">
                  SMTP 端口
                </Label>
                <Input
                  id="smtpPort"
                  placeholder="587"
                  value={config.smtp.port}
                  onChange={(e) => updateSmtpConfig("port", e.target.value)}
                  className="bg-[#242636] border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpUser" className="text-slate-300">
                  SMTP 用户名
                </Label>
                <Input
                  id="smtpUser"
                  placeholder="user@example.com"
                  value={config.smtp.user}
                  onChange={(e) => updateSmtpConfig("user", e.target.value)}
                  className="bg-[#242636] border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpPass" className="text-slate-300">
                  SMTP 密码
                </Label>
                <Input
                  id="smtpPass"
                  type="password"
                  placeholder="••••••••"
                  value={config.smtp.pass}
                  onChange={(e) => updateSmtpConfig("pass", e.target.value)}
                  className="bg-[#242636] border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="text-xs text-slate-500 mt-4">
                SMTP 配置用于 Worker 发送邮件功能
              </div>
            </div>
          )}

          {activeTab === "mcp" && (
            <div className="space-y-3">
              <p className="text-sm text-slate-400 mb-4">
                选择要启用的 MCP 技能，Worker 将能够使用这些技能执行任务
              </p>
              {AVAILABLE_MCP_SKILLS.map((skill) => (
                <div
                  key={skill.id}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                    config.mcpSkills.includes(skill.id)
                      ? "bg-emerald-500/10 border-emerald-500/50"
                      : "bg-slate-800/50 border-slate-700 hover:border-slate-600"
                  }`}
                  onClick={() => toggleMcpSkill(skill.id)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        config.mcpSkills.includes(skill.id)
                          ? "bg-emerald-500/20"
                          : "bg-slate-700"
                      }`}
                    >
                      <Wrench
                        className={`w-4 h-4 ${
                          config.mcpSkills.includes(skill.id)
                            ? "text-emerald-400"
                            : "text-slate-400"
                        }`}
                      />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">
                        {skill.name}
                      </div>
                      <div className="text-xs text-slate-400">
                        {skill.description}
                      </div>
                    </div>
                  </div>
                  {config.mcpSkills.includes(skill.id) && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      已启用
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === "agent" && (
            <div className="space-y-2">
              <Label htmlFor="agentMd" className="text-slate-300">
                Agent.md 智能体配置
              </Label>
              <p className="text-xs text-slate-500 mb-2">
                使用 Markdown 格式定义智能体的角色、能力和行为规范
              </p>
              <textarea
                id="agentMd"
                rows={15}
                value={config.agentMd}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, agentMd: e.target.value }))
                }
                className="w-full bg-[#242636] border border-slate-600 rounded-lg px-3 py-2 text-sm text-white font-mono resize-none focus:outline-none focus:border-emerald-500"
                placeholder="# Agent Configuration&#10;&#10;## Role&#10;..."
              />
            </div>
          )}
        </CardContent>

        {/* Footer */}
        <div className="border-t border-slate-700 px-6 py-4 flex justify-end gap-3 shrink-0">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-slate-600 text-slate-300 hover:text-white hover:bg-slate-700"
          >
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || isLoading}
            className="bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? "保存中..." : "保存配置"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
