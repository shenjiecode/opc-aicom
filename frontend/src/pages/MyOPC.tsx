import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Coins,
  Ticket,
  Cpu,
  FileText,
  Calendar,
  ListTodo,
  Eye,
  Heart,
  MessageCircle,
  MapPin,
  Clock,
  ArrowRight,
  Package,
  CheckCircle,
  Clock3,
  XCircle,
} from "lucide-react";

// Types
interface UserAssets {
  points: number;
  coupons: number;
  computeHours: number;
}

interface Task {
  id: number;
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  reward: number;
  deadline?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface Post {
  id: number;
  title: string;
  excerpt?: string;
  content?: string;
  views: number;
  likes: number;
  comments_count?: number;
  comments?: number;
  created_at?: string;
  createdAt?: string;
  author_name?: string;
  tags?: string;
  badge?: string;
}

interface Event {
  id: number;
  title: string;
  description?: string;
  cover_image?: string;
  start_time: string;
  end_time?: string;
  location: string;
  category?: string;
  tags?: string;
  status: string;
  joined_count?: number;
  limit_count?: number;
  is_featured?: boolean;
  theme_color?: string;
}

interface UserInfo {
  userId: string;
  username: string;
  assets: UserAssets;
  myTasks: Task[];
  appliedTasks: Task[];
}

type TabType = "posts" | "events" | "tasks";

// Helper functions
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

const parseTags = (tagsStr: string | undefined) => {
  if (!tagsStr) return [];
  try {
    const parsed = JSON.parse(tagsStr);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    return tagsStr
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
};

const getStatusBadge = (status: Task["status"]) => {
  const config: Record<
    Task["status"],
    {
      className: string;
      label: string;
      icon: typeof CheckCircle;
    }
  > = {
    pending: {
      className: "bg-amber-100 text-amber-700 border-amber-200",
      label: "待处理",
      icon: Clock3,
    },
    in_progress: {
      className: "bg-blue-100 text-blue-700 border-blue-200",
      label: "进行中",
      icon: Clock,
    },
    completed: {
      className: "bg-emerald-100 text-emerald-700 border-emerald-200",
      label: "已完成",
      icon: CheckCircle,
    },
    cancelled: {
      className: "bg-slate-100 text-slate-600 border-slate-200",
      label: "已取消",
      icon: XCircle,
    },
  };

  const { className, label, icon: Icon } = config[status];
  return (
    <Badge variant="outline" className={cn("flex items-center gap-1", className)}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
};

const getEventStatusBadge = (status: string) => {
  if (status === "报名中" || status === "ongoing") {
    return (
      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">
        报名中
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none">
      已结束
    </Badge>
  );
};

export default function MyOPC() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>("posts");
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [userEvents, setUserEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Load user info (includes tasks)
        const infoResult = await apiFetch<UserInfo>("/user/info", {
          method: "POST",
          body: JSON.stringify({}),
        });
        setUserInfo(infoResult);

        // Load user's posts
        const postsResult = await apiFetch<{ list: Post[] }>("/user/posts?page=1&pageSize=10", {
          method: "GET",
        });
        setUserPosts(postsResult.list || []);

        // Load user's events
        const eventsResult = await apiFetch<{ list: Event[] }>("/user/events?page=1&pageSize=10", {
          method: "GET",
        });
        setUserEvents(eventsResult.list || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载数据失败");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const assetCards = [
    {
      title: "积分",
      value: userInfo?.assets.points ?? 0,
      icon: Coins,
      description: "完成任务获得积分",
      color: "text-amber-600",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
    },
    {
      title: "优惠券",
      value: userInfo?.assets.coupons ?? 0,
      icon: Ticket,
      description: "可用折扣券",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      borderColor: "border-purple-200",
    },
    {
      title: "算力时长",
      value: userInfo?.assets.computeHours ?? 0,
      icon: Cpu,
      description: "剩余算力资源（小时）",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
    },
  ];

  const tabs = [
    { id: "posts" as TabType, label: "我的帖子", icon: FileText },
    { id: "events" as TabType, label: "我的活动", icon: Calendar },
    { id: "tasks" as TabType, label: "我的任务", icon: ListTodo },
  ];

  const handlePostClick = (postId: number) => {
    navigate(`/post/${postId}`);
  };

  const handleEventClick = (eventId: number) => {
    navigate(`/event/${eventId}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white w-full flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-500 border-r-transparent" />
          <p className="mt-4 text-slate-500">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white w-full overflow-x-hidden flex flex-col">
      {/* Header */}
      <div className="h-[var(--header-height)] border-b border-slate-100 flex items-center justify-between px-6 bg-white shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Package className="w-8 h-8 text-indigo-500" />
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">我的OPC</h1>
          <p className="text-slate-500 text-sm ml-4 border-l border-slate-200 pl-4">
            管理您的帖子、活动和任务
          </p>
        </div>
      </div>

      <div className="w-full flex-1 px-6 pb-8">
        {/* Error Message */}
        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {error}
          </div>
        )}

        {/* Assets Section */}
        <section className="mt-8 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {assetCards.map((asset) => {
              const Icon = asset.icon;
              return (
                <Card
                  key={asset.title}
                  className="border border-slate-100 shadow-sm hover:shadow-md transition-shadow bg-white"
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-slate-600">
                      {asset.title}
                    </CardTitle>
                    <div className={cn("p-2 rounded-lg", asset.bgColor)}>
                      <Icon className={cn("h-4 w-4", asset.color)} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className={cn("text-3xl font-bold", asset.color)}>
                      {asset.value.toLocaleString()}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{asset.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Main Tabs */}
        <div className="flex items-center gap-3 mb-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-200",
                  activeTab === tab.id
                    ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/20"
                    : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
                )}
              >
                <Icon className="w-4 h-4 mr-2" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="w-full">
          {/* 我的帖子 Tab */}
          {activeTab === "posts" && (
            <div>
              {userPosts.length === 0 ? (
                <div className="py-20 text-center bg-white rounded-2xl border border-slate-100">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">您还没有发布帖子</p>
                </div>
              ) : (
                <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
                  {userPosts.map((post) => (
                    <div key={post.id} className="break-inside-avoid">
                      <Card
                        className="overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 bg-white rounded-2xl group cursor-pointer border border-slate-100"
                        onClick={() => handlePostClick(post.id)}
                      >
                        {/* Image Placeholder */}
                        <div className="h-48 bg-slate-100 relative group-hover:bg-slate-200 transition-colors">
                          {post.badge && (
                            <div className="absolute bottom-3 right-3 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-md shadow-sm">
                              {post.badge}
                            </div>
                          )}
                        </div>

                        <CardContent className="p-5">
                          <div className="flex gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-400 flex items-center justify-center text-white font-bold shrink-0 overflow-hidden">
                              {userInfo?.username?.charAt(0)?.toUpperCase() || "U"}
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-900 leading-tight line-clamp-2 mb-1 group-hover:text-indigo-600 transition-colors">
                                {post.title}
                              </h3>
                              <p className="text-xs text-slate-500">
                                by {userInfo?.username || "Anonymous"}
                              </p>
                            </div>
                          </div>

                          <p className="text-sm text-slate-600 line-clamp-2 mb-4">
                            {post.excerpt || post.content}
                          </p>

                          {post.tags && (
                            <div className="flex flex-wrap gap-2 mb-6">
                              {parseTags(post.tags).map((tag, idx) => (
                                <span
                                  key={idx}
                                  className="bg-slate-100 text-slate-600 text-xs px-2.5 py-1 rounded-md font-medium"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="flex items-center justify-between text-xs text-slate-400 pt-4 border-t border-slate-50">
                            <span>
                              {getTimeAgo(post.created_at || post.createdAt || new Date().toISOString())}
                            </span>
                            <div className="flex items-center gap-4">
                              <span className="flex items-center gap-1">
                                <Eye className="w-3 h-3" />
                                {post.views || 0}
                              </span>
                              <span className="flex items-center gap-1">
                                <Heart className="w-3 h-3" />
                                {post.likes || 0}
                              </span>
                              <span className="flex items-center gap-1">
                                <MessageCircle className="w-3 h-3" />
                                {post.comments_count || post.comments || 0}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 我的活动 Tab */}
          {activeTab === "events" && (
            <div>
              {userEvents.length === 0 ? (
                <div className="py-20 text-center bg-white rounded-2xl border border-slate-100">
                  <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">您还没有报名活动</p>
                </div>
              ) : (
                <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
                  {userEvents.map((event) => (
                    <div key={event.id} className="break-inside-avoid">
                      <Card
                        className="overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 bg-white rounded-2xl group cursor-pointer flex flex-col h-full border border-slate-100"
                        onClick={() => handleEventClick(event.id)}
                      >
                        {/* Gradient Header */}
                        <div
                          className={cn(
                            "h-40 relative flex items-end p-5 bg-gradient-to-br",
                            event.theme_color || "from-indigo-400 to-purple-400"
                          )}
                        >
                          {getEventStatusBadge(event.status)}
                          {event.tags && (
                            <div className="absolute bottom-4 right-4 flex flex-wrap gap-2">
                              {parseTags(event.tags).map((tag, idx) => (
                                <span
                                  key={idx}
                                  className="bg-black/20 text-white backdrop-blur-md text-xs px-2.5 py-1 rounded-md font-medium"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <CardContent className="p-5 flex-1 flex flex-col">
                          <h3 className="text-lg font-bold text-slate-900 leading-tight mb-4 group-hover:text-indigo-600 transition-colors">
                            {event.title}
                          </h3>

                          <div className="space-y-3 mb-6 mt-auto">
                            <div className="flex items-center text-slate-500 text-sm">
                              <Clock className="w-4 h-4 mr-2 text-slate-400" />
                              {new Date(event.start_time).toLocaleDateString().replace(/\//g, ".")}
                              {event.end_time &&
                                ` - ${new Date(event.end_time).toLocaleDateString().replace(/\//g, ".")}`}
                            </div>
                            <div className="flex items-center text-slate-500 text-sm">
                              <MapPin className="w-4 h-4 mr-2 text-slate-400" />
                              {event.location}
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-xs text-slate-500 pt-4 border-t border-slate-100">
                            <div className="flex items-center">
                              已报名{" "}
                              <span className="font-semibold text-slate-700 ml-1">
                                {event.joined_count || 0} 人
                              </span>
                            </div>
                            {event.limit_count && event.limit_count > 0 && (
                              <div className="flex items-center">
                                限额{" "}
                                <span className="font-semibold text-slate-700 ml-1">
                                  {event.limit_count} 人
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="mt-4 pt-4 flex items-center justify-between">
                            <span className="text-sm font-medium text-indigo-600 group-hover:text-indigo-700 transition-colors flex items-center">
                              查看详情 <ArrowRight className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform" />
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 我的任务 Tab */}
          {activeTab === "tasks" && (
            <div className="space-y-8">
              {/* 我发布的任务 */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-lg font-semibold text-slate-900">我发布的任务</h2>
                  <Badge variant="outline" className="bg-slate-50">
                    {userInfo?.myTasks?.length || 0}
                  </Badge>
                </div>

                {userInfo?.myTasks?.length === 0 ? (
                  <div className="py-12 text-center bg-white rounded-2xl border border-slate-100">
                    <ListTodo className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">暂无发布的任务</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {userInfo?.myTasks?.map((task) => (
                      <Card
                        key={task.id}
                        className="border border-slate-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer bg-white"
                      >
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h3 className="font-semibold text-slate-900 mb-2">{task.title}</h3>
                              {task.description && (
                                <p className="text-sm text-slate-600 line-clamp-2 mb-3">
                                  {task.description}
                                </p>
                              )}
                              <div className="flex items-center gap-4 text-sm text-slate-500">
                                {task.deadline && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5" />
                                    截止 {new Date(task.deadline).toLocaleDateString()}
                                  </span>
                                )}
                                <span className="flex items-center gap-1 text-amber-600">
                                  <Coins className="w-3.5 h-3.5" />
                                  奖励 {task.reward} 积分
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              {getStatusBadge(task.status)}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </section>

              {/* 我接单的任务 */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-lg font-semibold text-slate-900">我接单的任务</h2>
                  <Badge variant="outline" className="bg-slate-50">
                    {userInfo?.appliedTasks?.length || 0}
                  </Badge>
                </div>

                {userInfo?.appliedTasks?.length === 0 ? (
                  <div className="py-12 text-center bg-white rounded-2xl border border-slate-100">
                    <ListTodo className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">暂无接单的任务</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {userInfo?.appliedTasks?.map((task) => (
                      <Card
                        key={task.id}
                        className="border border-slate-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer bg-white"
                      >
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <h3 className="font-semibold text-slate-900 mb-2">{task.title}</h3>
                              {task.description && (
                                <p className="text-sm text-slate-600 line-clamp-2 mb-3">
                                  {task.description}
                                </p>
                              )}
                              <div className="flex items-center gap-4 text-sm text-slate-500">
                                {task.deadline && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5" />
                                    截止 {new Date(task.deadline).toLocaleDateString()}
                                  </span>
                                )}
                                <span className="flex items-center gap-1 text-amber-600">
                                  <Coins className="w-3.5 h-3.5" />
                                  奖励 {task.reward} 积分
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              {getStatusBadge(task.status)}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
