import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Brain,
  Zap,
  Activity,
  CheckCircle,
  Server,
  Plus,
  Search,
  RefreshCw,
  Edit,
  Trash2,
  Key,
  BarChart3,
  Cpu,
  Clock,
  X,
  AlertCircle,
  Globe,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Download,
} from "lucide-react";

const AIGATEWAY_BASE = "/gateway-api";

interface AIChannel {
  id: number;
  name: string;
  provider: string;
  base_url: string;
  api_key: string;
  models: string;
  weight: number;
  priority: number;
  status: string;
  failed_count: number;
  created_at: string;
}

interface AIModel {
  id: number;
  name: string;
  provider: string;
  channel_id: number;
  input_price: string;
  output_price: string;
  max_tokens: number;
  status: string;
  created_at: string;
}

interface AIVirtualKey {
  id: number;
  key: string;
  user_id: number;
  name: string;
  quota: number;
  used_quota: number;
  rate_limit: number;
  expires_at?: string;
  status: string;
  created_at: string;
}

interface UsageSummary {
  total_tokens: number;
  total_cost: string;
  request_count: number;
  success_count: number;
  failed_count: number;
}

async function gatewayFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${AIGATEWAY_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const data = await response.json();
  if (data.code !== 0 && data.code !== undefined) {
    throw new Error(data.message || "请求失败");
  }
  return data.data;
}

const PROVIDER_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  alibaba: { label: "阿里百炼", color: "text-orange-700", bg: "bg-orange-100" },
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

export default function AIModelGateway() {
  const [activeTab, setActiveTab] = useState("channels");
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [channels, setChannels] = useState<AIChannel[]>([]);
  const [models, setModels] = useState<AIModel[]>([]);
  const [keys, setKeys] = useState<AIVirtualKey[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);

  const [channelDialogOpen, setChannelDialogOpen] = useState(false);
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<AIChannel | null>(null);
  const [editingModel, setEditingModel] = useState<AIModel | null>(null);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const [channelForm, setChannelForm] = useState({
    name: "",
    provider: "alibaba",
    base_url: "",
    api_key: "",
    models: "",
    weight: 100,
    priority: 1,
  });
  const [modelForm, setModelForm] = useState({
    name: "",
    provider: "alibaba",
    channel_id: 0,
    input_price: "0.002",
    output_price: "0.006",
    max_tokens: 32768,
  });
  const [keyForm, setKeyForm] = useState({
    user_id: 0,
    name: "Default Key",
  });

  const loadData = useCallback(async () => {
    try {
      const [ch, mo, ke, us] = await Promise.allSettled([
        gatewayFetch<AIChannel[]>("/admin/channels"),
        gatewayFetch<AIModel[]>("/admin/models"),
        gatewayFetch<AIVirtualKey[]>("/admin/keys"),
        gatewayFetch<UsageSummary>("/admin/usage"),
      ]);
      if (ch.status === "fulfilled") setChannels(ch.value || []);
      if (mo.status === "fulfilled") setModels(mo.value || []);
      if (ke.status === "fulfilled") setKeys(ke.value || []);
      if (us.status === "fulfilled") setUsage(us.value);
    } catch {}
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData().finally(() => setIsRefreshing(false));
  };

  const formatNumber = (num: number) => num.toLocaleString();

  const formatPrice = (price: string | number) => {
    const n = typeof price === "string" ? parseFloat(price) : price;
    return `$${n.toFixed(4)}`;
  };

  const maskKey = (key: string) => {
    if (!key || key.length < 12) return key;
    return `${key.slice(0, 8)}****${key.slice(-4)}`;
  };

  const openCreateChannelDialog = () => {
    setEditingChannel(null);
    setChannelForm({ name: "", provider: "alibaba", base_url: "", api_key: "", models: "", weight: 100, priority: 1 });
    setApiKeyVisible(false);
    setChannelDialogOpen(true);
  };

  const openEditChannelDialog = (channel: AIChannel) => {
    setEditingChannel(channel);
    setChannelForm({
      name: channel.name,
      provider: channel.provider,
      base_url: channel.base_url,
      api_key: channel.api_key || "",
      models: channel.models || "",
      weight: channel.weight,
      priority: channel.priority,
    });
    setApiKeyVisible(false);
    setChannelDialogOpen(true);
  };

  const handleSaveChannel = async () => {
    setIsSaving(true);
    try {
      if (editingChannel) {
        await gatewayFetch(`/admin/channels/${editingChannel.id}`, {
          method: "PUT",
          body: JSON.stringify(channelForm),
        });
      } else {
        await gatewayFetch("/admin/channels", {
          method: "POST",
          body: JSON.stringify(channelForm),
        });
      }
      setChannelDialogOpen(false);
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteChannel = async (id: number) => {
    if (!confirm("确定删除此渠道？")) return;
    try {
      await gatewayFetch(`/admin/channels/${id}`, { method: "DELETE" });
      loadData();
    } catch {}
  };

  const openCreateModelDialog = () => {
    setEditingModel(null);
    const defaultChannelId = channels.length > 0 ? channels[0].id : 0;
    setModelForm({ name: "", provider: "alibaba", channel_id: defaultChannelId, input_price: "0.002", output_price: "0.006", max_tokens: 32768 });
    setModelDialogOpen(true);
  };

  const openEditModelDialog = (m: AIModel) => {
    setEditingModel(m);
    setModelForm({
      name: m.name,
      provider: m.provider,
      channel_id: m.channel_id,
      input_price: m.input_price,
      output_price: m.output_price,
      max_tokens: m.max_tokens,
    });
    setModelDialogOpen(true);
  };

  const handleSaveModel = async () => {
    setIsSaving(true);
    try {
      if (editingModel) {
        await gatewayFetch(`/admin/models/${editingModel.id}`, {
          method: "PUT",
          body: JSON.stringify(modelForm),
        });
      } else {
        await gatewayFetch("/admin/models", {
          method: "POST",
          body: JSON.stringify(modelForm),
        });
      }
      setModelDialogOpen(false);
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteModel = async (id: number) => {
    if (!confirm("确定删除此模型？")) return;
    try {
      await gatewayFetch(`/admin/models/${id}`, { method: "DELETE" });
      loadData();
    } catch {}
  };

  const handleSyncBailianModels = async () => {
    setIsSyncing(true);
    try {
      const result = await gatewayFetch<{ synced: number; total: number }>("/admin/models/sync-bailian", { method: "POST" });
      alert(`同步完成：新增 ${result.synced} 个模型，共 ${result.total} 个`);
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "同步失败");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreateKey = async () => {
    setIsSaving(true);
    try {
      await gatewayFetch("/admin/keys", {
        method: "POST",
        body: JSON.stringify(keyForm),
      });
      setKeyDialogOpen(false);
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "创建失败");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevokeKey = async (id: number) => {
    if (!confirm("确定撤销此 Key？")) return;
    try {
      await gatewayFetch(`/admin/keys/${id}`, { method: "DELETE" });
      loadData();
    } catch {}
  };

  const statCards = [
    { title: "活跃渠道", value: channels.filter((c) => c.status === "active").length.toString(), icon: Server, textColor: "text-purple-600", bgColor: "bg-purple-50" },
    { title: "可用模型", value: models.filter((m) => m.status === "active").length.toString(), icon: Brain, textColor: "text-indigo-600", bgColor: "bg-indigo-50" },
    { title: "API Key", value: keys.filter((k) => k.status === "active").length.toString(), icon: Key, textColor: "text-amber-600", bgColor: "bg-amber-50" },
    { title: "总请求", value: formatNumber(usage?.request_count || 0), icon: Zap, textColor: "text-blue-600", bgColor: "bg-blue-50" },
    { title: "Token消耗", value: formatNumber(usage?.total_tokens || 0), icon: Activity, textColor: "text-indigo-600", bgColor: "bg-indigo-50" },
    { title: "成功率", value: usage?.request_count ? `${((usage.success_count / usage.request_count) * 100).toFixed(1)}%` : "-", icon: CheckCircle, textColor: "text-rose-600", bgColor: "bg-rose-50" },
  ];

  const ChannelsTab = () => {
    const filtered = channels.filter(
      (c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.provider.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="搜索渠道..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <Button onClick={openCreateChannelDialog}><Plus className="w-4 h-4 mr-2" />新增渠道</Button>
        </div>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">ID</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">名称</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">渠道商</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Base URL</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">权重</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">状态</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-12 text-center text-slate-500">暂无渠道数据</td></tr>
              )}
              {filtered.map((channel) => {
                const provider = PROVIDER_CONFIG[channel.provider] || PROVIDER_CONFIG.custom;
                const status = STATUS_CONFIG[channel.status] || STATUS_CONFIG.disabled;
                const StatusIcon = status.icon;
                return (
                  <tr key={channel.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 text-sm text-slate-600">{channel.id}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center"><Globe className="w-4 h-4 text-slate-600" /></div>
                        <span className="font-medium text-slate-900">{channel.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4"><Badge className={cn(provider.bg, provider.color)}>{provider.label}</Badge></td>
                    <td className="py-3 px-4"><code className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">{channel.base_url.replace("https://", "")}</code></td>
                    <td className="py-3 px-4"><span className="text-sm font-medium text-slate-700">{channel.weight}</span></td>
                    <td className="py-3 px-4"><Badge className={cn(status.bg, status.color)}><StatusIcon className="w-3 h-3 mr-1" />{status.label}</Badge></td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-8 text-slate-600 hover:text-slate-900" onClick={() => openEditChannelDialog(channel)}><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" className="h-8 text-red-600" onClick={() => handleDeleteChannel(channel.id)}><Trash2 className="w-4 h-4" /></Button>
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

  const ModelsTab = () => {
    const filtered = models.filter(
      (m) => m.name.toLowerCase().includes(searchQuery.toLowerCase()) || m.provider.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="搜索模型..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleSyncBailianModels} disabled={isSyncing}>
              {isSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              同步百炼模型
            </Button>
            <Button onClick={openCreateModelDialog}><Plus className="w-4 h-4 mr-2" />新增模型</Button>
          </div>
        </div>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">模型名称</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">渠道商</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">输入价格</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">输出价格</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">最大Token</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">状态</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-12 text-center text-slate-500">暂无模型数据，点击"同步百炼模型"或"新增模型"</td></tr>
              )}
              {filtered.map((m) => {
                const provider = PROVIDER_CONFIG[m.provider] || PROVIDER_CONFIG.custom;
                const status = STATUS_CONFIG[m.status] || STATUS_CONFIG.disabled;
                const StatusIcon = status.icon;
                return (
                  <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center"><Brain className="w-4 h-4 text-slate-600" /></div>
                        <span className="font-medium text-slate-900">{m.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4"><Badge className={cn(provider.bg, provider.color)}>{provider.label}</Badge></td>
                    <td className="py-3 px-4"><span className="text-sm text-slate-700">{formatPrice(m.input_price)}/1K</span></td>
                    <td className="py-3 px-4"><span className="text-sm text-slate-700">{formatPrice(m.output_price)}/1K</span></td>
                    <td className="py-3 px-4"><span className="text-sm text-slate-700">{formatNumber(m.max_tokens)}</span></td>
                    <td className="py-3 px-4"><Badge className={cn(status.bg, status.color)}><StatusIcon className="w-3 h-3 mr-1" />{status.label}</Badge></td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" className="h-8 text-slate-600 hover:text-slate-900" onClick={() => openEditModelDialog(m)}><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="sm" className="h-8 text-red-600" onClick={() => handleDeleteModel(m.id)}><Trash2 className="w-4 h-4" /></Button>
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

  const KeysTab = () => {
    const filtered = keys.filter(
      (k) => k.key?.toLowerCase().includes(searchQuery.toLowerCase()) || k.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input placeholder="搜索Key..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <Button onClick={() => { setKeyForm({ user_id: 0, name: "Default Key" }); setKeyDialogOpen(true); }}><Plus className="w-4 h-4 mr-2" />新增Key</Button>
        </div>
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">Key</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">名称</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">配额/已用</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">速率限制</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-600">状态</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="py-12 text-center text-slate-500">暂无 API Key 数据</td></tr>
              )}
              {filtered.map((k) => {
                const status = STATUS_CONFIG[k.status] || STATUS_CONFIG.disabled;
                const StatusIcon = status.icon;
                const usagePercent = k.quota > 0 ? Math.round((k.used_quota / k.quota) * 100) : 0;
                return (
                  <tr key={k.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4"><code className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">{maskKey(k.key)}</code></td>
                    <td className="py-3 px-4"><span className="text-sm text-slate-700">{k.name}</span></td>
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">{formatNumber(k.used_quota)}</span>
                          <span className="text-slate-400">/ {formatNumber(k.quota)}</span>
                        </div>
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full", usagePercent > 90 ? "bg-red-500" : usagePercent > 70 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${Math.min(usagePercent, 100)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4"><span className="text-sm text-slate-700">{k.rate_limit}/min</span></td>
                    <td className="py-3 px-4"><Badge className={cn(status.bg, status.color)}><StatusIcon className="w-3 h-3 mr-1" />{status.label}</Badge></td>
                    <td className="py-3 px-4 text-right">
                      {k.status === "active" && (
                        <Button variant="ghost" size="sm" className="h-8 text-red-600" onClick={() => handleRevokeKey(k.id)}><Lock className="w-4 h-4 mr-1" />撤销</Button>
                      )}
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

  const UsageTab = () => {
    const modelGrouped: Record<string, { count: number; provider: string }> = {};
    models.forEach((m) => {
      const p = m.provider;
      if (!modelGrouped[p]) modelGrouped[p] = { count: 0, provider: p };
      modelGrouped[p].count++;
    });

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-4 h-4 text-indigo-600" />概览统计</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-slate-100"><span className="text-sm text-slate-600">总请求数</span><span className="font-medium text-slate-900">{formatNumber(usage?.request_count || 0)}</span></div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100"><span className="text-sm text-slate-600">成功请求</span><span className="font-medium text-emerald-600">{formatNumber(usage?.success_count || 0)}</span></div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100"><span className="text-sm text-slate-600">失败请求</span><span className="font-medium text-red-600">{formatNumber(usage?.failed_count || 0)}</span></div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100"><span className="text-sm text-slate-600">Token消耗</span><span className="font-medium text-slate-900">{formatNumber(usage?.total_tokens || 0)}</span></div>
              <div className="flex items-center justify-between py-2"><span className="text-sm text-slate-600">成功率</span><span className="font-medium text-slate-900">{usage?.request_count ? `${((usage.success_count / usage.request_count) * 100).toFixed(1)}%` : "-"}</span></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Server className="w-4 h-4 text-purple-600" />渠道商分布</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(modelGrouped).map(([provider, info]) => {
                  const cfg = PROVIDER_CONFIG[provider] || PROVIDER_CONFIG.custom;
                  const maxCount = Math.max(...Object.values(modelGrouped).map((v) => v.count));
                  const percent = maxCount > 0 ? (info.count / maxCount) * 100 : 0;
                  return (
                    <div key={provider} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-700">{cfg.label}</span>
                        <span className="text-slate-500">{info.count} 个模型</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 rounded-full" style={{ width: `${percent}%` }} /></div>
                      </div>
                    </div>
                  );
                })}
                {Object.keys(modelGrouped).length === 0 && <p className="text-sm text-slate-500 text-center py-4">暂无数据</p>}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-600" />渠道状态</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {channels.map((ch) => {
                const cfg = PROVIDER_CONFIG[ch.provider] || PROVIDER_CONFIG.custom;
                return (
                  <div key={ch.id} className="p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn("w-2 h-2 rounded-full", ch.status === "active" ? "bg-emerald-500" : "bg-amber-500")} />
                      <span className="text-sm font-medium text-slate-700">{ch.name}</span>
                    </div>
                    <Badge className={cn(cfg.bg, cfg.color)}>{cfg.label}</Badge>
                    <div className="text-xs text-slate-500 mt-2">失败: {ch.failed_count} 次</div>
                  </div>
                );
              })}
              {channels.length === 0 && <p className="text-sm text-slate-500 col-span-full text-center py-4">暂无渠道</p>}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button variant="outline"><Download className="w-4 h-4 mr-2" />导出CSV</Button>
        </div>
      </div>
    );
  };

  const ChannelDialog = () => {
    if (!channelDialogOpen) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <Card className="w-full max-w-lg bg-white">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{editingChannel ? "编辑渠道" : "新增渠道"}</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setChannelDialogOpen(false)}><X className="w-4 h-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 py-4">
            <div className="space-y-2"><Label>名称</Label><Input placeholder="渠道名称" value={channelForm.name} onChange={(e) => setChannelForm({ ...channelForm, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>渠道商</Label>
                <select className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm" value={channelForm.provider} onChange={(e) => setChannelForm({ ...channelForm, provider: e.target.value })}>
                  <option value="alibaba">阿里百炼</option>
                  <option value="openai">OpenAI</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="custom">自定义</option>
                </select>
              </div>
              <div className="space-y-2"><Label>权重</Label><Input type="number" value={channelForm.weight} onChange={(e) => setChannelForm({ ...channelForm, weight: parseInt(e.target.value) || 100 })} /></div>
            </div>
            <div className="space-y-2"><Label>Base URL</Label><Input placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1" value={channelForm.base_url} onChange={(e) => setChannelForm({ ...channelForm, base_url: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>API Key</Label>
              <div className="relative">
                <Input type={apiKeyVisible ? "text" : "password"} placeholder="sk-..." value={channelForm.api_key} onChange={(e) => setChannelForm({ ...channelForm, api_key: e.target.value })} className="pr-10" />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setApiKeyVisible(!apiKeyVisible)}>
                  {apiKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>优先级</Label><Input type="number" value={channelForm.priority} onChange={(e) => setChannelForm({ ...channelForm, priority: parseInt(e.target.value) || 1 })} /></div></div>
          </CardContent>
          <div className="border-t p-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setChannelDialogOpen(false)}>取消</Button>
            <Button onClick={handleSaveChannel} disabled={isSaving}>{isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}{editingChannel ? "更新" : "创建"}</Button>
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
              <Button variant="ghost" size="icon" onClick={() => setModelDialogOpen(false)}><X className="w-4 h-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 py-4">
            <div className="space-y-2"><Label>模型名称</Label><Input placeholder="qwen-plus" value={modelForm.name} onChange={(e) => setModelForm({ ...modelForm, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>渠道商</Label>
                <select className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm" value={modelForm.provider} onChange={(e) => setModelForm({ ...modelForm, provider: e.target.value })}>
                  <option value="alibaba">阿里百炼</option>
                  <option value="openai">OpenAI</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="anthropic">Anthropic</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>所属渠道</Label>
                <select className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm" value={modelForm.channel_id} onChange={(e) => setModelForm({ ...modelForm, channel_id: parseInt(e.target.value) })}>
                  {channels.map((ch) => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                  {channels.length === 0 && <option value={0}>无可用渠道</option>}
                </select>
              </div>
            </div>
            <div className="space-y-2"><Label>最大Token</Label><Input type="number" value={modelForm.max_tokens} onChange={(e) => setModelForm({ ...modelForm, max_tokens: parseInt(e.target.value) || 32768 })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>输入价格/1K</Label><Input type="number" step="0.0001" value={modelForm.input_price} onChange={(e) => setModelForm({ ...modelForm, input_price: e.target.value })} /></div>
              <div className="space-y-2"><Label>输出价格/1K</Label><Input type="number" step="0.0001" value={modelForm.output_price} onChange={(e) => setModelForm({ ...modelForm, output_price: e.target.value })} /></div>
            </div>
          </CardContent>
          <div className="border-t p-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setModelDialogOpen(false)}>取消</Button>
            <Button onClick={handleSaveModel} disabled={isSaving}>{isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}{editingModel ? "更新" : "创建"}</Button>
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
              <Button variant="ghost" size="icon" onClick={() => setKeyDialogOpen(false)}><X className="w-4 h-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 py-4">
            <div className="space-y-2"><Label>用户ID</Label><Input type="number" placeholder="用户ID" value={keyForm.user_id || ""} onChange={(e) => setKeyForm({ ...keyForm, user_id: parseInt(e.target.value) || 0 })} /></div>
            <div className="space-y-2"><Label>Key 名称</Label><Input placeholder="Default Key" value={keyForm.name} onChange={(e) => setKeyForm({ ...keyForm, name: e.target.value })} /></div>
          </CardContent>
          <div className="border-t p-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setKeyDialogOpen(false)}>取消</Button>
            <Button onClick={handleCreateKey} disabled={isSaving}>{isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}创建</Button>
          </div>
        </Card>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">AI 模型网关</h2>
          <p className="text-slate-500 mt-1">管理渠道、模型和 API Key</p>
        </div>
        <Button variant="outline" onClick={handleRefresh}>
          <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />刷新
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", stat.bgColor)}><Icon className={cn("w-5 h-5", stat.textColor)} /></div>
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

      <div className="space-y-4">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-fit">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSearchQuery(""); }} className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all", activeTab === tab.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900")}>
                <Icon className="w-4 h-4" />{tab.label}
              </button>
            );
          })}
        </div>
        <div className="min-h-[400px]">
          {activeTab === "channels" && <ChannelsTab />}
          {activeTab === "models" && <ModelsTab />}
          {activeTab === "keys" && <KeysTab />}
          {activeTab === "usage" && <UsageTab />}
        </div>
      </div>

      <ChannelDialog />
      <ModelDialog />
      <KeyDialog />
    </div>
  );
}