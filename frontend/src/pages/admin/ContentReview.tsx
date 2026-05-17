import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  FileText,
  Calendar,
  CheckCircle,
  XCircle,
  RefreshCw,
  AlertCircle,
  User,
  Clock,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

interface PendingPost {
  id: number;
  title: string;
  content: string;
  authorName: string;
  authorId: number;
  category: string;
  tags: string;
  createdAt: string;
}

interface PendingEvent {
  id: number;
  title: string;
  description: string;
  authorName: string;
  authorId: number;
  location: string;
  startTime: string;
  endTime: string;
  createdAt: string;
}

interface ReviewListResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

type TabType = "posts" | "events";

export default function ContentReview() {
  const [activeTab, setActiveTab] = useState<TabType>("posts");
  const [posts, setPosts] = useState<PendingPost[]>([]);
  const [events, setEvents] = useState<PendingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [actionLoading, setActionLoading] = useState<{ id: number; action: string } | null>(null);

  useEffect(() => {
    fetchPendingItems();
  }, [activeTab, page]);

  const fetchPendingItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = activeTab === "posts" ? "/admin/posts/review/list" : "/admin/events/review/list";
      const result = await apiFetch<ReviewListResponse<PendingPost | PendingEvent>>(endpoint, {
        method: "POST",
        body: JSON.stringify({
          page,
          pageSize,
        }),
      });

      if (activeTab === "posts") {
        setPosts(result.list as PendingPost[]);
      } else {
        setEvents(result.list as PendingEvent[]);
      }
      setTotal(result.total || 0);
    } catch (err) {
      console.error("Failed to fetch pending items:", err);
      setError("加载数据失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (id: number, action: "approve" | "reject") => {
    setActionLoading({ id, action });
    try {
      const endpoint = activeTab === "posts" ? "/admin/posts/review" : "/admin/events/review";
      await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({
          id,
          action,
        }),
      });
      // Remove the item from the list
      if (activeTab === "posts") {
        setPosts((prev) => prev.filter((p) => p.id !== id));
      } else {
        setEvents((prev) => prev.filter((e) => e.id !== id));
      }
      setTotal((prev) => prev - 1);
    } catch (err) {
      console.error("Failed to review item:", err);
      alert("操作失败，请稍后重试");
    } finally {
      setActionLoading(null);
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

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const parseTags = (tagsStr: string) => {
    if (!tagsStr) return [];
    try {
      const parsed = JSON.parse(tagsStr);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return tagsStr.split(",").map((t) => t.trim()).filter(Boolean);
    }
    return [];
  };

  const totalPages = Math.ceil(total / pageSize);
  const currentItems = activeTab === "posts" ? posts : events;

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">内容审核</h2>
          <p className="text-slate-500 mt-1">审核用户发布的帖子和活动</p>
        </div>
        <Button variant="outline" onClick={fetchPendingItems} disabled={loading}>
          <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
          刷新
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-1">
          <button
            onClick={() => {
              setActiveTab("posts");
              setPage(1);
            }}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === "posts"
                ? "border-indigo-500 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            <FileText className="w-4 h-4" />
            帖子审核
            {posts.length > 0 && activeTab === "posts" && (
              <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 ml-1">
                {total}
              </Badge>
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab("events");
              setPage(1);
            }}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              activeTab === "events"
                ? "border-rose-500 text-rose-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            <Calendar className="w-4 h-4" />
            活动审核
            {events.length > 0 && activeTab === "events" && (
              <Badge variant="secondary" className="bg-rose-100 text-rose-700 ml-1">
                {total}
              </Badge>
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">
            待审核{activeTab === "posts" ? "帖子" : "活动"}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-500 border-r-transparent" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-500 mb-4">{error}</p>
              <Button onClick={fetchPendingItems}>重试</Button>
            </div>
          ) : currentItems.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg">
              <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">
                暂无待审核{activeTab === "posts" ? "帖子" : "活动"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {currentItems.map((item) => (
                <div
                  key={item.id}
                  className="border border-slate-200 rounded-lg p-4 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Title */}
                      <h3 className="text-lg font-semibold text-slate-900 mb-2">{item.title}</h3>

                      {/* Author Info */}
                      <div className="flex items-center gap-4 text-sm text-slate-500 mb-3">
                        <div className="flex items-center gap-1">
                          <User className="w-4 h-4" />
                          <span>{item.authorName}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>{getTimeAgo(item.createdAt)}</span>
                        </div>
                      </div>

                      {/* Post-specific content */}
                      {activeTab === "posts" && "content" in item && (
                        <>
                          <p className="text-slate-600 text-sm mb-3 line-clamp-2">
                            {(item as PendingPost).content}
                          </p>
                          <div className="flex flex-wrap gap-2 mb-3">
                            <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                              {(item as PendingPost).category}
                            </Badge>
                            {parseTags((item as PendingPost).tags).map((tag, idx) => (
                              <Badge
                                key={idx}
                                variant="outline"
                                className="text-slate-600"
                              >
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </>
                      )}

                      {/* Event-specific content */}
                      {activeTab === "events" && "location" in item && (
                        <div className="space-y-2 mb-3">
                          <p className="text-slate-600 text-sm line-clamp-2">
                            {(item as PendingEvent).description}
                          </p>
                          <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {formatDateTime((item as PendingEvent).startTime)}
                            </span>
                            <span className="flex items-center gap-1">
                              <ExternalLink className="w-4 h-4" />
                              {(item as PendingEvent).location}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                        onClick={() => handleReview(item.id, "approve")}
                        disabled={
                          actionLoading?.id === item.id && actionLoading?.action === "approve"
                        }
                      >
                        {actionLoading?.id === item.id && actionLoading?.action === "approve" ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4 mr-1" />
                            通过
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                        onClick={() => handleReview(item.id, "reject")}
                        disabled={
                          actionLoading?.id === item.id && actionLoading?.action === "reject"
                        }
                      >
                        {actionLoading?.id === item.id && actionLoading?.action === "reject" ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <XCircle className="w-4 h-4 mr-1" />
                            拒绝
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-slate-200">
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
