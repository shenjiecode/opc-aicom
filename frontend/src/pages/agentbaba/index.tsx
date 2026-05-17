import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Bot,
  Sparkles,
  Zap,
  CheckCircle2,
  Clock,
  AlertCircle,
  Play,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createSession,
  listSessions,
  type CreateSessionRequest,
} from "@/lib/api/agentbaba";
import type { AgentBabaSession, SessionStatus } from "@/types/agentbaba";
import { CreateSessionDialog } from "@/components/agentbaba/CreateSessionDialog";

const statusConfig: Record<
  SessionStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  draft: { label: "草稿", color: "bg-gray-500/10 text-gray-400", icon: <Clock className="w-3 h-3" /> },
  clarifying: { label: "澄清中", color: "bg-blue-500/10 text-blue-400", icon: <Sparkles className="w-3 h-3" /> },
  configuring: { label: "配置中", color: "bg-amber-500/10 text-amber-400", icon: <Zap className="w-3 h-3" /> },
  building: { label: "构建中", color: "bg-purple-500/10 text-purple-400", icon: <Bot className="w-3 h-3" /> },
  testing: { label: "测试中", color: "bg-cyan-500/10 text-cyan-400", icon: <Play className="w-3 h-3" /> },
  completed: { label: "已完成", color: "bg-green-500/10 text-green-400", icon: <CheckCircle2 className="w-3 h-3" /> },
  failed: { label: "失败", color: "bg-red-500/10 text-red-400", icon: <AlertCircle className="w-3 h-3" /> },
};

const stepLabels = [
  "需求分析",
  "对话澄清",
  "Skill匹配",
  "配置生成",
  "构建部署",
  "测试验证",
];

export default function AgentBaba() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<AgentBabaSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const result = await listSessions();
      setSessions(result.list || []);
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async (data: CreateSessionRequest) => {
    const result = await createSession(data);
    navigate(`/agentbaba/${result.session_id}`);
  };

  return (
    <div className="min-h-full flex flex-col bg-[var(--bg-default)]">
      {/* Header */}
      <div className="h-[var(--header-height)] border-b border-slate-100 flex items-center justify-between px-6 bg-white shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Package className="w-8 h-8 text-indigo-500" />
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">AgentBaba</h1>
          <p className="text-slate-500 text-sm ml-4 border-l border-slate-200 pl-4">
            创建和管理您的专属智能体
          </p>
        </div>
      </div>

      {/* Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[var(--primary-900)] via-[var(--primary-800)] to-[var(--bg-default)] border-b border-[var(--border-default)]">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-20 w-72 h-72 bg-[var(--primary-500)] rounded-full filter blur-[100px] animate-pulse" />
          <div className="absolute bottom-10 right-20 w-96 h-96 bg-purple-500 rounded-full filter blur-[120px] animate-pulse" style={{ animationDelay: "1s" }} />
          <div className="absolute top-40 right-40 w-48 h-48 bg-cyan-500 rounded-full filter blur-[80px] animate-pulse" style={{ animationDelay: "2s" }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 lg:px-8 py-16 lg:py-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--primary-500)]/10 border border-[var(--primary-500)]/20 text-[var(--primary-400)] text-sm font-medium mb-8 backdrop-blur-sm">
              <Sparkles className="w-4 h-4" />
              <span>AgentBaba - 智能体工厂</span>
            </div>

            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-[var(--text-primary)] mb-6 tracking-tight leading-tight">
              告诉我你想要什么
              <br />
              <span className="text-[var(--primary-400)]">我来帮你创建</span>
            </h1>

            <p className="text-xl text-[var(--text-secondary)] mb-10 leading-relaxed max-w-2xl">
              用自然语言描述你的需求，AgentBaba 会通过对话澄清细节，
              自动匹配最合适的 Skill，一键创建并部署你的专属智能体。
            </p>

            <Button
              size="lg"
              onClick={() => setDialogOpen(true)}
              className="bg-[var(--primary-500)] hover:bg-[var(--primary-400)] text-white text-lg px-8 py-6 shadow-2xl shadow-[var(--primary-500)]/30 transition-all duration-300 hover:scale-105"
            >
              <Plus className="w-5 h-5 mr-3" />
              开始创建 Agent
            </Button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 max-w-7xl mx-auto px-6 lg:px-8 py-12 w-full">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-semibold text-[var(--text-primary)]">
              我的创建记录
            </h2>
            <p className="text-[var(--text-secondary)] mt-1">
              查看所有 Agent 创建会话和进度
            </p>
          </div>
          <Button variant="outline" onClick={fetchSessions} disabled={loading}>
            刷新
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary-500)]" />
          </div>
        ) : sessions.length === 0 ? (
          <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)] border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-20">
              <div className="w-20 h-20 rounded-full bg-[var(--bg-muted)] flex items-center justify-center mb-6">
                <Bot className="w-10 h-10 text-[var(--text-muted)]" />
              </div>
              <p className="text-[var(--text-secondary)] text-lg mb-4">
                还没有创建任何 Agent
              </p>
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                创建第一个 Agent
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessions.map((session) => (
              <Card
                key={session.id}
                className="group bg-[var(--bg-elevated)] border-[var(--border-default)] hover:border-[var(--primary-500)]/50 transition-all duration-300 cursor-pointer"
                onClick={() => navigate(`/agentbaba/${session.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-normal",
                        statusConfig[session.status].color
                      )}
                    >
                      {statusConfig[session.status].icon}
                      <span className="ml-1">{statusConfig[session.status].label}</span>
                    </Badge>
                    <span className="text-xs text-[var(--text-muted)]">
                      步骤 {session.current_step}/6
                    </span>
                  </div>
                  <CardTitle className="text-lg mt-3 text-[var(--text-primary)]">
                    {session.title || "未命名 Agent"}
                  </CardTitle>
                </CardHeader>

                <CardContent className="pb-4">
                  <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-4">
                    {session.description || "暂无描述"}
                  </p>

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-[var(--text-muted)]">
                      <span>{stepLabels[session.current_step - 1] || "未开始"}</span>
                      <span>{Math.round((session.current_step / 6) * 100)}%</span>
                    </div>
                    <div className="h-1.5 bg-[var(--bg-muted)] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[var(--primary-500)] transition-all duration-500 rounded-full"
                        style={{ width: `${(session.current_step / 6) * 100}%` }}
                      />
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="pt-0 border-t border-[var(--border-default)]">
                  <Button variant="ghost" className="w-full mt-4 text-[var(--text-secondary)] hover:text-[var(--primary-400)]">
                    继续编辑
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CreateSessionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleCreateSession}
      />
    </div>
  );
}
