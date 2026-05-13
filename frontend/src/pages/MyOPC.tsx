import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Coins,
  Ticket,
  Cpu,
  ListTodo,
  TrendingUp,
  Package,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  Heart,
  MessageCircle,
} from "lucide-react";

interface UserAssets {
  points: number;
  coupons: number;
  computeHours: number;
}

interface Task {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  reward: number;
  createdAt: string;
  updatedAt: string;
}

interface Post {
  id: string;
  title: string;
  author: string;
  views: number;
  likes: number;
  comments: number;
  createdAt: string;
}

interface UserInfo {
  userId: string;
  username: string;
  assets: UserAssets;
  myTasks: Task[];
  appliedTasks: Task[];
}

const API_BASE = "/api";

async function fetchUserInfo(token: string): Promise<UserInfo> {
  const response = await fetch(`${API_BASE}/user/info`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to fetch user info");
  }

  const result = await response.json();
  return result.data;
}

async function fetchUserPosts(token: string): Promise<Post[]> {
  const response = await fetch(`${API_BASE}/community/list`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ page: 1, pageSize: 10 }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to fetch posts");
  }

  const result = await response.json();
  return result.data.posts || [];
}

function getStatusBadge(status: Task["status"]) {
  const config: Record<
    Task["status"],
    {
      variant: "default" | "secondary" | "destructive" | "outline";
      label: string;
      icon: typeof CheckCircle;
    }
  > = {
    pending: { variant: "outline", label: "Pending", icon: Clock },
    in_progress: {
      variant: "default",
      label: "In Progress",
      icon: AlertCircle,
    },
    completed: { variant: "secondary", label: "Completed", icon: CheckCircle },
    cancelled: {
      variant: "destructive",
      label: "Cancelled",
      icon: AlertCircle,
    },
  };

  const { variant, label, icon: Icon } = config[status];
  return (
    <Badge variant={variant} className="flex items-center gap-1">
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

export default function MyOPC() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          throw new Error("Please login to view this page");
        }

        const [info, posts] = await Promise.all([
          fetchUserInfo(token),
          fetchUserPosts(token),
        ]);

        setUserInfo(info);
        const myPosts = posts.filter((post) => post.author === info.username);
        setUserPosts(myPosts);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load user info",
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const assetCards = [
    {
      title: "Points",
      value: userInfo?.assets.points ?? 0,
      icon: Coins,
      description: "Earned from completing tasks",
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
    },
    {
      title: "Coupons",
      value: userInfo?.assets.coupons ?? 0,
      icon: Ticket,
      description: "Available discount coupons",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Compute Hours",
      value: userInfo?.assets.computeHours ?? 0,
      icon: Cpu,
      description: "Remaining compute resources",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
  ];

  const totalTasks =
    (userInfo?.myTasks?.length || 0) + (userInfo?.appliedTasks?.length || 0);
  const completedTasks =
    (userInfo?.myTasks?.filter((t) => t.status === "completed").length || 0) +
    (userInfo?.appliedTasks?.filter((t) => t.status === "completed").length ||
      0);
  const successRate =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const totalEarnings =
    (userInfo?.myTasks?.reduce((sum, t) => sum + t.reward, 0) || 0) +
    (userInfo?.appliedTasks?.reduce((sum, t) => sum + t.reward, 0) || 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <div className="h-16 w-16 rounded-full bg-slate-200 flex items-center justify-center">
              <span className="text-2xl font-bold text-slate-600">
                {userInfo?.username?.charAt(0).toUpperCase() || "?"}
              </span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">My OPC</h1>
              <p className="text-slate-600">
                @{userInfo?.username || "Loading..."}
              </p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {error}
          </div>
        )}

        {/* Assets Section */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold text-slate-900">Assets</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {assetCards.map((asset) => {
              const Icon = asset.icon;
              return (
                <Card key={asset.title}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-slate-600">
                      {asset.title}
                    </CardTitle>
                    <div className={`p-2 rounded-lg ${asset.bgColor}`}>
                      <Icon className={`h-4 w-4 ${asset.color}`} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-slate-900">
                      {asset.value.toLocaleString()}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {asset.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* My Tasks Section */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <ListTodo className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold text-slate-900">My Tasks</h2>
            <Badge variant="outline" className="ml-2">
              {userInfo?.myTasks?.length || 0}
            </Badge>
          </div>
          <Card>
            <CardContent className="pt-6">
              {userInfo?.myTasks?.length === 0 ? (
                <div className="py-8 text-center text-slate-500">
                  No tasks created yet
                </div>
              ) : (
                <div className="space-y-4">
                  {userInfo?.myTasks?.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors"
                    >
                      <div>
                        <h3 className="font-medium text-slate-900">
                          {task.title}
                        </h3>
                        <p className="text-sm text-slate-500">
                          Created{" "}
                          {new Date(task.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge
                          variant="secondary"
                          className="flex items-center gap-1"
                        >
                          <Coins className="h-3 w-3" />
                          {task.reward} pts
                        </Badge>
                        {getStatusBadge(task.status)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Applied Tasks Section */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold text-slate-900">
              Applied Tasks
            </h2>
            <Badge variant="outline" className="ml-2">
              {userInfo?.appliedTasks?.length || 0}
            </Badge>
          </div>
          <Card>
            <CardContent className="pt-6">
              {userInfo?.appliedTasks?.length === 0 ? (
                <div className="py-8 text-center text-slate-500">
                  No applied tasks yet
                </div>
              ) : (
                <div className="space-y-4">
                  {userInfo?.appliedTasks?.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors"
                    >
                      <div>
                        <h3 className="font-medium text-slate-900">
                          {task.title}
                        </h3>
                        <p className="text-sm text-slate-500">
                          Updated{" "}
                          {new Date(task.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge
                          variant="secondary"
                          className="flex items-center gap-1"
                        >
                          <Coins className="h-3 w-3" />
                          {task.reward} pts
                        </Badge>
                        {getStatusBadge(task.status)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Business Dashboard Section */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold text-slate-900">
              Business Dashboard
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-slate-600">
                  Task Success Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900">
                  {successRate}%
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {completedTasks} completed out of {totalTasks} tasks
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-slate-600">
                  Total Earnings Potential
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-slate-900">
                  {totalEarnings.toLocaleString()} pts
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Sum of rewards from all tasks
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* My Posts Section */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-5 w-5 text-slate-600" />
            <h2 className="text-xl font-semibold text-slate-900">My Posts</h2>
            <Badge variant="outline" className="ml-2">
              {userPosts.length}
            </Badge>
          </div>
          <Card>
            <CardContent className="pt-6">
              {userPosts.length === 0 ? (
                <div className="py-8 text-center text-slate-500">
                  No posts yet
                </div>
              ) : (
                <div className="space-y-4">
                  {userPosts.map((post) => (
                    <div
                      key={post.id}
                      className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-slate-900 truncate">
                          {post.title}
                        </h3>
                        <p className="text-sm text-slate-500">
                          {new Date(post.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          <Eye className="h-4 w-4" />
                          {post.views}
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart className="h-4 w-4" />
                          {post.likes}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="h-4 w-4" />
                          {post.comments}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
