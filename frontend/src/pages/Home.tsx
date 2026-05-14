import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, FileText, CheckSquare, Circle, Clock } from "lucide-react";

interface HomeStats {
  userCount: number;
  postCount: number;
  taskCount: number;
}

interface OnlineUser {
  userId: number;
  username: string;
  avatar: string | null;
  role: string;
  lastActive: string;
  isOnline: boolean;
}

interface OnlineUsersResponse {
  users: OnlineUser[];
  onlineCount: number;
  totalCount: number;
}

export default function Home() {
  const [stats, setStats] = useState<HomeStats | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUsersResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch stats
        const statsResult = await apiFetch<{ userCount: number; postCount: number; taskCount: number }>("/home/stats", {
          method: "POST",
          body: JSON.stringify({}),
        });
        setStats(statsResult);

        // Fetch online users
        const usersResult = await apiFetch<{ users: OnlineUser[]; onlineCount: number; totalCount: number }>("/user/online", {
          method: "POST",
          body: JSON.stringify({}),
        });
        setOnlineUsers(usersResult);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const statCards = [
    {
      title: "Users",
      value: stats?.userCount ?? 0,
      icon: Users,
      description: "Active community members",
    },
    {
      title: "Posts",
      value: stats?.postCount ?? 0,
      icon: FileText,
      description: "Community posts shared",
    },
    {
      title: "Tasks",
      value: stats?.taskCount ?? 0,
      icon: CheckSquare,
      description: "Tasks completed",
    },
  ];

  const formatLastActive = (lastActive: string) => {
    if (!lastActive || lastActive === "0001-01-01T00:00:00Z") {
      return "从未活跃";
    }
    const date = new Date(lastActive);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffMinutes < 1) return "刚刚";
    if (diffMinutes < 60) return `${diffMinutes}分钟前`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}小时前`;
    return `${Math.floor(diffMinutes / 1440)}天前`;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">
            Welcome Home
          </h1>
          <p className="text-slate-600">Your OPC dashboard at a glance</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {error}
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">
                    {stat.title}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-slate-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-900">
                    {isLoading ? "..." : stat.value.toLocaleString()}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {stat.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Online Users Section */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  在线用户
                </CardTitle>
                <CardDescription>
                  查看当前社区成员的在线状态
                </CardDescription>
              </div>
              {!isLoading && onlineUsers && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Circle className="w-2.5 h-2.5 fill-green-500 text-green-500" />
                    <span className="text-sm font-medium text-green-600">
                      {onlineUsers.onlineCount} 在线
                    </span>
                  </div>
                  <span className="text-sm text-slate-400">
                    / {onlineUsers.totalCount} 总用户
                  </span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900" />
              </div>
            ) : onlineUsers && (onlineUsers.users?.length ?? 0) > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {onlineUsers!.users.map((user) => (
                  <div
                    key={user.userId}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      user.isOnline
                        ? "bg-green-50 border-green-200 hover:bg-green-100"
                        : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                          user.isOnline
                            ? "bg-gradient-to-br from-green-400 to-green-600"
                            : "bg-gradient-to-br from-slate-400 to-slate-500"
                        }`}
                      >
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      {/* Online indicator */}
                      {user.isOnline && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-white" />
                      )}
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900 truncate">
                          {user.username}
                        </span>
                        {user.isOnline && (
                          <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-300">
                            在线
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="h-3 w-3" />
                        {formatLastActive(user.lastActive)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                暂无用户数据
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Navigate to key areas of the application
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <Button onClick={() => navigate("/community")} variant="default">
                View Community
              </Button>
              <Button onClick={() => navigate("/tasks")} variant="outline">
                View Tasks
              </Button>
              <Button onClick={() => navigate("/my-opc")} variant="secondary">
                My OPC
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}