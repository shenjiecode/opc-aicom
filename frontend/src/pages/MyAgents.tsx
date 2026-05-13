import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Bot,
  Plus,
  Search,
  Play,
  Pause,
  Edit,
  Trash2,
  Copy,
  Cpu,
  MessageSquare,
  Zap,
  Calendar,
  Activity,
} from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'paused' | 'offline';
  model: string;
  version: string;
  createdAt: string;
  lastActive: string;
  conversations: number;
  avgResponseTime: string;
  tags: string[];
  icon: string;
}

const mockAgents: Agent[] = [
  {
    id: '1',
    name: 'Customer Support Bot',
    description: 'Handles customer inquiries, FAQs, and routes complex issues to human agents',
    status: 'active',
    model: 'GPT-4',
    version: '2.1.0',
    createdAt: '2024-01-10',
    lastActive: '2 min ago',
    conversations: 15420,
    avgResponseTime: '1.2s',
    tags: ['Support', 'Customer Service'],
    icon: 'MessageSquare',
  },
  {
    id: '2',
    name: 'Code Assistant Pro',
    description: 'Helps with code review, debugging, and generating code snippets',
    status: 'active',
    model: 'Claude 3',
    version: '1.5.2',
    createdAt: '2024-01-15',
    lastActive: '5 min ago',
    conversations: 8930,
    avgResponseTime: '2.1s',
    tags: ['Development', 'Coding'],
    icon: 'Code',
  },
  {
    id: '3',
    name: 'Data Analyst',
    description: 'Analyzes data, creates visualizations, and generates insights',
    status: 'paused',
    model: 'GPT-4',
    version: '1.0.0',
    createdAt: '2024-01-20',
    lastActive: '2 days ago',
    conversations: 3200,
    avgResponseTime: '3.5s',
    tags: ['Analytics', 'Data'],
    icon: 'TrendingUp',
  },
  {
    id: '4',
    name: 'Content Writer',
    description: 'Creates blog posts, social media content, and marketing copy',
    status: 'offline',
    model: 'GPT-3.5',
    version: '1.2.0',
    createdAt: '2024-02-01',
    lastActive: '1 week ago',
    conversations: 5600,
    avgResponseTime: '1.8s',
    tags: ['Content', 'Marketing'],
    icon: 'FileText',
  },
];

const statsData = [
  { label: 'Total Agents', value: '12', icon: Bot, change: '+2 this month' },
  { label: 'Active Now', value: '8', icon: Activity, change: '67% active' },
  { label: 'Total Conversations', value: '33.2k', icon: MessageSquare, change: '+12% vs last month' },
  { label: 'Avg Response Time', value: '1.8s', icon: Zap, change: '20% faster' },
];

import { Code, FileText, TrendingUp } from 'lucide-react';

export default function MyAgents() {
  const [agents, setAgents] = useState<Agent[]>(mockAgents);
  const [filteredAgents, setFilteredAgents] = useState<Agent[]>(mockAgents);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    model: 'GPT-4',
  });

  const token = localStorage.getItem('token');
  const isAuthenticated = !!token;

  useEffect(() => {
    let result = [...agents];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (agent) =>
          agent.name.toLowerCase().includes(query) ||
          agent.description.toLowerCase().includes(query) ||
          agent.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    if (selectedStatus !== 'all') {
      result = result.filter((agent) => agent.status === selectedStatus);
    }

    setFilteredAgents(result);
  }, [agents, searchQuery, selectedStatus]);

  const handleToggleStatus = (agentId: string) => {
    setAgents((prev) =>
      prev.map((agent) => {
        if (agent.id === agentId) {
          const newStatus = agent.status === 'active' ? 'paused' : 'active';
          return { ...agent, status: newStatus };
        }
        return agent;
      })
    );
  };

  const handleDeleteAgent = (agentId: string) => {
    if (confirm('Are you sure you want to delete this agent?')) {
      setAgents((prev) => prev.filter((agent) => agent.id !== agentId));
    }
  };

  const handleDuplicateAgent = (agent: Agent) => {
    const duplicated: Agent = {
      ...agent,
      id: Date.now().toString(),
      name: `${agent.name} (Copy)`,
      status: 'paused',
      createdAt: new Date().toISOString().split('T')[0],
      lastActive: 'Just created',
    };
    setAgents((prev) => [duplicated, ...prev]);
  };

  const handleCreateAgent = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const newAgent: Agent = {
      id: Date.now().toString(),
      name: createForm.name,
      description: createForm.description,
      status: 'paused',
      model: createForm.model,
      version: '1.0.0',
      createdAt: new Date().toISOString().split('T')[0],
      lastActive: 'Just created',
      conversations: 0,
      avgResponseTime: 'N/A',
      tags: ['Custom'],
      icon: 'Bot',
    };
    setAgents((prev) => [newAgent, ...prev]);
    setIsCreateModalOpen(false);
    setCreateForm({ name: '', description: '', model: 'GPT-4' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'paused':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'offline':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'paused':
        return 'bg-amber-500';
      case 'offline':
        return 'bg-slate-400';
      default:
        return 'bg-slate-400';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">My Agents</h1>
            <p className="mt-1 text-slate-600">Manage and customize your AI agents</p>
          </div>
          {isAuthenticated && (
            <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Agent
            </Button>
          )}
        </div>

        {/* Stats Grid */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statsData.map((stat) => (
            <Card key={stat.label} className="border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">{stat.label}</p>
                    <p className="mt-1 text-2xl font-bold text-slate-900">{stat.value}</p>
                    <p className="mt-1 text-xs text-slate-400">{stat.change}</p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
                    <stat.icon className="h-5 w-5 text-indigo-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="mb-6 border-slate-200">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search agents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                {['all', 'active', 'paused', 'offline'].map((status) => (
                  <Button
                    key={status}
                    variant={selectedStatus === status ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedStatus(status)}
                    className="capitalize"
                  >
                    {status}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Agents Grid */}
        {filteredAgents.length === 0 ? (
          <Card className="border-dashed border-2">
            <CardContent className="py-12 text-center">
              <Bot className="mx-auto mb-4 h-12 w-12 text-slate-300" />
              <h3 className="mb-2 text-lg font-medium text-slate-900">
                {searchQuery ? 'No agents found' : 'No agents yet'}
              </h3>
              <p className="mb-4 text-slate-500">
                {searchQuery
                  ? 'Try adjusting your search'
                  : 'Create your first AI agent to get started'}
              </p>
              {!searchQuery && isAuthenticated && (
                <Button onClick={() => setIsCreateModalOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Agent
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredAgents.map((agent) => (
              <Card
                key={agent.id}
                className="group border-slate-200 transition-all duration-300 hover:shadow-lg"
              >
                <CardHeader className="pb-3">
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white">
                        <Bot className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base">{agent.name}</CardTitle>
                          <div
                            className={`h-2 w-2 rounded-full ${getStatusDot(agent.status)}`}
                          />
                        </div>
                        <p className="text-xs text-slate-500">v{agent.version}</p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={getStatusColor(agent.status)}
                    >
                      {agent.status}
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {agent.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="pb-3">
                  <div className="mb-4 flex flex-wrap gap-2">
                    {agent.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Cpu className="h-4 w-4 text-slate-400" />
                      <span>{agent.model}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <MessageSquare className="h-4 w-4 text-slate-400" />
                      <span>{agent.conversations.toLocaleString()} chats</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      <span>{agent.createdAt}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Zap className="h-4 w-4 text-slate-400" />
                      <span>{agent.avgResponseTime}</span>
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                    Last active: {agent.lastActive}
                  </div>
                </CardContent>

                <CardFooter className="flex gap-2 pt-0">
                  <Button
                    variant={agent.status === 'active' ? 'outline' : 'default'}
                    size="sm"
                    className="flex-1"
                    onClick={() => handleToggleStatus(agent.id)}
                  >
                    {agent.status === 'active' ? (
                      <>
                        <Pause className="mr-1 h-3 w-3" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="mr-1 h-3 w-3" />
                        Activate
                      </>
                    )}
                  </Button>
                  <Button variant="outline" size="icon" className="h-8 w-8">
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDuplicateAgent(agent)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => handleDeleteAgent(agent.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}

        {/* Create Agent Modal */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Card className="w-full max-w-lg">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Plus className="h-5 w-5 text-violet-600" />
                  <CardTitle>Create New Agent</CardTitle>
                </div>
                <CardDescription>
                  Set up a new AI agent to automate tasks and assist users
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateAgent} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Agent Name</Label>
                    <Input
                      id="name"
                      value={createForm.name}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, name: e.target.value })
                      }
                      placeholder="e.g., Customer Support Bot"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <textarea
                      id="description"
                      value={createForm.description}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, description: e.target.value })
                      }
                      placeholder="Describe what this agent does..."
                      rows={3}
                      className="flex w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model">AI Model</Label>
                    <select
                      id="model"
                      value={createForm.model}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, model: e.target.value })
                      }
                      className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950"
                    >
                      <option value="GPT-4">GPT-4 (Best for complex tasks)</option>
                      <option value="Claude 3">Claude 3 (Great for analysis)</option>
                      <option value="GPT-3.5">GPT-3.5 (Fast responses)</option>
                    </select>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setIsCreateModalOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1">
                      Create Agent
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
