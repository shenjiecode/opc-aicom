import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FolderKanban,
  Users,
  Clock,
  MessageCircle,
  FileText,
  CheckCircle,
  Play,
  Flag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { listProjects } from '@/lib/api/project';
import { useNavigate } from 'react-router-dom';
// Project type defined inline (interfaces imported from modules cause Vite issues)
interface ProjectType {
  id: number;
  contract_id: number;
  task_id: number;
  title: string;
  description: string;
  status: string;
  progress: number;
  budget: number;
  owner_id: number;
  owner_name: string;
  agent_id: number;
  agent_name: string;
  chat_room_id: string;
  chat_room_name: string;
  prd_document: string;
  created_at?: string;
  updated_at?: string;
}

interface ProjectCardProps {
  project: ProjectType;
}
interface ProjectCardProps {
  project: Project;
}

const STATUS_CONFIG = {
  signing: { label: "签约中", color: "bg-amber-500/20 text-amber-500", icon: CheckCircle },
  executing: { label: "执行中", color: "bg-blue-500/20 text-blue-500", icon: Play },
  completed: { label: "已完成", color: "bg-emerald-500/20 text-emerald-500", icon: Flag },
};

export function ProjectCard({ project }: ProjectCardProps) {
  const navigate = useNavigate();
  const statusConfig = STATUS_CONFIG[project.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.signing;
  const StatusIcon = statusConfig.icon;

  const handleOpenChat = () => {
    if (project.chat_room_id) {
      navigate(`/opc-workbench?room=${encodeURIComponent(project.chat_room_id)}`);
    }
  };

  const formatBudget = (amount: number) => {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: "CNY",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Card className="overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 bg-white rounded-xl border border-slate-100 group">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center">
              <FolderKanban className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm leading-tight">
                {project.title || "未命名项目"}
              </h3>
              <p className="text-xs text-slate-500">#{project.contract_id}</p>
            </div>
          </div>
          <span className={cn("flex items-center gap-1 text-xs px-2 py-1 rounded-full", statusConfig.color)}>
            <StatusIcon className="w-3 h-3" />
            {statusConfig.label}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-500">进度</span>
            <span className="text-violet-600 font-medium">{project.progress}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-violet-500 to-violet-400 rounded-full transition-all duration-500"
              style={{ width: `${project.progress}%` }}
            />
          </div>
        </div>

        {/* Info */}
        <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
          <div className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            <span>{project.owner_name} ↔ {project.agent_name}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>{new Date(project.updated_at).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Budget */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-slate-500">预算</span>
          <span className="text-lg font-bold text-violet-600">
            {formatBudget(project.budget)}
          </span>
        </div>

        {/* PRD Indicator */}
        {project.prd_document && (
          <div className="flex items-center gap-1 text-xs text-emerald-600 mb-3">
            <FileText className="w-3.5 h-3.5" />
            <span>PRD 文档已关联</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button 
            className="flex-1 h-8 bg-violet-500 hover:bg-violet-600 text-white text-xs"
            onClick={handleOpenChat}
            disabled={!project.chat_room_id}
          >
            <MessageCircle className="w-3.5 h-3.5 mr-1" />
            进入项目聊天室
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
