import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, PlusCircle, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
  theme_color: string;
}

export default function MyEvents() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      // Just fetching all events for demo purposes of "My Events"
      const res = await apiFetch<{ list: Event[] }>("/community/events", {
        method: "POST",
        body: JSON.stringify({ page: 1, pageSize: 20 }),
      });
      if (res && res.list) {
        setEvents(res.list);
      }
    } catch (error) {
      console.error("Failed to fetch events", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-slate-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 w-full px-6 py-4 flex items-center justify-between z-10 bg-slate-50 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-800">我的活动</h1>
          <p className="text-sm text-slate-500 mt-1">管理我发布和参与的所有活动</p>
        </div>
        <Button
          onClick={() => navigate("/event/create")}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <PlusCircle className="w-4 h-4 mr-2" />
          发布活动
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 w-full">
        <div className="max-w-6xl mx-auto p-6 md:p-8">
          {isLoading ? (
            <div className="text-center py-20 text-slate-500">加载中...</div>
          ) : events.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">暂无活动</h3>
              <p className="text-slate-500 mb-6">您还没有发布或参与任何活动</p>
              <Button
                onClick={() => navigate("/event/create")}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                立即发布
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event) => (
                <Card key={event.id} className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/event/${event.id}`)}>
                  <div className={`h-32 bg-gradient-to-br ${event.theme_color || 'from-emerald-400 to-teal-500'} relative p-4 flex flex-col justify-between`}>
                    <div className="flex justify-between items-start">
                      <Badge className="bg-white/20 text-white hover:bg-white/30 border-none backdrop-blur-sm">
                        {event.category}
                      </Badge>
                      <Badge className="bg-white text-emerald-600 hover:bg-white border-none shadow-sm">
                        {event.status}
                      </Badge>
                    </div>
                    <h3 className="font-bold text-white text-lg line-clamp-1 mt-auto">{event.title}</h3>
                  </div>
                  <CardContent className="p-5">
                    <div className="space-y-3">
                      <div className="flex items-center text-sm text-slate-600">
                        <Calendar className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                        <span className="truncate">
                          {new Date(event.start_time).toLocaleDateString()} {new Date(event.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                      <div className="flex items-center text-sm text-slate-600">
                        <MapPin className="w-4 h-4 mr-2 text-slate-400 shrink-0" />
                        <span className="truncate">{event.location || '线上活动'}</span>
                      </div>
                      <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100">
                        <div className="flex items-center text-sm text-slate-500">
                          <Users className="w-4 h-4 mr-1.5 text-slate-400" />
                          <span>{event.joined_count} / {event.limit_count || '不限'} 人</span>
                        </div>
                        <Button variant="ghost" size="sm" className="h-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50">
                          管理
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
