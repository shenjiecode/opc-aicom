import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Brain,
  Zap,
  DollarSign,
  Activity,
  CheckCircle,
  Server,
  Plus,
  Search,
  RefreshCw,
  Edit,
  Trash2,
  Play,
  Key,
  BarChart3,
  Settings,
  Cpu,
  Clock,
  X,
  Download,
  Users,
  TrendingUp,
  AlertCircle,
  Globe,
  Lock,
  ExternalLink,
} from "lucide-react";

// ============================================
// Types
// ============================================
interface AIChannel {
  id: number;
  name: string;
  provider: "openai" | "deepseek" | "anthropic" | "custom";
  base_url: string;
  api_key: string;
  models: string[];
  weight: number;
  priority: number;
  status: "active" | "disabled" | "error";
  failed_count: number;
  created_at: string;
}

interface AIModel {
  id: number;
  name: string;
  provider: string;
  channel_id: number;
  input_price: number;
  output_price: number;
  max_tokens: number;
  status: "active" | "disabled";
}

interface AIVirtualKey {
  id: number;
  key: string;
  user_id: number;
  user_name?: string;
  quota: number;
  used_quota: number;
  rate_limit: number;
  expires_at?: string;
  status: "active" | "revoked" | "expired";
  created_at: string;
}

interface UsageStats {
  today_requests: number;
  today_tokens: number;
  today_cost: number;
  avg_latency_ms: number;
  success_rate: number;
  active_channels: number;
}

interface ModelUsage {
  model: string;
  tokens: number;
  requests: number;
  cost: number;
}

interface UserUsage {
  user_id: number;
  user_name: string;
  tokens: number;
  requests: number;
  cost: number;
}

// ============================================
// Mock Data
// ============================================
const mockChannels: AIChannel[] = [
  {
    id: 1,
    name: "OpenAI 主渠道",
    provider: "openai",
    base_url: "https://api.openai.com",
    api_key: "sk-abc123***",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"],
    weight: 100,
    priority: 1,
    status: "active",
    failed_count: 0,
    created_at: "2024-01-15T10:00:00Z",
  },
  {
    id: 2,
    name: "DeepSeek",
    provider: "deepseek",
    base_url: "https://api.deepseek.com",
    api_key: "sk-deepseek***",
    models: ["deepseek-chat", "deepseek-coder"],
    weight: 50,
    priority: 2,
    status: "active",
    failed_count: 2,
    created_at: "2024-02-20T08:30:00Z",
  },
  {
    id: 3,
    name: "Anthropic Claude",
    provider: "anthropic",
    base_url: "https://api.anthropic.com",
    api_key: "sk-ant***",
    models: ["claude-3-5-sonnet", "claude-3-opus"],
    weight: 30,
    priority: 3,
    status: "active",
    failed_count: 0,
    created_at: "2024-03-10T14:20:00Z",
  },
  {
    id: 4,
    name: "备份渠道",
    provider: "openai",
    base_url: "https://api2.openai.com",
    api_key: "sk-backup***",
    models: ["gpt-3.5-turbo"],
    weight: 10,
    priority: 10,
    status: "disabled",
    failed_count: 5,
    created_at: "2024-04-01T09:00:00Z",
  },
];

const mockModels: AIModel[] = [
  {
    id: 1,
    name: "gpt-4o",
    provider: "openai",
    channel_id: 1,
    input_price: 0.005,
    output_price: 0.015,
    max_tokens: 128000,
    status: "active",
  },
  {
    id: 2,
    name: "gpt-4o-mini",
    provider: "openai",
    channel_id: 1,
    input_price: 0.00015,
    output_price: 0.0006,
    max_tokens: 128000,
    status: "active",
  },
  {
    id: 3,
    name: "deepseek-chat",
    provider: "deepseek",
    channel_id: 2,
    input_price: 0.0001,
    output_price: 0.0002,
    max_tokens: 64000,
    status: "active",
  },
  {
    id: 4,
    name: "claude-3-5-sonnet",
    provider: "anthropic",
    channel_id: 3,
    input_price: 0.003,
    output_price: 0.015,
    max_tokens: 200000,
    status: "active",
  },
  {
    id: 5,
    name: "gpt-3.5-turbo",
    provider: "openai",
    channel_id: 1,
    input_price: 0.0005,
    output_price: 0.0015,
    max_tokens: 16384,
    status: "active",
  },
];

const mockKeys: AIVirtualKey[] = [
  {
    id: 1,
    key: "sk-opc-a1b2c3d4e5f6",
    user_id: 25,
    user_name: "张三",
    quota: 1000000,
    used_quota: 234567,
    rate_limit: 60,
    expires_at: undefined,
    status: "active",
    created_at: "2024-01-20T10:00:00Z",
  },
  {
    id: 2,
    key: "sk-opc-x9y8z7w6v5u4",
    user_id: 42,
    user_name: "李四",
    quota: 500000,
    used_quota: 498000,
    rate_limit: 30,
    expires_at: "2025-06-30T00:00:00Z",
    status: "active",
    created_at: "2024-03-15T08:30:00Z",
  },
  {
    id: 3,
    key: "sk-opc-m3n4o5p6q7r8",
    user_id: 18,
    user_name: "王五",
    quota: 2000000,
    used_quota: 0,
    rate_limit: 120,
    expires_at: "2024-12-31T00:00:00Z",
    status: "revoked",
    created_at: "2024-02-10T14:20:00Z",
  },
  {
    id: 4,
    key: "sk-opc-s9t0u1v2w3x4",
    user_id: 67,
    user_name: "赵六",
    quota: 100000,
    used_quota: 100000,
    rate_limit: 10,
    expires_at: "2024-05-01T00:00:00Z",
    status: "expired",
    created_at: "2024-04-01T09:00:00Z",
  },
];

const mockStats: UsageStats = {
  today_requests: 1234,
  today_tokens: 56789,
  today_cost: 12.34,
  avg_latency_ms: 856,
  success_rate: 99.2,
  active_channels: 3,
};

const mockModelUsage: ModelUsage[] = [
  { model: "gpt-4o", tokens: 23456, requests: 456, cost: 8.52 },
  { model: "deepseek-chat", tokens: 15678, requests: 523, cost: 2.35 },
  { model: "claude-3-5-sonnet", tokens: 8765, requests: 167, cost: 3.15 },
  { model: "gpt-4o-mini", tokens: 5432, requests: 89, cost: 0.32 },
];

const mockUserUsage: UserUsage[] = [
  { user_id: 25, user_name: "张三", tokens: 45678, requests: 892, cost: 8.92 },
  { user_id: 42, user_name: "李四", tokens: 34567, requests: 634, cost: 4.56 },
  { user_id: 18, user_name: "王五", tokens: 23456, requests: 423, cost: 3.21 },
  { user_id: 67, user_name: "赵六", tokens: 12345, requests: 287, cost: 1.89 },
  { user_id: 91, user_name: "钱七", tokens: 8765, requests: 156, cost: 1.23 },
];

const hourlyData = [
  { hour: "00:00", requests: 45 },
  { hour: "02:00", requests: 23 },
  { hour: "04:00", requests: 12 },
  { hour: "06:00", requests: 34 },
  { hour: "08:00", requests: 89 },
  { hour: "10:00", requests: 156 },
  { hour: "12:00", requests: 234 },
  { hour: "14:00", requests: 189 },
  { hour: "16:00", requests: 167 },
  { hour: "18:00", requests: 145 },
  { hour: "20:00", requests: 123 },
  { hour: "22:00", requests: 67 },
];

// ============================================
// Helper Configs
// ============================================
const PROVIDER_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  openai: { label: "OpenAI", color: "text-emerald-700", bg: "bg-emerald-100" },
  deepseek: { label: "DeepSeek", color: "text-blue-700", bg: "bg-blue-100" },
  anthropic: { label: "Anthropic", color: "text-amber-700", bg: "bg-amber-100" },
  custom: { label: "自定义", color: "text-slate-700", bg: "bg-slate-100" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle }> = {
  active: { label: "正常", color: "text-emerald-700", bg: "bg-emerald-100", icon: CheckCircle },
  disabled: { label: "已禁用", color: "text-slate-700", bg: "bg-slate-100", icon: AlertCircle },
  error: { label: "错误", color: "text-red-700", bg: "bg-red-100", icon: AlertCircle },
  revoked: { label: "已撤销", color: "text-red-700", bg: "bg-red-100", icon: Lock },
  expired: { label: "已过期", color: "text-amber-700", bg: "bg-amber-100", icon: Clock },
};

const TABS = [
  { id: "channels", label: "渠道管理", icon: Server },
  { id: "models", label: "模型配置", icon: Cpu },
  { id: "keys", label: "API Key", icon: Key },
  { id: "usage", label: "使用统计", icon: BarChart3 },
];

// ============================================
// Main Component
// ============================================
export default function AIModelGateway() {
  const [activeTab, setActiveTab] = useState("channels");
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Dialog states
  const [channelDialogOpen, setChannelDialogOpen] = useState(false);
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<AIChannel | null>(null);
  const [editingModel, setEditingModel] = useState<AIModel | null>(null);

  // Form states
  const [channelForm, setChannelForm] = useState<Partial<AIChannel>>({
    name: "",
    provider: "openai",
    base_url: "",
    api_key: "",
    models: [],
    weight: 100,
    priority: 1,
    status: "active",
  });
  const [modelForm, setModelForm] = useState<Partial<AIModel>>({
    name: "",
    provider: "openai",
    channel_id: 0,
    input_price: 0,
    output_price: 0,
    max_tokens: 4096,
    status: "active",
  });
  const [keyForm, setKeyForm] = useState<Partial<AIVirtualKey>>({
    user_id: 0,
    quota: 100000,
    rate_limit: 60,
    status: "active",
  });

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "永久";
    return new Date(dateString).toLocaleDateString("zh-CN");
  };

  const formatNumber = (num: number) => num.toLocaleString();

  const formatPrice = (price: number) => `$${price.toFixed(4)}`;

  const maskKey = (key: string) => {
    if (key.length < 12) return key;
    return `${key.slice(0, 8)}****${key.slice(-4)}`;
  };

  const openCreateChannelDialog = () => {
    setEditingChannel(null);
    setChannelForm({
      name: "",
      provider: "openai",
      base_url: "",
      api_key: "",
      models: [],
      weight: 100,
      priority: 1,
      status: "active",
    });
    setChannelDialogOpen(true);
  };

  const openEditChannelDialog = (channel: AIChannel) => {
    setEditingChannel(channel);
    setChannelForm({ ...channel });
    setChannelDialogOpen(true);
  };

  const openCreateModelDialog = () => {
    setEditingModel(null);
    setModelForm({
      name: "",
      provider: "openai",
      channel_id: 0,
      input_price: 0,
      output_price: 0,
      max_tokens: 4096,
      status: "active",
    });
    setModelDialogOpen(true);
  };

  const openEditModelDialog = (model: AIModel) => {
    setEditingModel(model);
    setModelForm({ ...model });
    setModelDialogOpen(true);
  };

  const openCreateKeyDialog = () => {
    setKeyForm({
      user_id: 0,
      quota: 100000,
      rate_limit: 60,
      status: "active",
    });
    setKeyDialogOpen(true);
  };

  // ============================================
  // Stats Cards
  // ============================================
  const statCards = [
    {
      title: "今日调用",
      value: formatNumber(mockStats.today_requests),
      icon: Zap,
      textColor: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Token消耗",
      value: formatNumber(mockStats.today_tokens),
      icon: Activity,
      textColor: "text-indigo-600",
      bgColor: "bg-indigo-50",
    },
    {
      title: "今日费用",
      value: `$${mockStats.today_cost.toFixed(2)}`,
      icon: DollarSign,
      textColor: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      title: "平均延迟",
      value: `${mockStats.avg_latency_ms}ms`,
      icon: Clock,
      textColor: "text-amber-600",
      bgColor: "bg-amber-50",
    },
    {
      title: "成功率",
      value: `${mockStats.success_rate}%`,
      icon: CheckCircle,
      textColor: "text-rose-600",
      bgColor: "bg-rose-50",
    },
    {
      title: "活跃渠道",
      value: mockStats.active_channels.toString(),
      icon: Server,
      textColor: "text-purple-600",
      bgColor: "bg-purple-50",
    },
  ];

  // ============================================
  // Tab Content: Channels
  // ============================================
  const ChannelsTab = () => {
    const filteredChannels = mockChannels.filter(
      (c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.provider.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="搜索渠道..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={openCreateChannelDialog}>
            <Plus className="w-4 h-4 mr-2" />
            新增渠道
          </Button>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">ID</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">名称</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Provider</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Base URL</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">模型</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">权重</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">状态</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredChannels.map((channel) => {
                const provider = PROVIDER_CONFIG[channel.provider];
                const status = STATUS_CONFIG[channel.status];
                const StatusIcon = status.icon;
                return (
                  <tr key={channel.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 text-sm text-slate-600">{channel.id}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                          <Globe className="w-4 h-4 text-slate-600" />
                        </div>
                        <span className="font-medium text-slate-900">{channel.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={cn(provider.bg, provider.color)}>
                        {provider.label}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <code className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">
                        {channel.base_url.replace("https://", "")}
                      </code>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {channel.models.slice(0, 2).map((model) => (
                          <Badge key={model} variant="secondary" className="text-xs">
                            {model}
                          </Badge>
                        ))}
                        {channel.models.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{channel.models.length - 2}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm font-medium text-slate-700">{channel.weight}</span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={cn(status.bg, status.color)}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {status.label}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-slate-600 hover:text-slate-900"
                          onClick={() => openEditChannelDialog(channel)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 text-emerald-600">
                          <Play className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ============================================
  // Tab Content: Models
  // ============================================
  const ModelsTab = () => {
    const filteredModels = mockModels.filter(
      (m) =>
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.provider.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="搜索模型..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button onClick={openCreateModelDialog}>
            <Plus className="w-4 h-4 mr-2" />
            新增模型
          </Button>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">模型名称</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Provider</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">输入价格</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">输出价格</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">最大Token</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">状态</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredModels.map((model) => {
                const provider = PROVIDER_CONFIG[model.provider] || PROVIDER_CONFIG.custom;
                const status = STATUS_CONFIG[model.status];
                const StatusIcon = status.icon;
                return (
                  <tr key={model.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                          <Brain className="w-4 h-4 text-slate-600" />
                        </div>
                        <span className="font-medium text-slate-900">{model.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={cn(provider.bg, provider.color)}>{provider.label}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-slate-700">{formatPrice(model.input_price)}/1K</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-slate-700">{formatPrice(model.output_price)}/1K</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-slate-700">{formatNumber(model.max_tokens)}</span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={cn(status.bg, status.color)}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {status.label}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-slate-600 hover:text-slate-900"
                          onClick={() => openEditModelDialog(model)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ============================================
  // Tab Content: Keys
  // ============================================
  const KeysTab = () => {
    const filteredKeys = mockKeys.filter(
      (k) =>
        k.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
        k.user_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="搜索Key或用户..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button onClick={openCreateKeyDialog}>
            <Plus className="w-4 h-4 mr-2" />
            新增Key
          </Button>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Key</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">用户</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">配额/已用</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">速率限制</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">过期时间</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">状态</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredKeys.map((key) => {
                const status = STATUS_CONFIG[key.status];
                const StatusIcon = status.icon;
                const usagePercent = Math.round((key.used_quota / key.quota) * 100);
                return (
                  <tr key={key.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                          <Key className="w-4 h-4 text-amber-600" />
                        </div>
                        <code className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">
                          {maskKey(key.key)}
                        </code>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-600">
                          {key.user_name?.[0] || "?"}
                        </div>
                        <span className="text-sm text-slate-700">{key.user_name || `用户${key.user_id}`}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">{formatNumber(key.used_quota)}</span>
                          <span className="text-slate-400">/ {formatNumber(key.quota)}</span>
                        </div>
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              usagePercent > 90 ? "bg-red-500" : usagePercent > 70 ? "bg-amber-500" : "bg-emerald-500"
                            )}
                            style={{ width: `${Math.min(usagePercent, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-slate-700">{key.rate_limit}/min</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-slate-600">{formatDate(key.expires_at)}</span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={cn(status.bg, status.color)}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {status.label}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-8">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                        {key.status === "active" && (
                          <Button variant="ghost" size="sm" className="h-8 text-red-600">
                            <Lock className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ============================================
  // Tab Content: Usage Statistics
  // ============================================
  const UsageTab = () => {
    const maxRequests = Math.max(...hourlyData.map((d) => d.requests));

    return (
      <div className="space-y-6">
        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Token by Model Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-indigo-600" />
                模型Token消耗分布
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockModelUsage.map((item) => {
                  const percent = (item.tokens / mockStats.today_tokens) * 100;
                  return (
                    <div key={item.model} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-700">{item.model}</span>
                        <span className="text-slate-500">{item.tokens.toLocaleString()} tokens</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-500 rounded-full"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 w-10 text-right">{percent.toFixed(1)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Cost by User Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-600" />
                用户消费排行 TOP5
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockUserUsage.slice(0, 5).map((user, index) => {
                  const maxCost = mockUserUsage[0].cost;
                  const percent = (user.cost / maxCost) * 100;
                  return (
                    <div key={user.user_id} className="flex items-center gap-3">
                      <span className="w-5 h-5 flex items-center justify-center text-xs font-medium text-slate-500">
                        {index + 1}
                      </span>
                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-medium text-emerald-700">
                        {user.user_name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-slate-700 truncate">{user.user_name}</span>
                          <span className="text-slate-500">${user.cost.toFixed(2)}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Hourly Requests Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                每小时请求量
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-1 h-32">
                {hourlyData.map((data) => {
                  const height = (data.requests / maxRequests) * 100;
                  return (
                    <div key={data.hour} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full bg-blue-100 rounded-t hover:bg-blue-200 transition-colors"
                        style={{ height: `${height}%` }}
                        title={`${data.hour}: ${data.requests} 请求`}
                      />
                      <span className="text-[10px] text-slate-500">{data.hour.slice(0, 2)}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Summary Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="w-4 h-4 text-purple-600" />
                今日概览
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-600">总请求数</span>
                <span className="font-medium text-slate-900">{formatNumber(mockStats.today_requests)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-600">总Token</span>
                <span className="font-medium text-slate-900">{formatNumber(mockStats.today_tokens)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-600">总费用</span>
                <span className="font-medium text-emerald-600">${mockStats.today_cost.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-600">成功率</span>
                <span className="font-medium text-slate-900">{mockStats.success_rate}%</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-600">平均延迟</span>
                <span className="font-medium text-slate-900">{mockStats.avg_latency_ms}ms</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Channel Success Rate */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              渠道成功率
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {mockChannels
                .filter((c) => c.status === "active")
                .map((channel) => (
                  <div key={channel.id} className="p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full",
                          channel.failed_count === 0 ? "bg-emerald-500" : "bg-amber-500"
                        )}
                      />
                      <span className="text-sm font-medium text-slate-700">{channel.name}</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-900">
                      {((1 - channel.failed_count / 100) * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      失败: {channel.failed_count} 次
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* Export Button */}
        <div className="flex justify-end">
          <Button variant="outline">
            <Download className="w-4 h-4 mr-2" />
            导出CSV
          </Button>
        </div>
      </div>
    );
  };

  // ============================================
  // Dialogs
  // ============================================
  const ChannelDialog = () => {
    if (!channelDialogOpen) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <Card className="w-full max-w-lg bg-white">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{editingChannel ? "编辑渠道" : "新增渠道"}</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setChannelDialogOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>名称</Label>
              <Input
                placeholder="渠道名称"
                value={channelForm.name}
                onChange={(e) => setChannelForm({ ...channelForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Provider</Label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm"
                  value={channelForm.provider}
                  onChange={(e) =>
                    setChannelForm({
                      ...channelForm,
                      provider: e.target.value as AIChannel["provider"],
                    })
                  }
                >
                  <option value="openai">OpenAI</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="custom">自定义</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>权重</Label>
                <Input
                  type="number"
                  value={channelForm.weight}
                  onChange={(e) => setChannelForm({ ...channelForm, weight: parseInt(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Base URL</Label>
              <Input
                placeholder="https://api.example.com"
                value={channelForm.base_url}
                onChange={(e) => setChannelForm({ ...channelForm, base_url: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                type="password"
                placeholder="sk-..."
                value={channelForm.api_key}
                onChange={(e) => setChannelForm({ ...channelForm, api_key: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>支持模型（逗号分隔）</Label>
              <Input
                placeholder="gpt-4o, gpt-4o-mini"
                value={channelForm.models?.join(", ")}
                onChange={(e) =>
                  setChannelForm({
                    ...channelForm,
                    models: e.target.value.split(",").map((s) => s.trim()),
                  })
                }
              />
            </div>
          </CardContent>
          <div className="border-t p-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setChannelDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={() => setChannelDialogOpen(false)}>保存</Button>
          </div>
        </Card>
      </div>
    );
  };

  const ModelDialog = () => {
    if (!modelDialogOpen) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <Card className="w-full max-w-lg bg-white">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{editingModel ? "编辑模型" : "新增模型"}</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setModelDialogOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>模型名称</Label>
              <Input
                placeholder="gpt-4o"
                value={modelForm.name}
                onChange={(e) => setModelForm({ ...modelForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Provider</Label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm"
                  value={modelForm.provider}
                  onChange={(e) => setModelForm({ ...modelForm, provider: e.target.value })}
                >
                  <option value="openai">OpenAI</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="anthropic">Anthropic</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>最大Token</Label>
                <Input
                  type="number"
                  value={modelForm.max_tokens}
                  onChange={(e) => setModelForm({ ...modelForm, max_tokens: parseInt(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>输入价格/1K</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={modelForm.input_price}
                  onChange={(e) => setModelForm({ ...modelForm, input_price: parseFloat(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>输出价格/1K</Label>
                <Input
                  type="number"
                  step="0.0001"
                  value={modelForm.output_price}
                  onChange={(e) => setModelForm({ ...modelForm, output_price: parseFloat(e.target.value) })}
                />
              </div>
            </div>
          </CardContent>
          <div className="border-t p-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setModelDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={() => setModelDialogOpen(false)}>保存</Button>
          </div>
        </Card>
      </div>
    );
  };

  const KeyDialog = () => {
    if (!keyDialogOpen) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <Card className="w-full max-w-lg bg-white">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">新增API Key</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setKeyDialogOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>用户ID</Label>
              <Input
                type="number"
                placeholder="用户ID"
                value={keyForm.user_id}
                onChange={(e) => setKeyForm({ ...keyForm, user_id: parseInt(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Token配额</Label>
              <Input
                type="number"
                placeholder="100000"
                value={keyForm.quota}
                onChange={(e) => setKeyForm({ ...keyForm, quota: parseInt(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>速率限制 (请求/分钟)</Label>
              <Input
                type="number"
                placeholder="60"
                value={keyForm.rate_limit}
                onChange={(e) => setKeyForm({ ...keyForm, rate_limit: parseInt(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>过期时间（可选）</Label>
              <Input
                type="datetime-local"
                onChange={(e) => setKeyForm({ ...keyForm, expires_at: e.target.value })}
              />
            </div>
          </CardContent>
          <div className="border-t p-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setKeyDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={() => setKeyDialogOpen(false)}>创建</Button>
          </div>
        </Card>
      </div>
    );
  };

  // ============================================
  // Main Render
  // ============================================
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">AI 模型网关</h2>
          <p className="text-slate-500 mt-1">统一调用外部 AI API，管理渠道、模型和密钥</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
            刷新
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", stat.bgColor)}>
                    <Icon className={cn("w-5 h-5", stat.textColor)} />
                  </div>
                </div>
                <div className="mt-3">
                  <p className="text-xs text-slate-500">{stat.title}</p>
                  <p className={cn("text-xl font-bold", stat.textColor)}>{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="space-y-4">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-fit">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                  activeTab === tab.id
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {activeTab === "channels" && <ChannelsTab />}
          {activeTab === "models" && <ModelsTab />}
          {activeTab === "keys" && <KeysTab />}
          {activeTab === "usage" && <UsageTab />}
        </div>
      </div>

      {/* Dialogs */}
      <ChannelDialog />
      <ModelDialog />
      <KeyDialog />
    </div>
  );
}
