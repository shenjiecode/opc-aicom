import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  MapPin,
  Users,
  Tag,
  User,
  CheckCircle,
  Loader2,
} from "lucide-react";

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
  status: string;
  joined_count: number;
  limit_count: number;
  share_code: string;
}

interface EventShareResponse {
  event: Event;
  is_registered: boolean;
}

export default function EventShare() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchEvent();
  }, [code]);

  const fetchEvent = async () => {
    try {
      const result = await apiFetch<EventShareResponse>(
        `/event/share/${code}`
      );
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
        body: JSON.stringify({ event_id: event?.id }),
      });
      setIsRegistered(true);
      setEvent((prev) =>
        prev ? { ...prev, joined_count: prev.joined_count + 1 } : null
      );
    } catch (err) {
      if (err instanceof Error && err.message.includes("登录")) {
        navigate(`/login?redirect=/event/share/${code}`);
      } else {
        setError(err instanceof Error ? err.message : "报名失败");
      }
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

  const shareUrl = `${window.location.origin}/event/share/${event?.share_code}`;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-4">{error || "活动不存在"}</p>
          <Button onClick={() => navigate("/")}>返回首页</Button>
        </div>
      </div>
    );
  }

  const isFull = event.limit_count > 0 && event.joined_count >= event.limit_count;
  const isEnded = event.status === "已结束";

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50">
      <div className="max-w-md mx-auto px-4 py-12">
        <Card className="overflow-hidden">
          {/* Cover Image */}
          {event.cover_image && (
            <div className="w-full h-48 overflow-hidden">
              <img
                src={event.cover_image}
                alt={event.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <CardContent className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-xl font-bold text-slate-900">
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

            <div className="space-y-2 text-sm text-slate-600 mb-6">
              <div className="flex items-center">
                <Calendar className="w-4 h-4 mr-2 text-emerald-600" />
                <span>{formatDate(event.start_time)}</span>
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
                  <div className="flex gap-1 flex-wrap">
                    {event.tags.split(",").map((tag, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {tag.trim()}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {event.description && (
              <p className="text-slate-600 text-sm mb-6 line-clamp-3">
                {event.description}
              </p>
            )}

            {isRegistered ? (
              <div className="text-center mb-6">
                <CheckCircle className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                <p className="text-emerald-600 font-medium">您已报名此活动</p>
              </div>
            ) : isFull ? (
              <Button disabled className="w-full mb-6">
                报名人数已满
              </Button>
            ) : isEnded ? (
              <Button disabled className="w-full mb-6">
                活动已结束
              </Button>
            ) : (
              <Button
                className="w-full mb-6 bg-emerald-600 hover:bg-emerald-700"
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

            {/* QR Code for further sharing */}
            <div className="border-t pt-6">
              <p className="text-center text-sm text-slate-500 mb-4">
                分享给更多人
              </p>
              <div className="flex justify-center">
                <div className="bg-white p-3 rounded-lg border border-slate-200">
                  <QRCodeSVG value={shareUrl} size={150} level="H" includeMargin />
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400 mt-6">
          Powered by BitBay OPC
        </p>
      </div>
    </div>
  );
}
