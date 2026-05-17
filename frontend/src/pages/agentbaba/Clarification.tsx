import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquare,
  Send,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getSession,
  startClarification,
  answerQuestion,
  matchSkills,
} from "@/lib/api/agentbaba";
import type { ClarificationQuestion, AgentBabaSession } from "@/types/agentbaba";

export default function ClarificationPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<AgentBabaSession | null>(null);
  const [questions, setQuestions] = useState<ClarificationQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [_answers, setAnswers] = useState<Record<string, unknown>>({});
  const [currentAnswer, setCurrentAnswer] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [allAnswered, setAllAnswered] = useState(false);

  useEffect(() => {
    if (sessionId) {
      loadSession();
    }
  }, [sessionId]);

  const loadSession = async () => {
    try {
      const result = await getSession(Number(sessionId));
      setSession(result.session);

      if (result.session.status === "draft") {
        const clarifyResult = await startClarification(Number(sessionId));
        setQuestions(clarifyResult.questions);
      } else if (result.session.status === "clarifying") {
        const parsed: ClarificationQuestion[] = JSON.parse(
          result.session.clarification_json || "[]"
        );
        setQuestions(parsed);

        const savedAnswers = JSON.parse(result.session.answers_json || "{}");
        setAnswers(savedAnswers);

        const answeredCount = Object.keys(savedAnswers).length;
        setCurrentQuestionIndex(answeredCount);

        if (answeredCount >= parsed.length) {
          setAllAnswered(true);
        }
      }
    } catch (err) {
      console.error("Failed to load session:", err);
    }
  };

  const currentQuestion = questions[currentQuestionIndex];

  const handleAnswer = async () => {
    if (!currentQuestion || !currentAnswer) return;

    setLoading(true);
    try {
      const result = await answerQuestion(
        Number(sessionId),
        currentQuestion.id,
        currentAnswer
      );

      setAnswers((prev) => ({
        ...prev,
        [currentQuestion.id]: currentAnswer,
      }));

      if (result.completed) {
        setAllAnswered(true);
        console.log("[TEST LOG] Clarification: All questions answered, auto-jumping to skill matching");
        navigate(`/agentbaba/${sessionId}/skills`);
      } else {
        setQuestions(result.next_questions);
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        console.log("[TEST LOG] Clarification: Question answered, moving to next question", {
          currentQuestionIndex: currentQuestionIndex + 1,
          total: questions.length
        });
      }

      setCurrentAnswer("");
    } catch (err) {
      console.error("Failed to answer:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleMatchSkills = async () => {
    setLoading(true);
    try {
      await matchSkills(Number(sessionId));
      navigate(`/agentbaba/${sessionId}/skills`);
    } catch (err) {
      console.error("Failed to match skills:", err);
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
                <div
                  key={step}
                  className="flex items-center gap-2"
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                      idx + 1 <= 2
                        ? "bg-[var(--primary-500)] text-white"
                        : "bg-[var(--bg-muted)] text-[var(--text-muted)]"
                    )}
                  >
                    {idx + 1 <= 2 ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                  </div>
                  <span
                    className={cn(
                      "text-sm",
                      idx + 1 <= 2
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
            <MessageSquare className="w-3 h-3 mr-1" />
            对话澄清
          </Badge>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
            让我了解更多细节
          </h1>
          <p className="text-[var(--text-secondary)]">
            通过回答以下问题，帮助我更准确地理解你的需求
          </p>
        </div>

        {/* Session Info */}
        <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)] mb-8">
          <CardHeader>
            <CardTitle className="text-lg text-[var(--text-primary)]">
              {session.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[var(--text-secondary)]">{session.description}</p>
          </CardContent>
        </Card>

        {/* Question Card */}
        {currentQuestion && !allAnswered && (
          <Card className="bg-[var(--bg-elevated)] border-[var(--primary-500)]/30 mb-6">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--primary-500)] to-purple-500 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <div>
                  <Badge variant="outline" className="mb-2">
                    问题 {currentQuestionIndex + 1}/{questions.length}
                  </Badge>
                  <CardTitle className="text-lg text-[var(--text-primary)]">
                    {currentQuestion.question}
                  </CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentQuestion.type === "text" && (
                <Input
                  value={currentAnswer}
                  onChange={(e) => setCurrentAnswer(e.target.value)}
                  placeholder="请输入你的回答..."
                  className="bg-[var(--bg-muted)] border-[var(--border-default)]"
                />
              )}

              {currentQuestion.type === "select" && currentQuestion.options && (
                <Select value={currentAnswer} onValueChange={setCurrentAnswer}>
                  <SelectTrigger className="bg-[var(--bg-muted)] border-[var(--border-default)]">
                    <SelectValue placeholder="请选择..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--bg-elevated)] border-[var(--border-default)]">
                    {currentQuestion.options.map((opt) => (
                      <SelectItem
                        key={opt}
                        value={opt}
                        className="hover:bg-[var(--bg-muted)]"
                      >
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {currentQuestion.type === "number" && (
                <Input
                  type="number"
                  value={currentAnswer}
                  onChange={(e) => setCurrentAnswer(e.target.value)}
                  placeholder="请输入数字..."
                  className="bg-[var(--bg-muted)] border-[var(--border-default)]"
                />
              )}

              <Button
                onClick={handleAnswer}
                disabled={!currentAnswer || loading}
                className="bg-[var(--primary-500)] hover:bg-[var(--primary-400)]"
              >
                <Send className="w-4 h-4 mr-2" />
                {loading ? "处理中..." : "提交回答"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* All Answered */}
        {allAnswered && (
          <Card className="bg-gradient-to-br from-[var(--primary-500)]/10 to-purple-500/10 border-[var(--primary-500)]/30">
            <CardContent className="py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-[var(--primary-500)]/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-[var(--primary-400)]" />
              </div>
              <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                所有问题已回答完成
              </h3>
              <p className="text-[var(--text-secondary)] mb-6">
                现在可以开始匹配最适合的 Skill
              </p>
              <Button
                onClick={handleMatchSkills}
                disabled={loading}
                size="lg"
                className="bg-[var(--primary-500)] hover:bg-[var(--primary-400)]"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                {loading ? "匹配中..." : "开始匹配 Skill"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}