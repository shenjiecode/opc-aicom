import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useAibitDrawer } from "@/contexts/AibitDrawerContext";
import {
  ArrowLeft,
  FileText,
  Sparkles,
  CheckCircle,
  Loader2,
  Building2,
  AlertCircle,
  MessageSquare,
} from "lucide-react";

interface AnalysisResult {
  title: string;
  description: string;
  type: string;
  level: string;
  budget: number;
  duration_days: number;
  skills: string[];
  urgency: boolean;
}

interface EnterprisePublishProps {
  modalMode?: boolean;
  onClose?: () => void;
  onPublishSuccess?: () => void;
}

interface ConfirmResponse {
  task_id: number;
}

export default function EnterprisePublish({ modalMode, onClose, onPublishSuccess }: EnterprisePublishProps) {
  const navigate = useNavigate();
  const { openDrawer } = useAibitDrawer();
  const [requirementText, setRequirementText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState("");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  const handleAibitGenerate = () => {
    if (!requirementText.trim()) {
      setError("请先输入需求描述");
      return;
    }
    setError("");
    openDrawer(`请根据以下需求描述，帮我生成一份完整的需求规格书：\n\n${requirementText}`);
  };

  const handleAnalyze = async () => {
    setError("");

    if (!requirementText.trim()) {
      setError("请输入需求描述");
      return;
    }

    setIsAnalyzing(true);

    try {
      const response = await apiFetch<AnalysisResult>("/publish/analyze", {
        method: "POST",
        body: JSON.stringify({
          type: "text",
          content: requirementText,
        }),
      });

      setAnalysisResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析失败，请重试");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirm = async () => {
    if (!analysisResult) return;

    setIsConfirming(true);
    setError("");

    try {
      await apiFetch<ConfirmResponse>("/publish/confirm", {
        method: "POST",
        body: JSON.stringify(analysisResult),
      });

      if (modalMode && onPublishSuccess) {
        onPublishSuccess();
      } else {
        navigate(`/tasks`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "发布失败，请重试");
      setIsConfirming(false);
    }
  };

  const handleEditResult = (field: keyof AnalysisResult, value: string | number | boolean) => {
    setAnalysisResult((prev) => {
      if (!prev) return null;
      return { ...prev, [field]: value };
    });
  };

  const handleEditSkills = (value: string) => {
    setAnalysisResult((prev) => {
      if (!prev) return null;
      return { ...prev, skills: value.split(",").map((s) => s.trim()).filter(Boolean) };
    });
  };

  return (
    <div className={cn(
      "bg-slate-50 flex flex-col overflow-hidden",
      modalMode ? "flex-1 h-full w-full relative" : "absolute inset-0"
    )}>
      {/* Header */}
      <div className="shrink-0 w-full px-6 py-4 flex items-center justify-between z-10 bg-white border-b border-slate-200">
        <div>
          <button
            onClick={() => {
              if (modalMode && onClose) {
                onClose();
              } else {
                navigate(-1);
              }
            }}
            className="flex items-center text-slate-500 hover:text-slate-800 mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回
          </button>
          <div className="flex items-center gap-2">
            <Building2 className="w-6 h-6 text-amber-600" />
            <h1 className="text-xl font-bold text-slate-800">企业需求发布</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            AI 智能分析需求，一键生成标准化任务
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto min-h-0 w-full">
        <div className="max-w-3xl mx-auto px-4 py-8 pb-32">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          )}

          {/* Input Section */}
          {!analysisResult && (
            <Card className="mb-6 border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-600" />
                  需求输入
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Text Input */}
                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-2 block">
                    需求描述 *
                  </Label>
                  <Textarea
                    value={requirementText}
                    onChange={(e) => setRequirementText(e.target.value)}
                    placeholder="请详细描述您的需求，包括项目背景、目标、技术要求、预算范围、交付时间等..."
                    className="min-h-[200px] resize-none"
                  />
                  <p className="text-xs text-slate-400 mt-2">
                    建议 100-500 字，描述越详细，AI 分析越精准
                  </p>
                </div>

                {/* Aibit Button */}
                <Button
                  onClick={handleAibitGenerate}
                  variant="outline"
                  className="w-full h-12 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-medium border-0"
                >
                  <MessageSquare className="w-5 h-5 mr-2" />
                  比特AI 帮忙生成需求规格书
                </Button>

                {/* Analyze Button */}
                <Button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="w-full h-12 bg-amber-600 hover:bg-amber-700 text-white font-medium"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      AI 分析中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
                      智能分析需求
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Analysis Result Section */}
          {analysisResult && (
            <>
              <Card className="mb-6 border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-600" />
                    AI 分析结果
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Title */}
                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-2 block">
                      任务标题
                    </Label>
                    <Input
                      value={analysisResult.title}
                      onChange={(e) => handleEditResult("title", e.target.value)}
                      className="font-medium"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-2 block">
                      任务描述
                    </Label>
                    <Textarea
                      value={analysisResult.description}
                      onChange={(e) => handleEditResult("description", e.target.value)}
                      className="min-h-[120px] resize-none"
                    />
                  </div>

                  {/* Two Column Layout */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Type */}
                    <div>
                      <Label className="text-sm font-medium text-slate-700 mb-2 block">
                        项目类型
                      </Label>
                      <Select
                        value={analysisResult.type}
                        onValueChange={(value) => handleEditResult("type", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="平面设计">平面设计</SelectItem>
                          <SelectItem value="UI/UX">UI/UX</SelectItem>
                          <SelectItem value="短视频">短视频</SelectItem>
                          <SelectItem value="软件开发">软件开发</SelectItem>
                          <SelectItem value="短剧">短剧</SelectItem>
                          <SelectItem value="IP联名">IP联名</SelectItem>
                          <SelectItem value="其他">其他</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Level */}
                    <div>
                      <Label className="text-sm font-medium text-slate-700 mb-2 block">
                        难度级别
                      </Label>
                      <Select
                        value={analysisResult.level}
                        onValueChange={(value) => handleEditResult("level", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="初级">初级</SelectItem>
                          <SelectItem value="中级">中级</SelectItem>
                          <SelectItem value="高级">高级</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Budget */}
                    <div>
                      <Label className="text-sm font-medium text-slate-700 mb-2 block">
                        预算 (元)
                      </Label>
                      <Input
                        type="number"
                        value={analysisResult.budget}
                        onChange={(e) => handleEditResult("budget", parseInt(e.target.value) || 0)}
                      />
                    </div>

                    {/* Duration */}
                    <div>
                      <Label className="text-sm font-medium text-slate-700 mb-2 block">
                        预计工期 (天)
                      </Label>
                      <Input
                        type="number"
                        value={analysisResult.duration_days}
                        onChange={(e) => handleEditResult("duration_days", parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  {/* Skills */}
                  <div>
                    <Label className="text-sm font-medium text-slate-700 mb-2 block">
                      所需技能 (逗号分隔)
                    </Label>
                    <Input
                      value={analysisResult.skills.join(", ")}
                      onChange={(e) => handleEditSkills(e.target.value)}
                      placeholder="例如: React, TypeScript, Node.js"
                    />
                  </div>

                  {/* Urgency */}
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="urgency"
                      checked={analysisResult.urgency}
                      onChange={(e) => handleEditResult("urgency", e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    <Label htmlFor="urgency" className="text-sm font-medium text-slate-700 cursor-pointer">
                      标记为急招
                    </Label>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-amber-200 bg-amber-50/50">
                <CardContent className="p-4 flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-800">
                      AI 分析完成
                    </p>
                    <p className="text-sm text-amber-700 mt-1">
                      请检查并调整分析结果，确认无误后点击发布任务。任务发布后将被推送给匹配的开发者。
                    </p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Fixed Action Bar */}
      {analysisResult && (
        <div className={cn(
          "p-4 bg-white/80 backdrop-blur-md border-t border-slate-200 z-20 flex justify-center",
          modalMode ? "shrink-0" : "fixed bottom-0 left-0 lg:left-[260px] right-0"
        )}>
          <div className="flex gap-4 w-full max-w-3xl px-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAnalysisResult(null)}
              className="flex-1 h-12 text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 shadow-sm border-slate-300 font-medium"
            >
              重新分析
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isConfirming}
              className="flex-1 h-12 bg-amber-600 hover:bg-amber-700 shadow-sm text-white font-medium"
            >
              {isConfirming ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  发布中...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 mr-2" />
                  确认发布
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}