import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
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

  const handleRegister = () => {
    setShowRegisterDialog(true);
  };

  const handleGuestRegister = async () => {
    if (!guestName.trim() || !guestPhone.trim()) {
      setError("请填写姓名和电话");
      return;
    }
    if (!/^\d{11}$/.test(guestPhone)) {
      setError("请输入正确的手机号码");
      return;
    }
    setIsRegistering(true);
    setError("");
    try {
      await apiFetch("/event/guest-register", {
        method: "POST",
        body: JSON.stringify({
          event_id: event?.id,
          name: guestName.trim(),
          phone: guestPhone.trim(),
        }),
      });
      setIsRegistered(true);
      setShowRegisterDialog(false);
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
              <div className="text-slate-600 text-sm mb-6 prose prose-slate prose-sm max-w-none line-clamp-3">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {event.description}
                </ReactMarkdown>
              </div>
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

        {/* Guest Registration Dialog */}
        <Dialog open={showRegisterDialog} onOpenChange={setShowRegisterDialog}>
          <DialogContent className="bg-slate-900 border-slate-700 text-white">
            <DialogHeader>
              <DialogTitle className="text-white">活动报名</DialogTitle>
              <DialogDescription className="text-slate-400">
                请填写您的信息完成报名
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm text-slate-300">姓名</label>
                <Input
                  placeholder="请输入姓名"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-slate-300">电话</label>
                <Input
                  placeholder="请输入11位手机号码"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  maxLength={11}
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
            </div>
            {error && (
              <div className="text-red-400 text-sm">{error}</div>
            )}
            <DialogFooter className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowRegisterDialog(false)}
                className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                取消
              </Button>
              <Button
                onClick={handleGuestRegister}
                disabled={isRegistering}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isRegistering ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    提交中...
                  </>
                ) : (
                  "确认报名"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <p className="text-center text-xs text-slate-400 mt-6">
          Powered by BitBay OPC
        </p>
      </div>
    </div>
  );
}
