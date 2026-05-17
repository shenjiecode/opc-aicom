import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  XCircle,
  ClipboardList,
  RefreshCw,
  DollarSign,
  Users,
} from "lucide-react";

interface Task {
  id: number;
  title: string;
  type: string;
  budget: number;
  status: "open" | "in_progress" | "closed";
  applicants: number;
  createdAt: string;
}

interface TaskListResponse {
  list: Task[];
  total: number;
  page: number;
  pageSize: number;
}

interface FilterState {
  search: string;
  type: string;
  status: string;
}

const TASK_TYPES = [
  { value: "", label: "全部类型" },
  { value: "dev", label: "开发" },
  { value: "design", label: "设计" },
  { value: "短剧", label: "短剧" },
  { value: "writing", label: "写作" },
  { value: "other", label: "其他" },
];

const STATUSES = [
  { value: "", label: "全部状态" },
  { value: "open", label: "开放" },
  { value: "in_progress", label: "进行中" },
  { value: "closed", label: "已关闭" },
];

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  open: { bg: "bg-emerald-100", text: "text-emerald-700", label: "开放" },
  in_progress: { bg: "bg-blue-100", text: "text-blue-700", label: "进行中" },
  closed: { bg: "bg-slate-100", text: "text-slate-700", label: "已关闭" },
};

export default function TaskManagement() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    type: "",
    status: "",
  });
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    fetchTasks();
  }, [page, filters.type, filters.status]);

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<TaskListResponse>("/admin/tasks/list", {
        method: "POST",
        body: JSON.stringify({
          page,
          pageSize,
          search: filters.search,
          type: filters.type,
          status: filters.status,
        }),
      });
      setTasks(result.list || []);
      setTotal(result.total || 0);
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
      setError("加载任务数据失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchTasks();
  };

  const handleCloseTask = async (taskId: number) => {
    if (!confirm("确定要关闭此任务吗？关闭后任务将不再接受申请。")) {
      return;
    }
    setActionLoading(taskId);
    try {
      await apiFetch(`/admin/tasks/${taskId}/close`, {
        method: "POST",
      });
      // Refresh the list
      fetchTasks();
    } catch (err) {
      console.error("Failed to close task:", err);
      alert("操作失败，请稍后重试");
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const formatBudget = (amount: number) => {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: "CNY",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">任务管理</h2>
          <p className="text-slate-500 mt-1">管理平台任务，查看和关闭任务</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <ClipboardList className="w-4 h-4" />
          <span>共 {total} 个任务</span>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="搜索任务标题..."
                className="pl-10"
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                className="h-9 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-slate-950"
                value={filters.type}
                onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))}
              >
                {TASK_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <select
                className="h-9 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-slate-950"
                value={filters.status}
                onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
              >
                {STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Button */}
            <Button onClick={handleSearch}>
              <Search className="w-4 h-4 mr-2" />
              搜索
            </Button>

            {/* Refresh Button */}
            <Button variant="outline" onClick={fetchTasks} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tasks Table */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">任务列表</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-500 border-r-transparent" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-500 mb-4">{error}</p>
              <Button onClick={fetchTasks}>重试</Button>
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg">
              <ClipboardList className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">暂无任务数据</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">ID</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">标题</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">类型</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">预算</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">状态</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">申请者</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">创建时间</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 text-sm text-slate-600">#{task.id}</td>
                      <td className="py-3 px-4">
                        <span className="text-sm font-medium text-slate-900">{task.title}</span>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                          {task.type}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 text-sm text-slate-700">
                          <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                          {formatBudget(task.budget)}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="secondary"
                          className={cn(
                            STATUS_BADGE[task.status]?.bg || "bg-slate-100",
                            STATUS_BADGE[task.status]?.text || "text-slate-700"
                          )}
                        >
                          {STATUS_BADGE[task.status]?.label || task.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 text-sm text-slate-600">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          {task.applicants}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {formatDate(task.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {task.status !== "closed" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                            onClick={() => handleCloseTask(task.id)}
                            disabled={actionLoading === task.id}
                          >
                            {actionLoading === task.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <>
                                <XCircle className="w-3.5 h-3.5 mr-1" />
                                关闭
                              </>
                            )}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && !error && tasks.length > 0 && totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200">
              <p className="text-sm text-slate-500">
                显示第 {(page - 1) * pageSize + 1} 到 {Math.min(page * pageSize, total)} 条，共 {total} 条
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-slate-600 px-2">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
