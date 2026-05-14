import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  PenLine,
  Globe,
  MessageCircle,
  Ticket,
  MapPin,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

interface Post {
  id: number;
  title: string;
  excerpt: string;
  content: string;
  tags: string; // JSON string of tags or comma separated
  badge: string;
  category: string;
  views: number;
  comments_count: number;
  created_at: string;
  author_name: string;
  author_avatar: string | null;
}

interface PostListResponse {
  list: Post[];
  total: number;
  page: number;
  pageSize: number;
}

interface Event {
  id: number;
  title: string;
  description: string;
  cover_image: string;
  start_time: string;
  end_time: string;
  location: string;
  category: string;
  tags: string;
  badge: string;
  status: string;
  joined_count: number;
  limit_count: number;
  is_featured: boolean;
  theme_color: string;
  created_at: string;
}

interface EventListResponse {
  list: Event[];
  total: number;
  page: number;
  pageSize: number;
}

const FORUM_CATEGORIES = [
  "全部",
  "AI工具",
  "创业分享",
  "效率提升",
  "工作流",
  "资源推荐",
  "求助",
  "项目招募",
  "技术干货",
];

const EVENT_CATEGORIES = [
  "全部活动",
  "线下峰会",
  "线上直播",
  "沙龙聚会",
  "路演比赛",
];

export default function Community() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"forum" | "events">("events"); // Defaulting to events for now
  const [activeForumCategory, setActiveForumCategory] = useState("全部");
  const [activeEventCategory, setActiveEventCategory] = useState("全部活动");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchPosts = async (category: string) => {
    setIsLoading(true);
    try {
      const result = await apiFetch<PostListResponse>("/community/list", {
        method: "POST",
        body: JSON.stringify({
          page: 1,
          pageSize: 20,
          category: category === "全部" ? "" : category,
        }),
      });
      setPosts(result.list || []);
    } catch (err) {
      console.error("Failed to load posts", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEvents = async (category: string) => {
    setIsLoading(true);
    try {
      const result = await apiFetch<EventListResponse>("/community/events", {
        method: "POST",
        body: JSON.stringify({
          page: 1,
          pageSize: 20,
          category: category === "全部活动" ? "" : category,
        }),
      });
      setEvents(result.list || []);
    } catch (err) {
      console.error("Failed to load events", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "forum") {
      fetchPosts(activeForumCategory);
    } else {
      fetchEvents(activeEventCategory);
    }
  }, [activeTab, activeForumCategory, activeEventCategory]);

  const handleCreatePost = () => {
    // Assuming there's a route for creating a post, or you can keep the modal
    // For now, let's keep it simple or open a modal
    console.log("Navigate to create post or open modal");
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60),
    );

    if (diffInHours < 1) return "刚刚";
    if (diffInHours < 24) return `${diffInHours}小时前`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return "昨天";
    if (diffInDays < 30) return `${diffInDays}天前`;
    return date.toLocaleDateString();
  };

  const parseTags = (tagsStr: string) => {
    if (!tagsStr) return [];
    try {
      // Try to parse as JSON if it was stored as JSON array
      const parsed = JSON.parse(tagsStr);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Fallback to comma separated
      return tagsStr
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }
    return [];
  };

  return (
    <div className="min-h-screen bg-white w-full overflow-x-hidden flex flex-col">
      {/* Top Header - Aligned with Sidebar Logo Area */}
      <div className="h-[var(--header-height)] border-b border-slate-100 flex items-center justify-between px-6 bg-white shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Globe className="w-8 h-8 text-blue-500" />
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            社区
          </h1>
          <p className="text-slate-500 text-sm ml-4 border-l border-slate-200 pl-4">
            与超级个体们一起交流、分享、协作
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-10 w-72 bg-slate-100/50 border-transparent focus-visible:ring-indigo-500 rounded-lg h-9 text-sm"
              placeholder={
                activeTab === "forum"
                  ? "搜索社区内容..."
                  : "搜索活动名称或城市..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          {activeTab === "forum" ? (
            <Button
              className="bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg px-6 h-9"
              onClick={handleCreatePost}
            >
              <PenLine className="w-4 h-4 mr-2" />
              发布帖子
            </Button>
          ) : (
            <Button
              variant="outline"
              className="rounded-lg bg-white border-slate-200 h-9 text-slate-500"
            >
              <Ticket className="w-4 h-4 mr-2 text-rose-500" />
              导出日历
            </Button>
          )}
        </div>
      </div>

      <div className="w-full flex-1">
        {/* Main Tabs */}
        <div className="pt-6 px-6 mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab("forum")}
              className={cn(
                "flex items-center px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-200",
                activeTab === "forum"
                  ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/20"
                  : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200",
              )}
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              论坛
            </button>
            <button
              onClick={() => setActiveTab("events")}
              className={cn(
                "flex items-center px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-200",
                activeTab === "events"
                  ? "bg-rose-500 text-white shadow-md shadow-rose-500/20"
                  : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200",
              )}
            >
              <Ticket className="w-4 h-4 mr-2" />
              活动
            </button>
          </div>
        </div>

        {/* Hero Banner for Events */}
        {activeTab === "events" && (
          <div className="w-full bg-[#2A2B3D] overflow-hidden mb-8 relative px-12 py-8 flex items-center justify-between min-h-[220px]">
            {/* Background glowing effects */}
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-600/20 blur-[100px] rounded-full translate-x-1/3 -translate-y-1/3 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-purple-600/20 blur-[80px] rounded-full -translate-x-1/4 translate-y-1/4 pointer-events-none" />

            <div className="relative z-10 w-full flex flex-col justify-center">
              <div className="max-w-2xl">
                <div className="inline-block bg-white/10 text-slate-200 text-xs font-medium px-3 py-1 rounded-full mb-4 backdrop-blur-sm">
                  年度重磅
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
                  2026 AI Native 创新者大会
                </h2>
                <p className="text-slate-300 text-sm md:text-base leading-relaxed line-clamp-2 mb-4">
                  汇聚全球顶尖 AI
                  创业者、技术极客与早期投资人。洞见趋势，链接资源，共建 AI
                  原生时代的新商业生态。
                </p>
                <div className="flex items-center mt-6">
                  <Button className="bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg px-8 py-5 text-base font-medium transition-all hover:scale-105 hover:shadow-lg hover:shadow-indigo-500/25">
                    立即抢票
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Categories Section */}
        <div className="flex flex-wrap gap-2 mb-8 px-6">
          {activeTab === "forum" ? (
            FORUM_CATEGORIES.map((category) => (
              <button
                key={category}
                onClick={() => setActiveForumCategory(category)}
                className={cn(
                  "px-5 py-2 rounded-full text-sm font-medium transition-all duration-200",
                  activeForumCategory === category
                    ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/20"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60",
                )}
              >
                {category}
              </button>
            ))
          ) : (
            <div className="w-full flex items-center justify-between">
              <div className="flex flex-wrap gap-2">
                {EVENT_CATEGORIES.map((category) => (
                  <button
                    key={category}
                    onClick={() => setActiveEventCategory(category)}
                    className={cn(
                      "px-5 py-2 rounded-full text-sm font-medium transition-all duration-200",
                      activeEventCategory === category
                        ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/20"
                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60",
                    )}
                  >
                    {category}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                className="rounded-full bg-white text-slate-700 border-slate-200"
              >
                <Ticket className="w-4 h-4 mr-2 text-yellow-500" />
                我的票券
              </Button>
            </div>
          )}
        </div>

        {/* Posts/Events Grid */}
        <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6 px-6 pb-8">
          {isLoading ? (
            <div className="col-span-full py-20 text-center text-slate-500">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-500 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
              <p className="mt-4">加载中...</p>
            </div>
          ) : activeTab === "forum" ? (
            posts.length === 0 ? (
              <div className="col-span-full py-20 text-center text-slate-500 bg-white rounded-2xl border border-slate-100">
                暂无帖子
              </div>
            ) : (
              posts.map((post) => (
                <div key={post.id} className="break-inside-avoid">
                  <Card className="overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 bg-white rounded-2xl group cursor-pointer border border-slate-100">
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
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-300 to-red-400 flex items-center justify-center text-white font-bold shrink-0 overflow-hidden">
                          {post.author_avatar ? (
                            <img
                              src={post.author_avatar}
                              alt={post.author_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            post.author_name?.charAt(0)?.toUpperCase() || "U"
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 leading-tight line-clamp-2 mb-1 group-hover:text-indigo-600 transition-colors">
                            {post.title}
                          </h3>
                          <p className="text-xs text-slate-500">
                            by {post.author_name || "Anonymous"}
                          </p>
                        </div>
                      </div>

                      <p className="text-sm text-slate-600 line-clamp-2 mb-4">
                        {post.excerpt || post.content}
                      </p>

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

                      <div className="flex items-center justify-between text-xs text-slate-400 pt-4 border-t border-slate-50">
                        <span>{getTimeAgo(post.created_at)}</span>
                        <div className="flex items-center gap-4">
                          <span className="flex items-center gap-1">
                            {post.views || 0} 阅读
                          </span>
                          <span className="flex items-center gap-1">
                            {post.comments_count || 0} 评论
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))
            )
          ) : events.length === 0 ? (
            <div className="col-span-full py-20 text-center text-slate-500 bg-white rounded-2xl border border-slate-100">
              暂无活动
            </div>
          ) : (
            events.map((event) => {
              return (
                <div key={event.id} className="break-inside-avoid">
                  <Card className="overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 bg-white rounded-2xl group cursor-pointer flex flex-col h-full border border-slate-100">
                    {/* Gradient Header */}
                    <div
                      className={cn(
                        "h-40 relative flex items-end p-5 bg-gradient-to-br",
                        event.theme_color || "from-indigo-400 to-purple-400",
                      )}
                    >
                      {event.badge && (
                        <div
                          className={cn(
                            "absolute top-4 right-4 text-xs font-bold px-3 py-1 rounded-full shadow-sm",
                            event.badge === "即将开始"
                              ? "bg-teal-100 text-teal-700"
                              : "bg-white/90 text-indigo-600",
                          )}
                        >
                          {event.badge}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {parseTags(event.tags).map((tag, idx) => (
                          <span
                            key={idx}
                            className="bg-black/20 text-white backdrop-blur-md text-xs px-2.5 py-1 rounded-md font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <CardContent className="p-5 flex-1 flex flex-col">
                      <h3 className="text-lg font-bold text-slate-900 leading-tight mb-4 group-hover:text-indigo-600 transition-colors">
                        {event.title}
                      </h3>

                      <div className="space-y-3 mb-6 mt-auto">
                        <div className="flex items-center text-slate-500 text-sm">
                          <Clock className="w-4 h-4 mr-2 text-slate-400" />
                          {new Date(event.start_time)
                            .toLocaleDateString()
                            .replace(/\//g, ".")}
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
                            {event.joined_count} 人
                          </span>
                        </div>
                        <div className="flex items-center">
                          限额{" "}
                          <span className="font-semibold text-slate-700 ml-1">
                            {event.limit_count} 人
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
