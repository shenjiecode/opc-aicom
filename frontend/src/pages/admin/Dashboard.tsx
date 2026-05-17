import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Users,
  FileText,
  Calendar,
  ClipboardList,
  ShoppingCart,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  Clock,
} from "lucide-react";

interface DashboardStats {
  totalUsers: number;
  totalPosts: number;
  totalEvents: number;
  totalTasks: number;
  totalOrders: number;
  pendingReviews: number;
}

interface PendingPost {
  id: number;
  title: string;
  authorName: string;
  createdAt: string;
  type: "post";
}

interface PendingEvent {
  id: number;
  title: string;
  authorName: string;
  createdAt: string;
  type: "event";
}

interface DashboardData {
  stats: DashboardStats;
  pendingPosts: PendingPost[];
  pendingEvents: PendingEvent[];
}

const statCards = [
  { key: "totalUsers", label: "总用户数", icon: Users, color: "blue" },
  { key: "totalPosts", label: "帖子总数", icon: FileText, color: "indigo" },
  { key: "totalEvents", label: "活动总数", icon: Calendar, color: "rose" },
  { key: "totalTasks", label: "任务总数", icon: ClipboardList, color: "amber" },
  { key: "totalOrders", label: "订单总数", icon: ShoppingCart, color: "emerald" },
  { key: "pendingReviews", label: "待审核", icon: AlertCircle, color: "orange" },
];

const colorClasses: Record<string, { bg: string; icon: string; text: string }> = {
  blue: { bg: "bg-blue-50", icon: "text-blue-600", text: "text-blue-700" },
  indigo: { bg: "bg-indigo-50", icon: "text-indigo-600", text: "text-indigo-700" },
  rose: { bg: "bg-rose-50", icon: "text-rose-600", text: "text-rose-700" },
  amber: { bg: "bg-amber-50", icon: "text-amber-600", text: "text-amber-700" },
  emerald: { bg: "bg-emerald-50", icon: "text-emerald-600", text: "text-emerald-700" },
  orange: { bg: "bg-orange-50", icon: "text-orange-600", text: "text-orange-700" },
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<DashboardData>("/admin/dashboard", {
        method: "POST",
      });
      setData(result);
    } catch (err) {
      console.error("Failed to fetch dashboard:", err);
      setError("加载数据失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return "刚刚";
    if (diffInHours < 24) return `${diffInHours}小时前`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return "昨天";
    if (diffInDays < 30) return `${diffInDays}天前`;
    return date.toLocaleDateString();
  };

  const allPendingItems = [
    ...(data?.pendingPosts || []).map((post) => ({ ...post, type: "post" as const })),
    ...(data?.pendingEvents || []).map((event) => ({ ...event, type: "event" as const })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-500 border-r-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-red-500">{error}</p>
        <Button onClick={fetchDashboard}>重试</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">控制台</h2>
          <p className="text-slate-500 mt-1">平台数据概览与待处理事项</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <TrendingUp className="w-4 h-4" />
          <span>数据实时更新</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          const colors = colorClasses[stat.color];
          const value = data?.stats[stat.key as keyof DashboardStats] || 0;

          return (
            <Card key={stat.key} className="border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className={cn("p-2 rounded-lg", colors.bg)}>
                    <Icon className={cn("w-5 h-5", colors.icon)} />
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold text-slate-900">{value.toLocaleString()}</p>
                  <p className="text-sm text-slate-500 mt-0.5">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Pending Reviews Section */}
      <Card className="border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-lg font-semibold text-slate-900">待审核内容</CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              共有 {allPendingItems.length} 条待审核内容
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => navigate("/admin/review")}
          >
            查看全部
            <ArrowRight className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          {allPendingItems.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg">
              <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">暂无待审核内容</p>
            </div>
          ) : (
            <div className="space-y-3">
              {allPendingItems.slice(0, 5).map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={item.type === "post" ? "secondary" : "default"}
                      className={cn(
                        "text-xs",
                        item.type === "post" && "bg-indigo-100 text-indigo-700 hover:bg-indigo-100",
                        item.type === "event" && "bg-rose-100 text-rose-700 hover:bg-rose-100"
                      )}
                    >
                      {item.type === "post" ? "帖子" : "活动"}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium text-slate-900 line-clamp-1">
                        {item.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        作者：{item.authorName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <Clock className="w-3 h-3" />
                      <span>{getTimeAgo(item.createdAt)}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-3 text-xs"
                      onClick={() => navigate("/admin/review")}
                    >
                      审核
                    </Button>
                  </div>
                </div>
              ))}

              {allPendingItems.length > 5 && (
                <Button
                  variant="ghost"
                  className="w-full text-slate-500 hover:text-slate-900"
                  onClick={() => navigate("/admin/review")}
                >
                  还有 {allPendingItems.length - 5} 条待审核内容
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900">快速操作</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2"
                onClick={() => navigate("/admin/users")}
              >
                <Users className="w-5 h-5 text-indigo-600" />
                <span className="text-sm">用户管理</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2"
                onClick={() => navigate("/admin/review")}
              >
                <FileText className="w-5 h-5 text-rose-600" />
                <span className="text-sm">内容审核</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900">系统状态</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">API 服务</span>
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                  正常运行
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">数据库</span>
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
                  连接正常
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">后台版本</span>
                <span className="text-sm text-slate-900">v1.0.0</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
