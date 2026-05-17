import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { PenLine, ArrowLeft, Loader2, Tag, AlertCircle, X } from "lucide-react";

const FORUM_CATEGORIES = [
  "AI工具",
  "创业分享",
  "效率提升",
  "工作流",
  "资源推荐",
  "求助",
  "项目招募",
  "技术干货",
];

interface CreatePostRequest {
  title: string;
  content: string;
  category: string;
  tags: string;
}

export default function CreatePost() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState<CreatePostRequest>({
    title: "",
    content: "",
    category: FORUM_CATEGORIES[0],
    tags: "",
  });
  const [tagInput, setTagInput] = useState("");
  const [tagList, setTagList] = useState<string[]>([]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    if (!formData.title.trim()) {
      setError("请输入帖子标题");
      setIsSubmitting(false);
      return;
    }

    if (!formData.content.trim()) {
      setError("请输入帖子内容");
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = {
        ...formData,
        tags: tagList.join(","),
      };

      const result = await apiFetch<{ id: number }>("/community/create", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      navigate(`/post/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发布帖子失败");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddTag = () => {
    const trimmedTag = tagInput.trim();
    if (trimmedTag && !tagList.includes(trimmedTag) && tagList.length < 5) {
      setTagList([...tagList, trimmedTag]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTagList(tagList.filter((tag) => tag !== tagToRemove));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  if (authLoading) {
    return (
      <div className="absolute inset-0 bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="absolute inset-0 bg-slate-50 flex flex-col overflow-hidden">
      {/* Header (Fixed) */}
      <div className="shrink-0 w-full px-6 py-4 flex items-center justify-between z-10 bg-slate-50 border-b border-slate-200">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-slate-500 hover:text-slate-800 mb-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回
          </button>
          <h1 className="text-xl font-bold text-slate-800">发布新帖子</h1>
          <p className="text-sm text-slate-500 mt-1">
            分享你的想法、经验或提出问题
          </p>
        </div>
      </div>

      {/* Main Content Area (Scrollable) */}
      <div className="flex-1 overflow-y-auto min-h-0 w-full">
        <div className="max-w-3xl mx-auto px-4 py-8 pb-32">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Basic Info Card */}
            <Card className="mb-6 border border-slate-100">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <PenLine className="w-5 h-5 text-indigo-500" />
                  基本信息
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    帖子标题 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    placeholder="请输入帖子标题"
                    maxLength={100}
                    className="focus-visible:ring-indigo-500"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    {formData.title.length}/100 字
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    帖子内容 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="content"
                    value={formData.content}
                    onChange={handleChange}
                    placeholder="详细描述你的内容..."
                    className="w-full min-h-[200px] px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Category Card */}
            <Card className="mb-6 border border-slate-100">
              <CardHeader>
                <CardTitle className="text-lg">分类与标签</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    选择分类
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {FORUM_CATEGORIES.map((category) => (
                      <button
                        key={category}
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({ ...prev, category }))
                        }
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                          formData.category === category
                            ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/20"
                            : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    <Tag className="w-4 h-4 inline mr-1" />
                    标签
                  </label>
                  <div className="flex gap-2 mb-3">
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleTagKeyDown}
                      placeholder="输入标签后按回车添加"
                      className="flex-1 focus-visible:ring-indigo-500"
                      disabled={tagList.length >= 5}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddTag}
                      disabled={!tagInput.trim() || tagList.length >= 5}
                    >
                      添加
                    </Button>
                  </div>
                  {tagList.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {tagList.map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="px-2 py-1 text-sm flex items-center gap-1"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="ml-1 hover:text-red-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-slate-400 mt-2">
                    最多添加5个标签，标签可以帮助更多人发现你的帖子
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Fixed Action Bar */}
            <div className="fixed bottom-0 left-0 lg:left-[260px] right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-200 z-20 flex justify-center">
              <div className="flex gap-4 w-full max-w-3xl px-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(-1)}
                  className="flex-1 h-12 text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 shadow-sm border-slate-300 font-medium"
                >
                  取消
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 h-12 bg-indigo-500 hover:bg-indigo-600 shadow-sm"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      发布中...
                    </>
                  ) : (
                    <>
                      <PenLine className="w-4 h-4 mr-2" />
                      发布帖子
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
