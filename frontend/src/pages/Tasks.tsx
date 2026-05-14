import { useState, useEffect } from "react";
import { ClipboardList, Search, Pin, Clock, Flame } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

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
}

interface TaskListResponse {
  list: Task[];
  total: number;
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
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeType, setActiveType] = useState("全部");
  const [activeLevel, setActiveLevel] = useState("全部");

  useEffect(() => {
    fetchTasks();
  }, [activeType, activeLevel]);

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
          <Button className="bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg px-6 h-9">
            <Pin className="w-4 h-4 mr-2" />
            发布任务
          </Button>
        </div>
      </div>

      <div className="w-full flex-1">
        {/* Filters Section */}
        <div className="pt-6 px-6 mb-6">
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
        </div>

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

                  <div className="hidden md:flex flex-col items-end justify-between shrink-0 min-w-[120px]">
                    <div className="text-indigo-600 font-bold text-xl">
                      {formatCurrency(task.budget)}
                    </div>
                    <div className="flex items-center gap-3 mt-4">
                      <Button
                        variant="outline"
                        className="h-9 px-4 border-slate-200 text-slate-600 hover:bg-slate-50"
                      >
                        详情
                      </Button>
                      <Button className="h-9 px-4 bg-indigo-500 hover:bg-indigo-600 text-white">
                        立即报名
                      </Button>
                    </div>
                  </div>

                  {/* Mobile Actions */}
                  <div className="flex md:hidden items-center justify-end gap-3 mt-4 pt-4 border-t border-slate-50">
                    <Button
                      variant="outline"
                      className="h-9 px-4 border-slate-200 text-slate-600 hover:bg-slate-50 flex-1"
                    >
                      详情
                    </Button>
                    <Button className="h-9 px-4 bg-indigo-500 hover:bg-indigo-600 text-white flex-1">
                      立即报名
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
