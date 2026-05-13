import { useState, useEffect } from "react";
import axios from "axios";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  MessageSquare,
  Settings,
  Bot,
  BrainCircuit,
  Database,
  Coins,
  Play,
  Pause
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Agent {
  id: number;
  name: string;
  description: string;
  status: string;
  driven_model: string;
  knowledge_base: string;
  cost_per_use: number;
  theme_color: string;
  icon_emoji: string;
}

export default function MyAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        setLoading(true);
        const res = await axios.post('/api/agents/list');
        if (res.data.code === 200) {
          setAgents(res.data.data.list || []);
        }
      } catch (error) {
        console.error("Failed to fetch agents:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAgents();
  }, []);

  return (
    <div className="min-h-full flex flex-col bg-[var(--bg-default)]">
      {/* Banner Area */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[var(--primary-900)] to-[var(--bg-default)] border-b border-[var(--border-default)]">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 pointer-events-none">
          <div className="absolute right-10 top-10 w-64 h-64 bg-[var(--primary-500)] rounded-full mix-blend-screen filter blur-[80px] animate-pulse" />
          <div className="absolute right-40 bottom-10 w-48 h-48 bg-purple-500 rounded-full mix-blend-screen filter blur-[60px] animate-pulse" style={{ animationDelay: "2s" }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 lg:px-8 py-12 lg:py-16">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--primary-500)]/10 border border-[var(--primary-500)]/20 text-[var(--primary-500)] text-sm font-medium mb-6">
                <Bot className="w-4 h-4" />
                <span>My Agents</span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold text-[var(--text-primary)] mb-6 tracking-tight">
                我的智能体
              </h1>
              <p className="text-lg text-[var(--text-secondary)] leading-relaxed">
                管理和调用您专属的 AI 智能体，提升工作效率
              </p>
            </div>
            
            <div className="flex-shrink-0 flex items-center gap-4">
              <Button size="lg" className="bg-[var(--primary-600)] hover:bg-[var(--primary-500)] text-white shadow-lg shadow-[var(--primary-500)]/20">
                <Plus className="w-5 h-5 mr-2" />
                创建智能体
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 max-w-7xl mx-auto px-6 lg:px-8 py-10 w-full">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary-500)]"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {agents.map((agent) => (
              <Card 
                key={agent.id} 
                className="group relative bg-[var(--bg-elevated)] border-[var(--border-default)] hover:border-[var(--primary-500)]/50 transition-all duration-300 flex flex-col h-full overflow-hidden"
              >
                {/* Status Indicator Line */}
                <div className={cn(
                  "absolute top-0 left-0 w-full h-1",
                  agent.status === "运行中" ? "bg-green-500" : "bg-gray-500"
                )} />

                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-sm bg-gradient-to-br",
                      agent.theme_color
                    )}>
                      {agent.icon_emoji}
                    </div>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        "font-normal",
                        agent.status === "运行中" 
                          ? "bg-green-500/10 text-green-500 border-green-500/20" 
                          : "bg-gray-500/10 text-gray-400 border-gray-500/20"
                      )}
                    >
                      {agent.status === "运行中" ? <Play className="w-3 h-3 mr-1" /> : <Pause className="w-3 h-3 mr-1" />}
                      {agent.status}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl font-semibold mt-4 text-[var(--text-primary)]">
                    {agent.name}
                  </CardTitle>
                  <p className="text-sm text-[var(--text-secondary)] mt-2 line-clamp-2 min-h-[40px]">
                    {agent.description}
                  </p>
                </CardHeader>
                
                <CardContent className="flex-1 pb-4">
                  <div className="space-y-3">
                    <div className="flex items-center text-sm text-[var(--text-secondary)] bg-[var(--bg-muted)] px-3 py-2 rounded-md">
                      <BrainCircuit className="w-4 h-4 mr-2 text-[var(--primary-500)] flex-shrink-0" />
                      <span className="truncate">{agent.driven_model}</span>
                    </div>
                    
                    <div className="flex items-center text-sm text-[var(--text-secondary)] bg-[var(--bg-muted)] px-3 py-2 rounded-md">
                      <Database className="w-4 h-4 mr-2 text-purple-500 flex-shrink-0" />
                      <span className="truncate" title={agent.knowledge_base}>{agent.knowledge_base || "无知识库"}</span>
                    </div>

                    <div className="flex items-center text-sm text-[var(--text-secondary)] bg-[var(--bg-muted)] px-3 py-2 rounded-md">
                      <Coins className="w-4 h-4 mr-2 text-amber-500 flex-shrink-0" />
                      <span>{agent.cost_per_use} 积分 / 次</span>
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="pt-0 border-t border-[var(--border-default)] mt-auto flex gap-2">
                  <Button variant="default" className="flex-1 bg-[var(--primary-600)] hover:bg-[var(--primary-500)] mt-4">
                    <MessageSquare className="w-4 h-4 mr-2" />
                    对话
                  </Button>
                  <Button variant="outline" className="flex-1 border-[var(--border-default)] hover:bg-[var(--bg-muted)] mt-4 text-[var(--text-primary)]">
                    <Settings className="w-4 h-4 mr-2" />
                    配置
                  </Button>
                </CardFooter>
              </Card>
            ))}

            {/* Empty State / Add New Card */}
            <Card className="group relative bg-[var(--bg-elevated)] border-[var(--border-default)] border-dashed hover:border-[var(--primary-500)] transition-all duration-300 flex flex-col h-full items-center justify-center min-h-[320px] cursor-pointer hover:bg-[var(--primary-500)]/5">
              <div className="w-14 h-14 rounded-full bg-[var(--bg-muted)] group-hover:bg-[var(--primary-500)]/20 flex items-center justify-center transition-colors">
                <Plus className="w-6 h-6 text-[var(--text-muted)] group-hover:text-[var(--primary-500)]" />
              </div>
              <p className="mt-4 text-sm font-medium text-[var(--text-secondary)] group-hover:text-[var(--primary-500)]">
                创建新智能体
              </p>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}