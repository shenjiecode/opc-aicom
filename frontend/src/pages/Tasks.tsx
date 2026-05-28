import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Search, Pin, Clock, Flame, MessageCircle, Megaphone, Hand, CheckCircle, ExternalLink, FolderKanban } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { apiFetch, getCurrentUser } from "@/lib/api";
import { listProjects } from '@/lib/api/project';
import { ProjectCard } from '@/components/ProjectCard';
import EnterprisePublish from './EnterprisePublish';
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

interface Task {
  id: number;
  title: string;
  description: string;
  budget: number;
  type: string;
  level: string;
  urgent: boolean;
  duration_days: number;
  applicants_count: number;
  created_at: string;
  user_id: number;
  contract_id?: number;
  status: string;
  required_skills?: string[];
}

interface TaskListResponse {
  list: Task[];
  total: number;
}

interface BroadcastResponse {
  notified_count: number;
  agent_ids: number[];
}

interface AcceptResponse {
  contract_id: number;
}

const PROJECT_TYPES = [
  "全部",
  "平面设计",
  "UI/UX",
  "短视频",
  "软件开发",
  "短剧",
  "IP联名",
];

const DIFFICULTY_LEVELS = ["全部", "初级", "中级", "高级"];

export default function Tasks() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<{ userId: number; username: string } | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeType, setActiveType] = useState("全部");
  const [activeLevel, setActiveLevel] = useState("全部");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Broadcast state
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [broadcastTaskType, setBroadcastTaskType] = useState("dev");
  const [broadcastSkills, setBroadcastSkills] = useState("");
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  
  const [isAcceptModalOpen, setIsAcceptModalOpen] = useState(false);
  const [acceptMessage, setAcceptMessage] = useState("");
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptSuccess, setAcceptSuccess] = useState(false);
  const [acceptedContractId, setAcceptedContractId] = useState<number | null>(null);
  
  // Publish modal state
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  
  // Projects state
  const [projects, setProjects] = useState<ProjectType[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
useEffect(() => {
fetchTasks();
  }, [activeType, activeLevel]);

  useEffect(() => {
    // Fetch current user on mount
    getCurrentUser().then(user => {
      setCurrentUser(user);
    }).catch(() => {
      setCurrentUser(null);
    });
  }, []);

  // Fetch projects on mount
  useEffect(() => {
    const fetchProjects = async () => {
      setIsLoadingProjects(true);
      try {
        const result = await listProjects(1, 10);
        setProjects(result.projects || []);
      } catch (err) {
        console.error("Failed to load projects", err);
      } finally {
        setIsLoadingProjects(false);
      }
    };
    fetchProjects();
  }, []);

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const result = await apiFetch<TaskListResponse>("/tasks/list", {
        method: "POST",
        body: JSON.stringify({
          page: 1,
          pageSize: 20,
          type: activeType === "全部" ? "" : activeType,
          level: activeLevel === "全部" ? "" : activeLevel,
        }),
      });
      setTasks(result.list || []);
    } catch (err) {
      console.error("Failed to load tasks", err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: "CNY",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Fake avatars for the UI demo based on the applicants_count
  const generateMockAvatars = (count: number) => {
    const letters = ["A", "B", "C", "D", "E"];
    const colors = [
      "bg-green-400",
      "bg-blue-400",
      "bg-purple-400",
      "bg-rose-400",
      "bg-amber-400",
    ];
    const displayCount = Math.min(count, 3);

    return Array.from({ length: displayCount }).map((_, i) => ({
      letter: letters[i % letters.length],
      color: colors[i % colors.length],
    }));
  };

  const openDetail = (task: Task) => {
    setSelectedTask(task);
    setIsDialogOpen(true);
  };

  const handleChat = async (task: Task) => {
    try {
      // Create task chat room
      const result = await apiFetch<{ room_id: string; room_name: string; is_new: boolean }>(
        `/task/${task.id}/chat-room`,
        {
          method: "POST",
          body: JSON.stringify({
            name: `任务#${task.id}-${task.title.slice(0, 10)}`,
            topic: `关于任务#${task.id}的沟通讨论`,
          }),
        }
      );
      
      // Close dialog
      setIsDialogOpen(false);
      
      // Navigate to OPC workbench with room ID
navigate(`/opc-workbench?room=${encodeURIComponent(result.room_id)}`);
} catch (err) {
console.error("Failed to create chat room", err);
alert("创建聊天房间失败，请稍后重试");
}
  };

  const handleBroadcast = async () => {
    if (!selectedTask) return;
    
    setIsBroadcasting(true);
    try {
      const skills = broadcastSkills
        .split(",")
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      const result = await apiFetch<BroadcastResponse>(`/tasks/${selectedTask.id}/broadcast`, {
        method: "POST",
        body: JSON.stringify({
          task_type: broadcastTaskType,
          required_skills: skills,
        }),
      });
      
      alert(`广播成功！已通知 ${result.notified_count} 个智能体`);
      setIsBroadcastModalOpen(false);
    } catch (err) {
      console.error("Failed to broadcast task", err);
      alert("广播任务失败，请稍后重试");
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleAccept = async () => {
    if (!selectedTask) return;
    
    setIsAccepting(true);
    try {
      const result = await apiFetch<AcceptResponse>(`/task/${selectedTask.id}/accept`, {
        method: "POST",
        body: JSON.stringify({
          message: acceptMessage,
        }),
      });
      
      setAcceptedContractId(result.contract_id);
      setAcceptSuccess(true);
      fetchTasks(); // Refresh the list
    } catch (err) {
      console.error("Failed to accept task", err);
      alert("接单失败，可能您已申请过此任务");
    } finally {
      setIsAccepting(false);
    }
  };

  const openBroadcastModal = (task: Task) => {
    setSelectedTask(task);
    setBroadcastTaskType("dev");
    setBroadcastSkills("");
    setIsBroadcastModalOpen(true);
  };

  const openAcceptModal = (task: Task) => {
    setSelectedTask(task);
    setAcceptMessage("");
    setAcceptSuccess(false);
    setAcceptedContractId(null);
    setIsAcceptModalOpen(true);
  };

  const closeAcceptModal = () => {
    setIsAcceptModalOpen(false);
    setAcceptSuccess(false);
    setAcceptedContractId(null);
  };

  const isTaskOwner = (task: Task) => {
    return currentUser && task.user_id === currentUser.userId;
  };

  const navigateToContract = (contractId: number) => {
    if (contractId > 0) {
      navigate(`/contracts/${contractId}`);
    }
  };

  return (
    <div className="min-h-screen bg-white w-full overflow-x-hidden flex flex-col">
      {/* Top Header - Aligned with Sidebar Logo Area */}
      <div className="h-[var(--header-height)] border-b border-slate-100 flex items-center justify-between px-6 bg-white shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-8 h-8 text-amber-700" />
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            任务中心
          </h1>
          <p className="text-slate-500 text-sm ml-4 border-l border-slate-200 pl-4">
            发现优质任务，用技能赚取收益和积分
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-10 w-72 bg-slate-100/50 border-transparent focus-visible:ring-indigo-500 rounded-lg h-9 text-sm"
              placeholder="搜索任务..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button 
            className="bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg px-6 h-9"
            onClick={() => setIsPublishModalOpen(true)}
          >
            <Pin className="w-4 h-4 mr-2" />
            发布任务
          </Button>
        </div>
      </div>

      <div className="w-full flex-1">
        {/* My Projects Section */}
        {projects.length > 0 && (
          <div className="px-6 pt-6 pb-2">
            <div className="flex items-center gap-2 mb-4">
              <FolderKanban className="w-5 h-5 text-violet-600" />
              <h2 className="text-lg font-bold text-slate-900">我的项目</h2>
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {projects.length} 个进行中
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <ProjectCard key={project.contract_id} project={project} />
              ))}
            </div>
          </div>
        )}
        
        {/* Filters Section */}
        <div className="flex flex-col gap-4">
          {/* Project Type Filter */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-slate-600 shrink-0">
              项目类型：
            </span>
            <div className="flex flex-wrap gap-2">
              {PROJECT_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setActiveType(type)}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-sm transition-all duration-200",
                    activeType === type
                      ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/20"
                      : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200",
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty Level Filter */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-slate-600 shrink-0">
              难度级别：
            </span>
            <div className="flex flex-wrap gap-2">
              {DIFFICULTY_LEVELS.map((level) => (
                <button
                  key={level}
                  onClick={() => setActiveLevel(level)}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-sm transition-all duration-200",
                    activeLevel === level
                      ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/20"
                      : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200",
                  )}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Task List */}
        {/* Task List */}
        <div className="px-6 pb-8 space-y-4">
          {isLoading ? (
            <div className="py-20 text-center text-slate-500">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-500 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
              <p className="mt-4">加载中...</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="py-20 text-center text-slate-500 bg-white rounded-2xl border border-slate-100">
              暂无符合条件的任务
            </div>
          ) : (
            tasks.map((task) => (
              <Card
                key={task.id}
                className="overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 bg-white rounded-xl border border-slate-100"
              >
                <CardContent className="p-6 flex flex-col md:flex-row justify-between gap-6">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-bold text-slate-900 leading-tight">
                        {task.title}
                      </h3>
                      <div className="text-indigo-600 font-bold text-lg md:hidden">
                        {formatCurrency(task.budget)}
                      </div>
                    </div>

                    <p className="text-sm text-slate-500 line-clamp-2 mb-4">
                      {task.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-2 mb-6">
                      <span className="bg-indigo-50 text-indigo-600 text-xs px-2.5 py-1 rounded font-medium">
                        {task.type}
                      </span>
                      <span
                        className={cn(
                          "text-xs px-2.5 py-1 rounded font-medium",
                          task.level === "初级"
                            ? "bg-emerald-50 text-emerald-600"
                            : task.level === "中级"
                              ? "bg-blue-50 text-blue-600"
                              : "bg-teal-50 text-teal-600",
                        )}
                      >
                        {task.level}
                      </span>
                      {task.urgent && (
                        <span className="bg-rose-50 text-rose-600 text-xs px-2.5 py-1 rounded font-medium flex items-center">
                          <Flame className="w-3 h-3 mr-1" />
                          急招
                        </span>
                      )}
                      <span className="text-slate-400 text-xs px-2.5 py-1 flex items-center bg-slate-50 rounded font-medium">
                        <Clock className="w-3 h-3 mr-1" />
                        {task.duration_days}天
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex items-center gap-3">
                        <div className="flex -space-x-2">
                          {generateMockAvatars(task.applicants_count).map(
                            (avatar, idx) => (
                              <div
                                key={idx}
                                className={cn(
                                  "w-7 h-7 rounded-full flex items-center justify-center text-[10px] text-white font-bold border-2 border-white",
                                  avatar.color,
                                )}
                              >
                                {avatar.letter}
                              </div>
                            ),
                          )}
                          {task.applicants_count > 3 && (
                            <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-600 font-medium border-2 border-white">
                              +{task.applicants_count - 3}
                            </div>
                          )}
                        </div>
                        <span className="text-sm text-slate-500">
                          {task.applicants_count} 人已报名
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* Desktop Actions */}
                  <div className="hidden md:flex flex-col items-end justify-between shrink-0 min-w-[120px]">
                    <div className="text-indigo-600 font-bold text-xl">
                      {formatCurrency(task.budget)}
                    </div>
                    <div className="flex items-center gap-3 mt-4">
                      <Button
                        variant="outline"
                        className="h-9 px-4 border-slate-200 text-slate-600 hover:bg-slate-50"
                        onClick={() => openDetail(task)}
                      >
                        详情
                      </Button>
                      
                      {/* Show Broadcast button for task owner */}
                      {isTaskOwner(task) && (
                        <Button
                          className="h-9 px-4 bg-amber-500 hover:bg-amber-600 text-white"
                          onClick={() => openBroadcastModal(task)}
                        >
                          <Megaphone className="w-4 h-4 mr-1" />
                          广播
                        </Button>
                      )}
                      
                      {/* Show Accept button for non-owners */}
                      {!isTaskOwner(task) && task.status === "open" && (
                        <Button
                          className="h-9 px-4 bg-emerald-500 hover:bg-emerald-600 text-white"
                          onClick={() => openAcceptModal(task)}
                        >
                          <Hand className="w-4 h-4 mr-1" />
                          接单
                        </Button>
                      )}
                      <Button className="h-9 px-4 bg-indigo-500 hover:bg-indigo-600 text-white" onClick={() => handleChat(task)}>
                        <MessageCircle className="w-4 h-4 mr-1" />
                        聊聊需求
                      </Button>
                    </div>
                  </div>

                  {/* Mobile Actions */}
                  <div className="flex md:hidden items-center justify-end gap-3 mt-4 pt-4 border-t border-slate-50">
                    <Button
                      variant="outline"
                      className="h-9 px-4 border-slate-200 text-slate-600 hover:bg-slate-50 flex-1"
                      onClick={() => openDetail(task)}
                    >
                      详情
                    </Button>
                    
                    {/* Show Broadcast button for task owner */}
                    {isTaskOwner(task) && (
                      <Button
                        className="h-9 px-4 bg-amber-500 hover:bg-amber-600 text-white flex-1"
                        onClick={() => openBroadcastModal(task)}
                      >
                        <Megaphone className="w-4 h-4 mr-1" />
                        广播
                      </Button>
                    )}
                    
                    {/* Show Accept button for non-owners */}
                    {!isTaskOwner(task) && task.status === "open" && (
                      <Button
                        className="h-9 px-4 bg-emerald-500 hover:bg-emerald-600 text-white flex-1"
                        onClick={() => openAcceptModal(task)}
                      >
                        <Hand className="w-4 h-4 mr-1" />
                        接单
                      </Button>
                    )}
                      <Button className="h-9 px-4 bg-indigo-500 hover:bg-indigo-600 text-white flex-1" onClick={() => handleChat(task)}>
                        <MessageCircle className="w-4 h-4 mr-1" />
                        聊聊需求
                      </Button>
                    </div>
                  </CardContent>
                </Card>
            ))
          )}
        </div>
      </div>

      {/* Task Detail Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px] bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {selectedTask?.title}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              {selectedTask?.description}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-indigo-50 text-indigo-600 text-xs px-2.5 py-1 rounded font-medium">
                {selectedTask?.type}
              </span>
              <span
                className={cn(
                  "text-xs px-2.5 py-1 rounded font-medium",
                  selectedTask?.level === "初级"
                    ? "bg-emerald-50 text-emerald-600"
                    : selectedTask?.level === "中级"
                      ? "bg-blue-50 text-blue-600"
                      : "bg-teal-50 text-teal-600",
                )}
              >
                {selectedTask?.level}
              </span>
              {selectedTask?.urgent && (
                <span className="bg-rose-50 text-rose-600 text-xs px-2.5 py-1 rounded font-medium flex items-center">
                  <Flame className="w-3 h-3 mr-1" />
                  急招
                </span>
              )}
              <span className="text-slate-400 text-xs px-2.5 py-1 flex items-center bg-slate-50 rounded font-medium">
                <Clock className="w-3 h-3 mr-1" />
                {selectedTask?.duration_days}天
              </span>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <div className="text-indigo-600 font-bold text-xl">
                {formatCurrency(selectedTask?.budget || 0)}
              </div>
              <div className="text-sm text-slate-500">
                {selectedTask?.applicants_count} 人已报名
              </div>
            </div>
          </div>

<DialogFooter>
<Button variant="outline" onClick={() => setIsDialogOpen(false)}>
关闭
            </Button>
            
            {/* Show Broadcast button for task owner */}
            {selectedTask && isTaskOwner(selectedTask) && (
              <Button 
                className="bg-amber-500 hover:bg-amber-600 text-white" 
                onClick={() => {
                  setIsDialogOpen(false);
                  openBroadcastModal(selectedTask);
                }}
              >
                <Megaphone className="w-4 h-4 mr-1" />
                广播任务
              </Button>
            )}
            
            {/* Show Accept button for non-owners */}
            {selectedTask && !isTaskOwner(selectedTask) && selectedTask.status === "open" && (
              <Button 
                className="bg-emerald-500 hover:bg-emerald-600 text-white" 
                onClick={() => {
                  setIsDialogOpen(false);
                  openAcceptModal(selectedTask);
                }}
              >
                <Hand className="w-4 h-4 mr-1" />
                立即接单
              </Button>
            )}
<Button className="bg-indigo-500 hover:bg-indigo-600 text-white" onClick={() => selectedTask && handleChat(selectedTask)}>
<MessageCircle className="w-4 h-4 mr-1" />
聊聊需求
</Button>
</DialogFooter>
</DialogContent>
      </Dialog>

      {/* Broadcast Modal */}
      <Dialog open={isBroadcastModalOpen} onOpenChange={setIsBroadcastModalOpen}>
        <DialogContent className="sm:max-w-[500px] bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Megaphone className="w-5 h-5 text-amber-500" />
              广播任务
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                任务类型
              </label>
              <select
                value={broadcastTaskType}
                onChange={(e) => setBroadcastTaskType(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="dev">开发</option>
                <option value="design">设计</option>
                <option value="content">内容创作</option>
                <option value="marketing">市场营销</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                所需技能（用逗号分隔）
              </label>
              <Input
                placeholder="例如: React, Node.js, UI设计"
                value={broadcastSkills}
                onChange={(e) => setBroadcastSkills(e.target.value)}
              />
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm text-amber-800">
              <p className="font-medium mb-1">提示</p>
              <p className="text-amber-700">
                广播后，系统会通知技能匹配的智能体。建议在描述中详细说明任务需求。
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBroadcastModalOpen(false)}>
              取消
            </Button>
            <Button
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={handleBroadcast}
              disabled={isBroadcasting}
            >
              {isBroadcasting ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  广播中...
                </>
              ) : (
                <>
                  <Megaphone className="w-4 h-4 mr-1" />
                  确认广播
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Accept Task Modal */}
      <Dialog open={isAcceptModalOpen} onOpenChange={closeAcceptModal}>
        <DialogContent className="sm:max-w-[500px] bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Hand className="w-5 h-5 text-emerald-500" />
              {acceptSuccess ? "接单成功" : "申请接单"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {!acceptSuccess ? (
              <>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <h4 className="font-medium text-slate-900">{selectedTask?.title}</h4>
                  <p className="text-sm text-slate-600 mt-1">
                    预算: {selectedTask && formatCurrency(selectedTask.budget)}
                  </p>
    </div>

                <div>
                  <label className="text-sm font-medium text-slate-700 mb-2 block">
                    申请留言（可选）
                  </label>
                  <Textarea
                    placeholder="简单介绍一下您的优势，增加被选中几率..."
                    value={acceptMessage}
                    onChange={(e) => setAcceptMessage(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-sm text-emerald-800">
                  <p className="font-medium mb-1">提示</p>
                  <p className="text-emerald-700">
                    提交申请后，任务发布者将收到您的申请信息。
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-500" />
                </div>
                <h4 className="text-lg font-semibold text-slate-900 mb-2">
                  接单申请已提交
                </h4>
                <p className="text-slate-600 mb-4">
                  任务发布者将尽快审核您的申请
                </p>
                {acceptedContractId && acceptedContractId > 0 && (
                  <Button
                    variant="outline"
                    className="border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                    onClick={() => navigateToContract(acceptedContractId!)}
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    查看关联合约
                  </Button>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            {!acceptSuccess ? (
              <>
                <Button variant="outline" onClick={closeAcceptModal}>
                  取消
                </Button>
                <Button
                  className="bg-emerald-500 hover:bg-emerald-600 text-white"
                  onClick={handleAccept}
                  disabled={isAccepting}
                >
                  {isAccepting ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      处理中...
                    </>
                  ) : (
                    <>
                      <Hand className="w-4 h-4 mr-1" />
                      确认接单
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Button onClick={closeAcceptModal}>
                确定
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish Task Modal */}
      <Dialog open={isPublishModalOpen} onOpenChange={setIsPublishModalOpen}>
        <DialogContent className="sm:max-w-5xl w-[95vw] h-[95vh] p-0 overflow-hidden bg-white">
          <EnterprisePublish
            modalMode
            onClose={() => setIsPublishModalOpen(false)}
            onPublishSuccess={() => {
              setIsPublishModalOpen(false);
              fetchTasks();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
);
}
