import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, FileText, CheckSquare } from "lucide-react";

interface HomeStats {
  userCount: number;
  postCount: number;
  taskCount: number;
}

export default function Home() {
  const [stats, setStats] = useState<HomeStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/api/home/stats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!response.ok) {
          throw new Error("Failed to fetch stats");
        }
        const result = await response.json();
        const data = result.data;
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load stats");
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
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
