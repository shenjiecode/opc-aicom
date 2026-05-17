import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Search,
  Globe,
  RefreshCw,
  Zap,
  Activity,
  CheckCircle,
  Clock,
  Key,
  Plus,
  TrendingUp,
  Server,
  Shield,
  ChevronLeft,
  ChevronRight,
  X,
  Edit,
  Trash2,
  Ban,
} from "lucide-react";

// Types
interface APIEndpoint {
  id: number;
  name: string;
  path: string;
  method: string;
  status: "active" | "disabled" | "deprecated";
  qps_limit: number;
  description?: string;
  todayCalls?: number;
}

interface APIKey {
  id: number;
  key: string;
  permission: string;
  status: "active" | "revoked";
  created_at: string;
  expires_at?: string;
  creator?: string;
}

interface StatsData {
  totalApis: number;
  todayCalls: number;
  successRate: number;
  avgLatencyMs: number;
}

interface APIListResponse {
  list: APIEndpoint[];
  total: number;
  page: number;
  page_size: number;
}

interface KeyListResponse {
  list: APIKey[];
  total: number;
  page: number;
  page_size: number;
}

interface FilterState {
  search: string;
  status: string;
}

// Filter options
const STATUSES = [
  { value: "", label: "全部状态" },
  { value: "active", label: "正常" },
  { value: "disabled", label: "已禁用" },
  { value: "deprecated", label: "已弃用" },
];

const API_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"];

const PERMISSIONS = [
  { value: "read", label: "只读权限" },
  { value: "write", label: "读写权限" },
  { value: "admin", label: "全部权限" },
];

// Status badge config
const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: "bg-emerald-100", text: "text-emerald-700", label: "正常" },
  disabled: { bg: "bg-red-100", text: "text-red-700", label: "已禁用" },
  deprecated: { bg: "bg-amber-100", text: "text-amber-700", label: "已弃用" },
  revoked: { bg: "bg-red-100", text: "text-red-700", label: "已撤销" },
};

// Method badge config
const METHOD_BADGE: Record<string, string> = {
  GET: "bg-blue-100 text-blue-700",
  POST: "bg-emerald-100 text-emerald-700",
  PUT: "bg-amber-100 text-amber-700",
  DELETE: "bg-red-100 text-red-700",
  PATCH: "bg-purple-100 text-purple-700",
};

export default function APIGateway() {
  // Stats state
  const [stats, setStats] = useState<StatsData>({
    totalApis: 0,
    todayCalls: 0,
    successRate: 0,
    avgLatencyMs: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // API list state
  const [apiList, setApiList] = useState<APIEndpoint[]>([]);
  const [apiLoading, setApiLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiPage, setApiPage] = useState(1);
  const [apiPageSize] = useState(10);
  const [apiTotal, setApiTotal] = useState(0);
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    status: "",
  });
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Keys list state
  const [keyList, setKeyList] = useState<APIKey[]>([]);
  const [keyLoading, setKeyLoading] = useState(true);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [keyPage, setKeyPage] = useState(1);
  const [keyPageSize] = useState(10);
  const [keyTotal, setKeyTotal] = useState(0);
  const [keyActionLoading, setKeyActionLoading] = useState<number | null>(null);

  // Dialog states
  const [isApiDialogOpen, setIsApiDialogOpen] = useState(false);
  const [isKeyDialogOpen, setIsKeyDialogOpen] = useState(false);
  const [editingApi, setEditingApi] = useState<APIEndpoint | null>(null);
  const [dialogLoading, setDialogLoading] = useState(false);

  // Form states
  const [apiForm, setApiForm] = useState({
    name: "",
    path: "",
    method: "GET",
    status: "active",
    qps_limit: 1000,
    description: "",
  });
  const [keyForm, setKeyForm] = useState({
    permission: "read",
    expires_at: "",
  });

  // Fetch stats on mount
  useEffect(() => {
    fetchStats();
  }, []);

  // Fetch API list when page or filters change
  useEffect(() => {
    fetchApiList();
  }, [apiPage, filters.status]);

  // Fetch keys list when page changes
  useEffect(() => {
    fetchKeyList();
  }, [keyPage]);

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const result = await apiFetch<StatsData>("/admin/api/stats", {
        method: "POST",
      });
      setStats(result);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchApiList = async () => {
    setApiLoading(true);
    setApiError(null);
    try {
      const result = await apiFetch<APIListResponse>("/admin/api/list", {
        method: "POST",
        body: JSON.stringify({
          page: apiPage,
          page_size: apiPageSize,
          search: filters.search,
          status: filters.status,
        }),
      });
      setApiList(result.list || []);
      setApiTotal(result.total || 0);
    } catch (err) {
      console.error("Failed to fetch API list:", err);
      setApiError("加载API数据失败，请稍后重试");
    } finally {
      setApiLoading(false);
    }
  };

  const fetchKeyList = async () => {
    setKeyLoading(true);
    setKeyError(null);
    try {
      const result = await apiFetch<KeyListResponse>("/admin/api/keys/list", {
        method: "POST",
        body: JSON.stringify({
          page: keyPage,
          page_size: keyPageSize,
        }),
      });
      setKeyList(result.list || []);
      setKeyTotal(result.total || 0);
    } catch (err) {
      console.error("Failed to fetch key list:", err);
      setKeyError("加载密钥数据失败，请稍后重试");
    } finally {
      setKeyLoading(false);
    }
  };

  const handleSearch = () => {
    setApiPage(1);
    fetchApiList();
  };

  const handleRefresh = () => {
    fetchStats();
    fetchApiList();
    fetchKeyList();
  };

  const openCreateApiDialog = () => {
    setEditingApi(null);
    setApiForm({
      name: "",
      path: "",
      method: "GET",
      status: "active",
      qps_limit: 1000,
      description: "",
    });
    setIsApiDialogOpen(true);
  };

  const openEditApiDialog = (api: APIEndpoint) => {
    setEditingApi(api);
    setApiForm({
      name: api.name,
      path: api.path,
      method: api.method,
      status: api.status,
      qps_limit: api.qps_limit,
      description: api.description || "",
    });
    setIsApiDialogOpen(true);
  };

  const closeApiDialog = () => {
    setIsApiDialogOpen(false);
    setEditingApi(null);
  };

  const handleSaveApi = async () => {
    setDialogLoading(true);
    try {
      if (editingApi) {
        // Update existing API
        await apiFetch(`/admin/api/${editingApi.id}/update`, {
          method: "POST",
          body: JSON.stringify(apiForm),
        });
      } else {
        // Create new API
        await apiFetch("/admin/api/create", {
          method: "POST",
          body: JSON.stringify(apiForm),
        });
      }
      closeApiDialog();
      fetchApiList();
    } catch (err) {
      console.error("Failed to save API:", err);
      alert("保存失败，请稍后重试");
    } finally {
      setDialogLoading(false);
    }
  };

  const handleDeleteApi = async (id: number) => {
    if (!confirm("确定要删除此API吗？此操作不可恢复。")) {
      return;
    }
    setActionLoading(id);
    try {
      await apiFetch(`/admin/api/${id}/delete`, {
        method: "POST",
      });
      fetchApiList();
    } catch (err) {
      console.error("Failed to delete API:", err);
      alert("删除失败，请稍后重试");
    } finally {
      setActionLoading(null);
    }
  };

  const openCreateKeyDialog = () => {
    setKeyForm({
      permission: "read",
      expires_at: "",
    });
    setIsKeyDialogOpen(true);
  };

  const closeKeyDialog = () => {
    setIsKeyDialogOpen(false);
  };

  const handleCreateKey = async () => {
    setDialogLoading(true);
    try {
      const body: { permission: string; expires_at?: string } = {
        permission: keyForm.permission,
      };
      if (keyForm.expires_at) {
        body.expires_at = new Date(keyForm.expires_at).toISOString();
      }
      await apiFetch("/admin/api/keys/create", {
        method: "POST",
        body: JSON.stringify(body),
      });
      closeKeyDialog();
      fetchKeyList();
    } catch (err) {
      console.error("Failed to create key:", err);
      alert("创建密钥失败，请稍后重试");
    } finally {
      setDialogLoading(false);
    }
  };

  const handleRevokeKey = async (id: number) => {
    if (!confirm("确定要撤销此密钥吗？撤销后该密钥将无法使用。")) {
      return;
    }
    setKeyActionLoading(id);
    try {
      await apiFetch(`/admin/api/keys/${id}/revoke`, {
        method: "POST",
      });
      fetchKeyList();
    } catch (err) {
      console.error("Failed to revoke key:", err);
      alert("撤销失败，请稍后重试");
    } finally {
      setKeyActionLoading(null);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const maskKey = (key: string) => {
    if (!key || key.length < 8) return key;
    return `${key.slice(0, 4)}****${key.slice(-4)}`;
  };

  const apiTotalPages = Math.ceil(apiTotal / apiPageSize);
  const keyTotalPages = Math.ceil(keyTotal / keyPageSize);

  const statCards = [
    {
      title: "API总数",
      value: stats.totalApis,
      icon: Server,
      textColor: "text-blue-600",
      lightColor: "bg-blue-50",
    },
    {
      title: "今日调用",
      value: stats.todayCalls.toLocaleString(),
      icon: Zap,
      textColor: "text-amber-600",
      lightColor: "bg-amber-50",
    },
    {
      title: "成功率",
      value: `${stats.successRate}%`,
      icon: CheckCircle,
      textColor: "text-emerald-600",
      lightColor: "bg-emerald-50",
    },
    {
      title: "平均延迟",
      value: `${stats.avgLatencyMs}ms`,
      icon: Activity,
      textColor: "text-purple-600",
      lightColor: "bg-purple-50",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">API网关</h2>
          <p className="text-slate-500 mt-1">管理API密钥、调用统计和限流配置</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Globe className="w-4 h-4" />
          <span>Phase 3 功能</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="border-slate-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">{stat.title}</p>
                    <p className={cn("text-2xl font-bold mt-1", stat.textColor)}>
                      {statsLoading ? "-" : stat.value}
                    </p>
                  </div>
                  <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center", stat.lightColor)}>
                    <Icon className={cn("w-6 h-6", stat.textColor)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="搜索API名称或端点..."
                className="pl-10"
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-slate-400" />
              <select
                className="h-9 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-slate-950"
                value={filters.status}
                onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
              >
                {STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Button */}
            <Button onClick={handleSearch} disabled={apiLoading}>
              <Search className="w-4 h-4 mr-2" />
              搜索
            </Button>

            {/* Refresh Button */}
            <Button variant="outline" onClick={handleRefresh} disabled={apiLoading || keyLoading}>
              <RefreshCw className={cn("w-4 h-4", (apiLoading || keyLoading) && "animate-spin")} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* API List Section */}
      <Card className="border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-slate-900">API列表</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">共 {apiTotal} 个API</span>
            <Button size="sm" onClick={openCreateApiDialog}>
              <Plus className="w-4 h-4 mr-2" />
              新增API
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {apiLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-500 border-r-transparent" />
            </div>
          ) : apiError ? (
            <div className="text-center py-12">
              <p className="text-red-500 mb-4">{apiError}</p>
              <Button onClick={fetchApiList}>重试</Button>
            </div>
          ) : apiList.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg">
              <Server className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">暂无API数据</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">名称</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">端点</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">状态</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">QPS限制</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">今日调用</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {apiList.map((api) => (
                    <tr key={api.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Server className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <span className="text-sm font-medium text-slate-900">{api.name}</span>
                            {api.description && (
                              <p className="text-xs text-slate-400">{api.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className={cn(
                              "text-xs font-mono",
                              METHOD_BADGE[api.method] || "bg-slate-100 text-slate-700"
                            )}
                          >
                            {api.method}
                          </Badge>
                          <code className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">
                            {api.path}
                          </code>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="secondary"
                          className={cn(
                            STATUS_BADGE[api.status]?.bg || "bg-slate-100",
                            STATUS_BADGE[api.status]?.text || "text-slate-700"
                          )}
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />
                          {STATUS_BADGE[api.status]?.label || api.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-slate-700">{api.qps_limit} req/s</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 text-sm text-slate-700">
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                          <span>{api.todayCalls?.toLocaleString() || 0}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-slate-600"
                            onClick={() => openEditApiDialog(api)}
                            disabled={actionLoading === api.id}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteApi(api.id)}
                            disabled={actionLoading === api.id}
                          >
                            {actionLoading === api.id ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* API Pagination */}
              {!apiLoading && !apiError && apiList.length > 0 && apiTotalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200">
                  <p className="text-sm text-slate-500">
                    显示第 {(apiPage - 1) * apiPageSize + 1} 到 {Math.min(apiPage * apiPageSize, apiTotal)} 条，共 {apiTotal} 条
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setApiPage((p) => Math.max(1, p - 1))}
                      disabled={apiPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-slate-600 px-2">
                      {apiPage} / {apiTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setApiPage((p) => Math.min(apiTotalPages, p + 1))}
                      disabled={apiPage === apiTotalPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Key Management Section */}
      <Card className="border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold text-slate-900">密钥管理</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">共 {keyTotal} 个密钥</span>
            <Button size="sm" onClick={openCreateKeyDialog}>
              <Key className="w-4 h-4 mr-2" />
              新增密钥
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {keyLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-500 border-r-transparent" />
            </div>
          ) : keyError ? (
            <div className="text-center py-12">
              <p className="text-red-500 mb-4">{keyError}</p>
              <Button onClick={fetchKeyList}>重试</Button>
            </div>
          ) : keyList.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg">
              <Key className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">暂无密钥数据</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">密钥</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">权限</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">状态</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">创建时间</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">过期时间</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {keyList.map((key) => (
                    <tr key={key.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                            <Key className="w-4 h-4 text-amber-600" />
                          </div>
                          <code className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">
                            {maskKey(key.key)}
                          </code>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="secondary"
                          className={cn(
                            "bg-purple-100 text-purple-700",
                            key.permission === "read" && "bg-slate-100 text-slate-700",
                            key.permission === "write" && "bg-blue-100 text-blue-700"
                          )}
                        >
                          <Shield className="w-3 h-3 mr-1" />
                          {PERMISSIONS.find((p) => p.value === key.permission)?.label || key.permission}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="secondary"
                          className={cn(
                            STATUS_BADGE[key.status]?.bg || "bg-slate-100",
                            STATUS_BADGE[key.status]?.text || "text-slate-700"
                          )}
                        >
                          {key.status === "active" ? (
                            <CheckCircle className="w-3 h-3 mr-1" />
                          ) : (
                            <Ban className="w-3 h-3 mr-1" />
                          )}
                          {STATUS_BADGE[key.status]?.label || key.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {formatDate(key.created_at)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {key.expires_at ? formatDate(key.expires_at) : "永不过期"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {key.status === "active" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                            onClick={() => handleRevokeKey(key.id)}
                            disabled={keyActionLoading === key.id}
                          >
                            {keyActionLoading === key.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <>
                                <Ban className="w-3.5 h-3.5 mr-1" />
                                撤销
                              </>
                            )}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Keys Pagination */}
              {!keyLoading && !keyError && keyList.length > 0 && keyTotalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200">
                  <p className="text-sm text-slate-500">
                    显示第 {(keyPage - 1) * keyPageSize + 1} 到 {Math.min(keyPage * keyPageSize, keyTotal)} 条，共 {keyTotal} 条
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setKeyPage((p) => Math.max(1, p - 1))}
                      disabled={keyPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-slate-600 px-2">
                      {keyPage} / {keyTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setKeyPage((p) => Math.min(keyTotalPages, p + 1))}
                      disabled={keyPage === keyTotalPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Dialog */}
      {isApiDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col bg-white">
            <CardHeader className="border-b border-slate-200 shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold text-slate-900">
                  {editingApi ? "编辑API" : "新增API"}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={closeApiDialog}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto py-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">名称</Label>
                <Input
                  id="name"
                  placeholder="API名称"
                  value={apiForm.name}
                  onChange={(e) => setApiForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="path">端点路径</Label>
                <Input
                  id="path"
                  placeholder="/api/v1/..."
                  value={apiForm.path}
                  onChange={(e) => setApiForm((prev) => ({ ...prev, path: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="method">方法</Label>
                  <select
                    id="method"
                    className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-slate-950"
                    value={apiForm.method}
                    onChange={(e) => setApiForm((prev) => ({ ...prev, method: e.target.value }))}
                  >
                    {API_METHODS.map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">状态</Label>
                  <select
                    id="status"
                    className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-slate-950"
                    value={apiForm.status}
                    onChange={(e) => setApiForm((prev) => ({ ...prev, status: e.target.value }))}
                  >
                    {STATUSES.filter((s) => s.value !== "").map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="qps_limit">QPS限制</Label>
                <Input
                  id="qps_limit"
                  type="number"
                  placeholder="1000"
                  value={apiForm.qps_limit}
                  onChange={(e) => setApiForm((prev) => ({ ...prev, qps_limit: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">描述</Label>
                <textarea
                  id="description"
                  rows={3}
                  placeholder="API描述..."
                  className="w-full px-3 py-2 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-slate-950 resize-none"
                  value={apiForm.description}
                  onChange={(e) => setApiForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>
            </CardContent>
            <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-3 shrink-0">
              <Button variant="outline" onClick={closeApiDialog}>
                取消
              </Button>
              <Button onClick={handleSaveApi} disabled={dialogLoading || !apiForm.name || !apiForm.path}>
                {dialogLoading ? "保存中..." : "保存"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Key Dialog */}
      {isKeyDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col bg-white">
            <CardHeader className="border-b border-slate-200 shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold text-slate-900">新增API密钥</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={closeKeyDialog}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto py-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="permission">权限</Label>
                <select
                  id="permission"
                  className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-slate-950"
                  value={keyForm.permission}
                  onChange={(e) => setKeyForm((prev) => ({ ...prev, permission: e.target.value }))}
                >
                  {PERMISSIONS.map((perm) => (
                    <option key={perm.value} value={perm.value}>
                      {perm.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expires_at">过期时间（可选）</Label>
                <Input
                  id="expires_at"
                  type="datetime-local"
                  value={keyForm.expires_at}
                  onChange={(e) => setKeyForm((prev) => ({ ...prev, expires_at: e.target.value }))}
                />
              </div>
            </CardContent>
            <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-3 shrink-0">
              <Button variant="outline" onClick={closeKeyDialog}>
                取消
              </Button>
              <Button onClick={handleCreateKey} disabled={dialogLoading}>
                {dialogLoading ? "创建中..." : "创建"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
