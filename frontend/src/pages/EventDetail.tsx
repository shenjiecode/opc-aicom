import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  MapPin,
  Users,
  Tag,
  Share2,
  QrCode,
  CheckCircle,
  Loader2,
  ArrowLeft,
  User,
} from "lucide-react";

interface Event {
  id: number;
  user_id: number;
  title: string;
  description: string;
  cover_image: string;
  start_time: string;
  end_time: string;
  location: string;
  category: string;
  tags: string;
  status: string;
  joined_count: number;
  limit_count: number;
  share_code: string;
  theme_color: string;
  created_at: string;
}

interface EventDetailResponse {
  event: Event;
  is_registered: boolean;
}

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchEvent();
  }, [id]);

  const fetchEvent = async () => {
    try {
      const result = await apiFetch<EventDetailResponse>(`/event/${id}`);
      setEvent(result.event);
      setIsRegistered(result.is_registered);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取活动失败");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    setIsRegistering(true);
    try {
      await apiFetch("/event/join", {
        method: "POST",
        body: JSON.stringify({ event_id: Number(id) }),
      });
      setIsRegistered(true);
      setEvent((prev) =>
        prev ? { ...prev, joined_count: prev.joined_count + 1 } : null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "报名失败");
    } finally {
      setIsRegistering(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const shareUrl = event
    ? `${window.location.origin}/event/share/${event.share_code}`
    : "";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-4">{error || "活动不存在"}</p>
          <Button onClick={() => navigate("/community")}>返回社区</Button>
        </div>
      </div>
    );
  }

  const isFull = event.limit_count > 0 && event.joined_count >= event.limit_count;
  const isEnded = event.status === "已结束";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-slate-600 hover:text-slate-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回
        </button>

        {/* Cover Image */}
        {event.cover_image && (
          <div className="w-full h-64 rounded-xl overflow-hidden mb-6">
            <img
              src={event.cover_image}
              alt={event.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Event Info */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                      {event.title}
                    </h1>
                    <Badge className="mt-2">{event.category}</Badge>
                  </div>
                  <Badge
                    variant={isEnded ? "destructive" : "default"}
                    className={
                      isEnded
                        ? ""
                        : "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                    }
                  >
                    {event.status}
                  </Badge>
                </div>

                <div className="space-y-3 text-slate-600">
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-2 text-emerald-600" />
                    <span>{formatDate(event.start_time)}</span>
                    <span className="mx-2">-</span>
                    <span>{formatDate(event.end_time)}</span>
                  </div>

                  {event.location && (
                    <div className="flex items-center">
                      <MapPin className="w-4 h-4 mr-2 text-emerald-600" />
                      <span>{event.location}</span>
                    </div>
                  )}

                  <div className="flex items-center">
                    <Users className="w-4 h-4 mr-2 text-emerald-600" />
                    <span>
                      {event.joined_count} 人已报名
                      {event.limit_count > 0 && ` / 限 ${event.limit_count} 人`}
                    </span>
                  </div>

                  {event.tags && (
                    <div className="flex items-center">
                      <Tag className="w-4 h-4 mr-2 text-emerald-600" />
                      <div className="flex gap-2">
                        {event.tags.split(",").map((tag, i) => (
                          <Badge key={i} variant="outline">
                            {tag.trim()}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {event.description && (
                  <div className="mt-6 pt-6 border-t border-slate-100">
                    <h3 className="font-semibold text-slate-900 mb-2">
                      活动介绍
                    </h3>
                    <p className="text-slate-600 whitespace-pre-wrap">
                      {event.description}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Actions */}
          <div className="space-y-6">
            {/* Registration Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">参与活动</CardTitle>
              </CardHeader>
              <CardContent>
                {isRegistered ? (
                  <div className="text-center">
                    <CheckCircle className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
                    <p className="text-emerald-600 font-medium mb-4">
                      您已报名此活动
                    </p>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowQR(!showQR)}
                    >
                      <QrCode className="w-4 h-4 mr-2" />
                      {showQR ? "隐藏二维码" : "分享活动"}
                    </Button>
                  </div>
                ) : isFull ? (
                  <div className="text-center">
                    <p className="text-slate-600 mb-4">报名人数已满</p>
                    <Button disabled className="w-full">
                      无法报名
                    </Button>
                  </div>
                ) : isEnded ? (
                  <div className="text-center">
                    <p className="text-slate-600 mb-4">活动已结束</p>
                    <Button disabled className="w-full">
                      无法报名
                    </Button>
                  </div>
                ) : (
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    onClick={handleRegister}
                    disabled={isRegistering}
                  >
                    {isRegistering ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        报名中...
                      </>
                    ) : (
                      <>
                        <User className="w-4 h-4 mr-2" />
                        立即报名
                      </>
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* QR Code Card */}
            {showQR && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center">
                    <QrCode className="w-4 h-4 mr-2" />
                    扫码分享活动
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center">
                    <div className="bg-white p-4 rounded-lg border border-slate-200 mb-4">
                      <QRCodeSVG
                        value={shareUrl}
                        size={200}
                        level="H"
                        includeMargin
                      />
                    </div>
                    <p className="text-sm text-slate-500 text-center mb-4">
                      扫描二维码分享给好友
                    </p>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        navigator.clipboard.writeText(shareUrl);
                        alert("链接已复制到剪贴板");
                      }}
                    >
                      <Share2 className="w-4 h-4 mr-2" />
                      复制分享链接
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Share Without Registration */}
            {!isRegistered && !showQR && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setShowQR(true)}
              >
                <QrCode className="w-4 h-4 mr-2" />
                分享活动
              </Button>
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
