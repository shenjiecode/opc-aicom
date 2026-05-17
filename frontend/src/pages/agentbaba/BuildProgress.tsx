import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Container,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getSession, testAgent, deployAgent } from "@/lib/api/agentbaba";
import type { AgentBabaSession, TestResult } from "@/types/agentbaba";

const buildSteps = [
  { id: "validate", label: "验证配置", duration: 1500 },
  { id: "prepare", label: "准备环境", duration: 2000 },
  { id: "build", label: "构建镜像", duration: 3000 },
  { id: "container", label: "创建容器", duration: 2500 },
  { id: "deploy", label: "部署运行", duration: 2000 },
  { id: "health", label: "健康检查", duration: 1500 },
];

export default function BuildProgressPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<AgentBabaSession | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [building, setBuilding] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [deployed, setDeployed] = useState(false);

  useEffect(() => {
    if (sessionId) {
      loadSession();
      simulateBuild();
    }
  }, [sessionId]);

  const loadSession = async () => {
    try {
      const result = await getSession(Number(sessionId));
      setSession(result.session);
    } catch (err) {
      console.error("Failed to load session:", err);
    }
  };

  const simulateBuild = async () => {
    for (let i = 0; i < buildSteps.length; i++) {
      setCurrentStep(i);
      await new Promise((resolve) =>
        setTimeout(resolve, buildSteps[i].duration)
      );
    }
    setCurrentStep(buildSteps.length);
    setBuilding(false);
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await testAgent(Number(sessionId), [
        { name: "基础测试", input: "Hello", expected: "成功响应", timeout: 30 },
      ]);
      setTestResult(result.result);
    } catch (err) {
      console.error("Failed to test:", err);
    } finally {
      setTesting(false);
    }
  };

  const handleDeploy = async () => {
    try {
      await deployAgent(Number(sessionId));
      setDeployed(true);
    } catch (err) {
      console.error("Failed to deploy:", err);
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
                      idx + 1 <= (deployed ? 6 : 5)
                        ? "bg-[var(--primary-500)] text-white"
                        : "bg-[var(--bg-muted)] text-[var(--text-muted)]"
                    )}
                  >
                    {idx + 1 <= (deployed ? 6 : 5) ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-sm",
                      idx + 1 <= (deployed ? 6 : 5)
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
            <Container className="w-3 h-3 mr-1" />
            构建部署
          </Badge>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
            {building ? "正在构建 Agent..." : "构建完成"}
          </h1>
          <p className="text-[var(--text-secondary)]">
            {building ? "请稍候，Agent 正在构建中" : "Agent 已成功构建并部署"}
          </p>
        </div>

        {/* Build Progress */}
        <Card className="bg-[var(--bg-elevated)] border-[var(--border-default)] mb-6">
          <CardContent className="py-6">
            <div className="space-y-4">
              {buildSteps.map((step, idx) => (
                <div key={step.id} className="flex items-center gap-4">
                  <div
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center",
                      idx < currentStep
                        ? "bg-green-500 text-white"
                        : idx === currentStep && building
                        ? "bg-[var(--primary-500)] text-white"
                        : "bg-[var(--bg-muted)] text-[var(--text-muted)]"
                    )}
                  >
                    {idx < currentStep ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : idx === currentStep && building ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <span
                    className={cn(
                      "flex-1",
                      idx <= currentStep
                        ? "text-[var(--text-primary)]"
                        : "text-[var(--text-muted)]"
                    )}
                  >
                    {step.label}
                  </span>
                  {idx === currentStep && building && (
                    <span className="text-xs text-[var(--primary-400)]">
                      进行中...
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6">
              <Progress
                value={(currentStep / buildSteps.length) * 100}
                className="h-2"
              />
              <p className="text-xs text-[var(--text-muted)] mt-2 text-center">
                {Math.round((currentStep / buildSteps.length) * 100)}% 完成
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Test & Deploy */}
        {!building && (
          <Card className="bg-gradient-to-br from-[var(--primary-500)]/10 to-purple-500/10 border-[var(--primary-500)]/30">
            <CardContent className="py-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                  构建完成！下一步
                </h3>
                <p className="text-[var(--text-secondary)] text-sm">
                  可以选择测试 Agent 功能，或直接部署使用
                </p>

                {testResult && (
                  <div className="bg-[var(--bg-muted)] rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-[var(--text-primary)]">
                        测试结果
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          testResult.passed === testResult.total
                            ? "bg-green-500/10 text-green-400"
                            : "bg-amber-500/10 text-amber-400"
                        }
                      >
                        {testResult.passed}/{testResult.total} 通过
                      </Badge>
                    </div>
                  </div>
                )}

                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    onClick={handleTest}
                    disabled={testing}
                    className="border-[var(--border-default)]"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    {testing ? "测试中..." : "运行测试"}
                  </Button>
                  <Button
                    onClick={handleDeploy}
                    disabled={deployed}
                    className="bg-[var(--primary-500)] hover:bg-[var(--primary-400)]"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    {deployed ? "已部署" : "确认部署"}
                  </Button>
                </div>

                {deployed && (
                  <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <p className="text-green-400 text-sm">
                      Agent 已成功部署！你可以在创建记录中查看。
                    </p>
                    <Button
                      variant="link"
                      className="text-[var(--primary-400)] p-0 mt-2"
                      onClick={() => navigate("/agentbaba")}
                    >
                      返回创建记录 →
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
