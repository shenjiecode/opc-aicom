import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Contract, ContractStage, ContractStatus, StageType, ContractStageStatus } from "@/types/models";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  FileText,
  DollarSign,
  Calendar,
  User,
  CheckCircle,
  Clock,
  Loader2,
  Upload,
  PenLine,
  Play,
  RefreshCw,
  Flag,
  AlertCircle,
  FileCheck,
  Send,
} from "lucide-react";

interface ContractDetailResponse {
  contract: Contract;
  stages: ContractStage[];
  publisher_name: string;
  agent_name: string;
}

interface StageConfig {
  type: StageType;
  label: string;
  description: string;
  icon: React.ReactNode;
  actionLabel: string;
  actionIcon: React.ReactNode;
}

const STAGE_CONFIG: StageConfig[] = [
  {
    type: "signing",
    label: "签署合同",
    description: "双方确认合同条款并签署",
    icon: <FileText className="w-5 h-5" />,
    actionLabel: "签署合同",
    actionIcon: <PenLine className="w-4 h-4" />,
  },
  {
    type: "executing",
    label: "项目执行",
    description: "按合同约定执行任务",
    icon: <Play className="w-5 h-5" />,
    actionLabel: "开始执行",
    actionIcon: <Play className="w-4 h-4" />,
  },
  {
    type: "accepting",
    label: "成果验收",
    description: "提交并验收项目成果",
    icon: <FileCheck className="w-5 h-5" />,
    actionLabel: "提交成果",
    actionIcon: <Send className="w-4 h-4" />,
  },
  {
    type: "completed",
    label: "项目完成",
    description: "合同履行完毕",
    icon: <Flag className="w-5 h-5" />,
    actionLabel: "完成项目",
    actionIcon: <CheckCircle className="w-4 h-4" />,
  },
];

const getStatusBadgeVariant = (status: ContractStatus) => {
  switch (status) {
    case "signing":
      return "bg-amber-500/20 text-amber-400 border-amber-500/40";
    case "executing":
      return "bg-blue-500/20 text-blue-400 border-blue-500/40";
    case "accepting":
      return "bg-violet-500/20 text-violet-400 border-violet-500/40";
    case "completed":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
    default:
      return "bg-slate-500/20 text-slate-400 border-slate-500/40";
  }
};

const getStageStatusIcon = (status: ContractStageStatus) => {
  switch (status) {
    case "completed":
      return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    case "in_progress":
      return <Clock className="w-4 h-4 text-blue-400 animate-pulse" />;
    case "failed":
      return <AlertCircle className="w-4 h-4 text-red-400" />;
    default:
      return <div className="w-4 h-4 rounded-full border border-slate-600" />;
  }
};

const getStatusLabel = (status: ContractStatus) => {
  switch (status) {
    case "signing":
      return "待签署";
    case "executing":
      return "执行中";
    case "accepting":
      return "验收中";
    case "completed":
      return "已完成";
    default:
      return status;
  }
};

export default function ContractDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [contract, setContract] = useState<Contract | null>(null);
  const [stages, setStages] = useState<ContractStage[]>([]);
  const [publisherName, setPublisherName] = useState("");
  const [agentName, setAgentName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSigning, setIsSigning] = useState(false);
  const [isUpdatingStage, setIsUpdatingStage] = useState(false);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    fetchContract();
  }, [id]);

  const fetchContract = async () => {
    try {
      const result = await apiFetch<ContractDetailResponse>(`/contracts/${id}`);
      setContract(result.contract);
      setStages(result.stages);
      setPublisherName(result.publisher_name);
      setAgentName(result.agent_name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取合同失败");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSign = async () => {
    setIsSigning(true);
    try {
      await apiFetch(`/contracts/${id}/sign`, {
        method: "PUT",
      });
      await fetchContract();
    } catch (err) {
      setError(err instanceof Error ? err.message : "签署失败");
    } finally {
      setIsSigning(false);
    }
  };

  const handleUpdateStage = async (stageType: string) => {
    setIsUpdatingStage(true);
    try {
      await apiFetch(`/contracts/${id}/stage/${stageType}`, {
        method: "PUT",
        body: JSON.stringify({ status: "completed" }),
      });
      await fetchContract();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新阶段失败");
    } finally {
      setIsUpdatingStage(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getCurrentStageIndex = () => {
    if (!contract) return -1;
    return STAGE_CONFIG.findIndex((s) => s.type === contract.status);
  };

  const getStageByType = (type: StageType) => {
    return stages.find((s) => s.stage_type === type);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400 mb-4">{error || "合同不存在"}</p>
          <Button onClick={() => navigate("/tasks")} variant="outline">
            返回任务列表
          </Button>
        </div>
      </div>
    );
  }

  const currentStageIndex = getCurrentStageIndex();

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-slate-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回
        </button>

        {/* Contract Info Card */}
        <Card className="bg-[#1a1b26] border-slate-800 mb-8">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="w-6 h-6 text-violet-400" />
                  <CardTitle className="text-white text-xl">
                    合同 #{contract.id}
                  </CardTitle>
                </div>
                <CardDescription className="text-slate-400">
                  任务 #{contract.task_id} · 创建于 {formatDate(contract.created_at)}
                </CardDescription>
              </div>
              <Badge
                className={cn(
                  "border px-3 py-1",
                  getStatusBadgeVariant(contract.status)
                )}
              >
                {getStatusLabel(contract.status)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">发布者</p>
                  <p className="text-sm text-white font-medium">{publisherName}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">执行代理</p>
                  <p className="text-sm text-white font-medium">{agentName}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">合同金额</p>
                  <p className="text-sm text-white font-medium">
                    ¥{contract.total_amount.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">托管金额</p>
                  <p className="text-sm text-white font-medium">
                    ¥{contract.escrow_amount.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t border-slate-800">
              {contract.signed_at && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-400">签署时间:</span>
                  <span className="text-sm text-white">{formatDate(contract.signed_at)}</span>
                </div>
              )}
              {contract.completed_at && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm text-slate-400">完成时间:</span>
                  <span className="text-sm text-white">{formatDate(contract.completed_at)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stage Timeline */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-violet-400" />
            项目进度
          </h2>

          <div className="relative">
            {/* Progress Line */}
            <div className="absolute top-8 left-8 right-8 h-0.5 bg-slate-800">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-emerald-500 transition-all duration-500"
                style={{
                  width: `${
                    currentStageIndex >= 0
                      ? (currentStageIndex / (STAGE_CONFIG.length - 1)) * 100
                      : 0
                  }%`,
                }}
              />
            </div>

            {/* Stage Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
              {STAGE_CONFIG.map((stageConfig, index) => {
                const stageData = getStageByType(stageConfig.type);
                const isActive = index === currentStageIndex;
                const isCompleted = index < currentStageIndex;
                const isPending = index > currentStageIndex;

                return (
                  <Card
                    key={stageConfig.type}
                    className={cn(
                      "transition-all duration-300",
                      isActive &&
                        "bg-gradient-to-br from-violet-500/10 to-blue-500/10 border-violet-500/40 ring-1 ring-violet-500/20",
                      isCompleted &&
                        "bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/40",
                      !isActive &&
                        !isCompleted &&
                        "bg-[#1a1b26] border-slate-800 opacity-70"
                    )}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div
                          className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center",
                            isActive && "bg-violet-500/20 text-violet-400",
                            isCompleted && "bg-emerald-500/20 text-emerald-400",
                            isPending && "bg-slate-800 text-slate-500"
                          )}
                        >
                          {getStageStatusIcon(stageData?.status || "pending")}
                        </div>
                        {isActive && (
                          <Badge className="bg-violet-500/20 text-violet-300 border border-violet-500/40">
                            当前
                          </Badge>
                        )}
                        {isCompleted && (
                          <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            已完成
                          </Badge>
                        )}
                      </div>
                      <CardTitle
                        className={cn(
                          "text-base mt-3",
                          isActive && "text-white",
                          isCompleted && "text-white",
                          isPending && "text-slate-400"
                        )}
                      >
                        {stageConfig.label}
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-400">
                        {stageConfig.description}
                      </CardDescription>
                    </CardHeader>

                    <CardContent>
                      {stageData && stageData.started_at && (
                        <p className="text-xs text-slate-500 mb-2">
                          开始: {formatDate(stageData.started_at)}
                        </p>
                      )}
                      {stageData && stageData.completed_at && (
                        <p className="text-xs text-slate-500 mb-2">
                          完成: {formatDate(stageData.completed_at)}
                        </p>
                      )}
                      {stageData?.ai_evaluation && (
                        <p className="text-xs text-slate-400 mb-2">
                          AI评估: {stageData.ai_evaluation}
                        </p>
                      )}
                      {stageData?.human_decision && (
                        <p className="text-xs text-slate-400 mb-2">
                          人工决策: {stageData.human_decision}
                        </p>
                      )}

                      {/* Action Buttons */}
                      {isActive && (
                        <div className="mt-4 space-y-2">
                          {stageConfig.type === "signing" && (
                            <Button
                              size="sm"
                              className="w-full bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white"
                              onClick={handleSign}
                              disabled={isSigning}
                            >
                              {isSigning ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                  签署中...
                                </>
                              ) : (
                                <>
                                  {stageConfig.actionIcon}
                                  <span className="ml-1.5">{stageConfig.actionLabel}</span>
                                </>
                              )}
                            </Button>
                          )}

                          {(stageConfig.type === "executing" ||
                            stageConfig.type === "accepting" ||
                            stageConfig.type === "completed") && (
                            <div className="space-y-2">
                              {/* File Upload */}
                              <div className="relative">
                                <input
                                  type="file"
                                  id={`file-upload-${stageConfig.type}`}
                                  className="hidden"
                                  onChange={handleFileUpload}
                                  accept=".pdf,.doc,.docx,.zip,.rar"
                                />
                                <label
                                  htmlFor={`file-upload-${stageConfig.type}`}
                                  className={cn(
                                    "flex items-center justify-center w-full px-3 py-2 text-xs rounded-md border border-dashed cursor-pointer transition-colors",
                                    selectedFile
                                      ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                                      : "border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300"
                                  )}
                                >
                                  <Upload className="w-3.5 h-3.5 mr-1.5" />
                                  {selectedFile ? selectedFile.name.slice(0, 20) + "..." : "上传交付物"}
                                </label>
                              </div>

                              <Button
                                size="sm"
                                className="w-full bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white"
                                onClick={() => handleUpdateStage(stageConfig.type)}
                                disabled={isUpdatingStage}
                              >
                                {isUpdatingStage ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                    处理中...
                                  </>
                                ) : (
                                  <>
                                    {stageConfig.actionIcon}
                                    <span className="ml-1.5">{stageConfig.actionLabel}</span>
                                  </>
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Stage Info for non-active stages */}
                      {!isActive && stageData?.deliverables && (
                        <div className="mt-2 p-2 bg-slate-900/50 rounded-md">
                          <p className="text-xs text-slate-400">交付物:</p>
                          <p className="text-xs text-slate-300 line-clamp-2">
                            {stageData.deliverables}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>

        {/* Contract Description */}
        {stages.map((stage) => (
          stage.description && (
            <Card key={stage.id} className="bg-[#1a1b26] border-slate-800 mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-slate-300">
                  {STAGE_CONFIG.find(s => s.type === stage.stage_type)?.label} 描述
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-400 whitespace-pre-wrap">
                  {stage.description}
                </p>
              </CardContent>
            </Card>
          )
        ))}

        {/* Error Display */}
        {error && (
          <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Refresh Button */}
        <div className="mt-8 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchContract}
            disabled={isLoading}
            className="border-slate-700 text-slate-400 hover:text-white hover:border-slate-600"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
            刷新合同状态
          </Button>
        </div>
      </div>
    </div>
  );
}
