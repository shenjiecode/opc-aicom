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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sparkles,
  Zap,
  ArrowRight,
  CheckCircle2,
  Star,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getSession,
  selectSkills,
  generateConfig,
} from "@/lib/api/agentbaba";
import type { AgentBabaSession, MatchedSkill } from "@/types/agentbaba";

export default function SkillMatchPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<AgentBabaSession | null>(null);
  const [matchedSkills, setMatchedSkills] = useState<MatchedSkill[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<number[]>([]);
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

      if (result.session.matched_skills_json) {
        const parsed: MatchedSkill[] = JSON.parse(result.session.matched_skills_json);
        setMatchedSkills(parsed);
      }
    } catch (err) {
      console.error("Failed to load session:", err);
    }
  };

  const handleToggleSkill = (skillId: number) => {
    setSelectedSkills((prev) =>
      prev.includes(skillId)
        ? prev.filter((id) => id !== skillId)
        : [...prev, skillId]
    );
  };

  const handleSelectAll = () => {
    const allIds = matchedSkills.map((s) => s.skill_id);
    if (selectedSkills.length === allIds.length) {
      setSelectedSkills([]);
    } else {
      setSelectedSkills(allIds);
    }
  };

  const handleConfirm = async () => {
    if (selectedSkills.length === 0) return;

    setLoading(true);
    try {
      await selectSkills(Number(sessionId), selectedSkills);
      await generateConfig(Number(sessionId));
      navigate(`/agentbaba/${sessionId}/config`);
    } catch (err) {
      console.error("Failed to select skills:", err);
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
                      idx + 1 <= 3
                        ? "bg-[var(--primary-500)] text-white"
                        : "bg-[var(--bg-muted)] text-[var(--text-muted)]"
                    )}
                  >
                    {idx + 1 <= 3 ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                  </div>
                  <span
                    className={cn(
                      "text-sm",
                      idx + 1 <= 3
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
            <Sparkles className="w-3 h-3 mr-1" />
            Skill 匹配
          </Badge>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
            为你推荐的最佳 Skill
          </h1>
          <p className="text-[var(--text-secondary)]">
            根据你的需求描述，智能匹配了以下 Skill，请选择需要的功能
          </p>
        </div>

        {/* Skill Cards */}
        <div className="space-y-4 mb-8">
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-secondary)]">
              已选择 {selectedSkills.length}/{matchedSkills.length} 个
            </span>
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              {selectedSkills.length === matchedSkills.length ? "取消全选" : "全选"}
            </Button>
          </div>

          {matchedSkills.map((skill) => (
            <Card
              key={skill.skill_id}
              className={cn(
                "bg-[var(--bg-elevated)] border-[var(--border-default)] transition-all cursor-pointer",
                selectedSkills.includes(skill.skill_id)
                  ? "border-[var(--primary-500)] bg-[var(--primary-500)]/5"
                  : "hover:border-[var(--primary-500)]/30"
              )}
              onClick={() => handleToggleSkill(skill.skill_id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start gap-4">
                  <Checkbox
                    checked={selectedSkills.includes(skill.skill_id)}
                    onCheckedChange={() => handleToggleSkill(skill.skill_id)}
                    className="data-[state=checked]:bg-[var(--primary-500)]"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-lg text-[var(--text-primary)]">
                        {skill.display_name}
                      </CardTitle>
                      <Badge
                        variant="outline"
                        className="bg-[var(--primary-500)]/10 text-[var(--primary-400)]"
                      >
                        匹配度 {Math.round(skill.relevance_score * 100)}%
                      </Badge>
                    </div>
                    <p className="text-[var(--text-secondary)] text-sm">
                      {skill.reason}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-4 ml-8">
                  <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                    <Star className="w-3 h-3" />
                    <span>推荐</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
                    <Users className="w-3 h-3" />
                    <span>热门</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Confirm Button */}
        <Card className="bg-gradient-to-br from-[var(--primary-500)]/10 to-purple-500/10 border-[var(--primary-500)]/30">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                  确认选择
                </h3>
                <p className="text-[var(--text-secondary)] text-sm">
                  选择 {selectedSkills.length} 个 Skill，下一步将生成 Agent 配置
                </p>
              </div>
              <Button
                onClick={handleConfirm}
                disabled={selectedSkills.length === 0 || loading}
                className="bg-[var(--primary-500)] hover:bg-[var(--primary-400)]"
              >
                <Zap className="w-4 h-4 mr-2" />
                {loading ? "处理中..." : "生成配置"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}