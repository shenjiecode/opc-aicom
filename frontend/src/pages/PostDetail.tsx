import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  Heart,
  MessageCircle,
  Eye,
  ArrowLeft,
  Send,
  Loader2,
  User,
  Clock,
  Share2,
  AlertCircle,
} from "lucide-react";

interface Post {
  id: number;
  title: string;
  content: string;
  category: string;
  tags: string;
  views: number;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  created_at: string;
  author_name: string;
  author_avatar: string | null;
}

interface Comment {
  id: number;
  content: string;
  created_at: string;
  author_name: string;
  author_avatar: string | null;
}

interface CommentListResponse {
  list: Comment[];
  total: number;
  page: number;
  pageSize: number;
}

export default function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiking, setIsLiking] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [commentContent, setCommentContent] = useState("");
  const [error, setError] = useState("");
  const [commentPage, setCommentPage] = useState(1);
  const [hasMoreComments, setHasMoreComments] = useState(false);

  useEffect(() => {
    fetchPostDetail();
    fetchComments();
  }, [id]);

  const fetchPostDetail = async () => {
    try {
      const result = await apiFetch<Post>(`/community/${id}`);
      setPost(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取帖子失败");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchComments = async (page = 1) => {
    try {
      const result = await apiFetch<CommentListResponse>(
        `/community/${id}/comments?page=${page}&pageSize=20`
      );
      if (page === 1) {
        setComments(result.list || []);
      } else {
        setComments((prev) => [...prev, ...(result.list || [])]);
      }
      setHasMoreComments(result.list.length === 20);
      setCommentPage(page);
    } catch (err) {
      console.error("Failed to load comments", err);
    }
  };

  const handleLike = async () => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    if (isLiking || !post) return;

    setIsLiking(true);
    try {
      await apiFetch("/community/like", {
        method: "POST",
        body: JSON.stringify({ postId: Number(id) }),
      });
      setPost((prev) =>
        prev
          ? {
              ...prev,
              is_liked: !prev.is_liked,
              likes_count: prev.is_liked
                ? prev.likes_count - 1
                : prev.likes_count + 1,
            }
          : null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "点赞失败");
    } finally {
      setIsLiking(false);
    }
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    if (!commentContent.trim() || isSubmittingComment) return;

    setIsSubmittingComment(true);
    try {
      await apiFetch("/community/comment", {
        method: "POST",
        body: JSON.stringify({
          postId: Number(id),
          content: commentContent.trim(),
        }),
      });
      setCommentContent("");
      fetchComments(1);
      setPost((prev) =>
        prev
          ? { ...prev, comments_count: prev.comments_count + 1 }
          : null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "评论失败");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const loadMoreComments = () => {
    fetchComments(commentPage + 1);
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60)
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

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    alert("链接已复制到剪贴板");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-4">{error || "帖子不存在"}</p>
          <Button onClick={() => navigate("/community")}>返回社区</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-slate-600 hover:text-slate-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回
        </button>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Post Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Post Card */}
            <Card className="border border-slate-100">
              <CardContent className="p-6">
                {/* Author Info */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold shrink-0 overflow-hidden">
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
                    <p className="font-semibold text-slate-900">
                      {post.author_name || "Anonymous"}
                    </p>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {getTimeAgo(post.created_at)}
                    </p>
                  </div>
                </div>

                {/* Title & Category */}
                <div className="mb-4">
                  <h1 className="text-2xl font-bold text-slate-900 mb-3">
                    {post.title}
                  </h1>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100">
                      {post.category}
                    </Badge>
                    {parseTags(post.tags).map((tag, idx) => (
                      <Badge key={idx} variant="outline" className="text-slate-600">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Content */}
                <div className="prose prose-slate max-w-none">
                  <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {post.content}
                  </p>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6 mt-6 pt-6 border-t border-slate-100 text-sm text-slate-500">
                  <span className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    {post.views || 0} 阅读
                  </span>
                  <span className="flex items-center gap-1">
                    <Heart className="w-4 h-4" />
                    {post.likes_count || 0} 点赞
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="w-4 h-4" />
                    {post.comments_count || 0} 评论
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Comments Section */}
            <Card className="border border-slate-100">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-indigo-500" />
                  评论 ({post.comments_count})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                {/* Comment Input */}
                {isAuthenticated ? (
                  <form onSubmit={handleSubmitComment} className="mb-6">
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <textarea
                          value={commentContent}
                          onChange={(e) => setCommentContent(e.target.value)}
                          placeholder="写下你的评论..."
                          className="w-full min-h-[80px] px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={isSubmittingComment || !commentContent.trim()}
                        className="bg-indigo-500 hover:bg-indigo-600 self-end h-10 px-4"
                      >
                        {isSubmittingComment ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200 text-center">
                    <p className="text-slate-600 text-sm mb-2">登录后即可发表评论</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/login")}
                    >
                      去登录
                    </Button>
                  </div>
                )}

                {/* Comments List */}
                <div className="space-y-4">
                  {comments.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>暂无评论，来发表第一条评论吧</p>
                    </div>
                  ) : (
                    <>
                      {comments.map((comment) => (
                        <div
                          key={comment.id}
                          className="flex gap-3 p-4 bg-slate-50 rounded-lg"
                        >
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-300 to-purple-400 flex items-center justify-center text-white font-bold shrink-0 text-sm overflow-hidden">
                            {comment.author_avatar ? (
                              <img
                                src={comment.author_avatar}
                                alt={comment.author_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              comment.author_name?.charAt(0)?.toUpperCase() ||
                              "U"
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-slate-900 text-sm">
                                {comment.author_name || "Anonymous"}
                              </span>
                              <span className="text-xs text-slate-400">
                                {getTimeAgo(comment.created_at)}
                              </span>
                            </div>
                            <p className="text-slate-700 text-sm whitespace-pre-wrap">
                              {comment.content}
                            </p>
                          </div>
                        </div>
                      ))}
                      {hasMoreComments && (
                        <Button
                          variant="outline"
                          className="w-full mt-4"
                          onClick={loadMoreComments}
                        >
                          加载更多评论
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Actions */}
          <div className="space-y-6">
            {/* Like Card */}
            <Card className="border border-slate-100">
              <CardContent className="p-6">
                <Button
                  onClick={handleLike}
                  disabled={isLiking}
                  className={cn(
                    "w-full h-14 text-lg font-semibold transition-all duration-200",
                    post.is_liked
                      ? "bg-rose-500 hover:bg-rose-600 text-white"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                  )}
                >
                  {isLiking ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Heart
                        className={cn(
                          "w-5 h-5 mr-2",
                          post.is_liked && "fill-current"
                        )}
                      />
                      {post.is_liked ? "已点赞" : "点赞"}
                    </>
                  )}
                </Button>
                <p className="text-center text-slate-500 text-sm mt-3">
                  {post.likes_count} 人已点赞
                </p>
              </CardContent>
            </Card>

            {/* Share Card */}
            <Card className="border border-slate-100">
              <CardHeader>
                <CardTitle className="text-lg">分享帖子</CardTitle>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleShare}
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  复制链接
                </Button>
              </CardContent>
            </Card>

            {/* Login Prompt */}
            {!isAuthenticated && (
              <Card className="border border-slate-100 bg-indigo-50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-indigo-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-slate-900 mb-1">
                        登录解锁更多功能
                      </p>
                      <p className="text-xs text-slate-600 mb-3">
                        登录后可以点赞、评论和发布帖子
                      </p>
                      <Button
                        size="sm"
                        className="w-full bg-indigo-500 hover:bg-indigo-600"
                        onClick={() => navigate("/login")}
                      >
                        <User className="w-4 h-4 mr-2" />
                        立即登录
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
