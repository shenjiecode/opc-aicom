import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, MapPin, Users, Tag, Image, ArrowLeft } from "lucide-react";

interface CreateEventRequest {
  title: string;
  description: string;
  cover_image: string;
  start_time: string;
  end_time: string;
  location: string;
  category: string;
  tags: string;
  limit_count: number;
  theme_color: string;
}

export default function CreateEvent() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState<CreateEventRequest>({
    title: "",
    description: "",
    cover_image: "",
    start_time: "",
    end_time: "",
    location: "",
    category: "技术分享",
    tags: "",
    limit_count: 50,
    theme_color: "#10b981",
  });

  const categories = [
    "技术分享",
    "产品发布",
    "社区活动",
    "培训课程",
    "行业峰会",
    "其他",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      // Convert datetime-local format to RFC3339
      const toRFC3339 = (datetimeLocal: string): string => {
        if (!datetimeLocal) return "";
        // datetime-local format: "2026-07-01T14:00"
        // Add seconds and timezone offset for China (UTC+8)
        return `${datetimeLocal}:00+08:00`;
      };

      const payload = {
        ...formData,
        start_time: toRFC3339(formData.start_time),
        end_time: toRFC3339(formData.end_time),
      };

      const result = await apiFetch<{ id: number; share_code: string }>(
        "/event/create",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );
      navigate(`/event/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建活动失败");
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
      [name]: name === "limit_count" ? parseInt(value) || 0 : value,
    }));
  };

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
          <h1 className="text-xl font-bold text-slate-800">发布新活动</h1>
          <p className="text-sm text-slate-500 mt-1">
            填写活动信息，发布后可通过二维码分享给他人报名
          </p>
        </div>
      </div>

      {/* Main Content Area (Scrollable) */}
      <div className="flex-1 overflow-y-auto min-h-0 w-full">
        <div className="max-w-3xl mx-auto px-4 py-8 pb-32">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">基本信息</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  活动标题 *
                </label>
                <Input
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="例如：2026 AI Native 开发者大会"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  活动描述
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="活动详细介绍..."
                  className="w-full min-h-[100px] px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <Image className="w-4 h-4 inline mr-1" />
                  封面图片URL
                </label>
                <Input
                  name="cover_image"
                  value={formData.cover_image}
                  onChange={handleChange}
                  placeholder="https://example.com/image.jpg"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">时间与地点</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    开始时间 *
                  </label>
                  <Input
                    type="datetime-local"
                    name="start_time"
                    value={formData.start_time}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    结束时间 *
                  </label>
                  <Input
                    type="datetime-local"
                    name="end_time"
                    value={formData.end_time}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  活动地点
                </label>
                <Input
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  placeholder="例如：深圳市南山区科技园"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">分类与限制</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <Tag className="w-4 h-4 inline mr-1" />
                  活动分类
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  标签（逗号分隔）
                </label>
                <Input
                  name="tags"
                  value={formData.tags}
                  onChange={handleChange}
                  placeholder="AI, 开发者, 技术"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  <Users className="w-4 h-4 inline mr-1" />
                  人数限制
                </label>
                <Input
                  type="number"
                  name="limit_count"
                  value={formData.limit_count}
                  onChange={handleChange}
                  min={0}
                  placeholder="0表示不限制"
                />
              </div>
            </CardContent>
          </Card>

          {/* 悬浮操作栏 / Fixed Action Bar */}
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
                className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 shadow-sm"
              >
                {isSubmitting ? "发布中..." : "发布活动"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  </div>
  );
}
