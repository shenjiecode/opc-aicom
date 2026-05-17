import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowRight,
  CheckCircle2,
  Settings,
  Zap,
  Edit3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getSession, buildAgent } from "@/lib/api/agentbaba";
import type { AgentBabaSession, AgentConfig } from "@/types/agentbaba";

export default function ConfigPreviewPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<AgentBabaSession | null>(null);
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [configJson, setConfigJson] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sessionId) {
      loadSession();
    }
  }, [sessionId]);

  const loadSession = async () => {
    try {
      const result = await getSession(Number(sessionId));
      setSession(result.session);

      if (result.session.agent_config_json) {
        const parsed: AgentConfig = JSON.parse(result.session.agent_config_json);
        setConfig(parsed);
        setConfigJson(JSON.stringify(parsed, null, 2));
      }
    } catch (err) {
      console.error("Failed to load session:", err);
    }
  };

  const handleBuild = async () => {
    setLoading(true);
    try {
      await buildAgent(Number(sessionId));
      navigate(`/agentbaba/${sessionId}/build`);
    } catch (err) {
      console.error("Failed to build:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary-500)]" />
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col bg-[var(--bg-default)]">
      {/* Progress Steps */}
      <div className="bg-[var(--bg-elevated)] border-b border-[var(--border-default)] px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            {["需求分析", "对话澄清", "Skill匹配", "配置生成", "构建部署", "测试验证"].map(
              (step, idx) => (
                <div key={step} className="flex items-center gap-2">
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                      idx + 1 <= 4
                        ? "bg-[var(--primary-500)] text-white"
                        : "bg-[var(--bg-muted)] text-[var(--text-muted)]"
                    )}
                  >
                    {idx + 1 <= 4 ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                  </div>
                  <span
                    className={cn(
                      "text-sm",
                      idx + 1 <= 4
                        ? "text-[var(--primary-400)]"
                        : "text-[var(--text-muted)]"
                    )}
                  >
                    {step}
                  </span>
                  {idx < 5 && (
                    <ArrowRight className="w-4 h-4 text-[var(--text-muted)] ml-2" />
                  )}
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Badge className="bg-[var(--primary-500)]/10 text-[var(--primary-400)] mb-4">
            <Settings className="w-3 h-3 mr-1" />
            配置预览
          </Badge>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
            Agent 配置
          </h1>
          <p className="text-[var(--text-secondary)]">
            检查生成的配置，确认后开始构建
          </p>
        </div>

        {/* Config Card */}
        <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)] mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg text-[var(--text-primary)]">
                {config?.name || "Agent 配置"}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditMode(!editMode)}
                className="border-[var(--border-default)]"
              >
                <Edit3 className="w-4 h-4 mr-2" />
                {editMode ? "预览模式" : "编辑"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {editMode ? (
              <Textarea
                value={configJson}
                onChange={(e) => setConfigJson(e.target.value)}
                rows={16}
                className="font-mono text-sm bg-[var(--bg-muted)] border-[var(--border-default)]"
              />
            ) : (
              <div className="space-y-4">
                {config && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-[var(--text-muted)]">名称</label>
                        <p className="text-[var(--text-primary)]">{config.name}</p>
                      </div>
                      <div>
                        <label className="text-xs text-[var(--text-muted)]">模型</label>
                        <p className="text-[var(--text-primary)]">{config.model}</p>
                      </div>
                      <div>
                        <label className="text-xs text-[var(--text-muted)]">温度</label>
                        <p className="text-[var(--text-primary)]">{config.temperature}</p>
                      </div>
                      <div>
                        <label className="text-xs text-[var(--text-muted)]">最大Token</label>
                        <p className="text-[var(--text-primary)]">{config.max_tokens}</p>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-[var(--text-muted)]">系统提示词</label>
                      <p className="text-[var(--text-secondary)] text-sm mt-1 p-3 bg-[var(--bg-muted)] rounded-md">
                        {config.system_prompt || "未设置"}
                      </p>
                    </div>

                    {config.skills && config.skills.length > 0 && (
                      <div>
                        <label className="text-xs text-[var(--text-muted)] mb-2 block">
                          已选 Skill
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {config.skills.map((skill) => (
                            <Badge key={skill.name} variant="outline">
                              {skill.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {config.mcp_servers && config.mcp_servers.length > 0 && (
                      <div>
                        <label className="text-xs text-[var(--text-muted)] mb-2 block">
                          MCP 服务器
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {config.mcp_servers.map((mcp) => (
                            <Badge key={mcp.name} variant="outline">
                              {mcp.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Build Button */}
        <Card className="bg-gradient-to-br from-[var(--primary-500)]/10 to-purple-500/10 border-[var(--primary-500)]/30">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                  配置确认
                </h3>
                <p className="text-[var(--text-secondary)] text-sm">
                  确认配置无误后，开始构建 Agent
                </p>
              </div>
              <Button
                onClick={handleBuild}
                disabled={loading}
                className="bg-[var(--primary-500)] hover:bg-[var(--primary-400)]"
              >
                <Zap className="w-4 h-4 mr-2" />
                {loading ? "构建中..." : "开始构建"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}