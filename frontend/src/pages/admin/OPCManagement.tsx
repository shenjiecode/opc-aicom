import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Shield,
  RefreshCw,
  Building2,
  User,
  Cpu,
  Clock,
  MoreHorizontal,
  CheckCircle,
  Clock3,
  Ban,
  Settings,
  X,
} from "lucide-react";

interface OPCStats {
  total: number;
  pending: number;
  active: number;
  suspended: number;
}

interface OPC {
  id: number;
  name: string;
  contact_name: string;
  status: "pending" | "active" | "suspended";
  quota: number;
  created_at: string;
}

interface OPCListResponse {
  list: OPC[];
  total: number;
  page: number;
  page_size: number;
}

interface FilterState {
  search: string;
  status: string;
}

const STATUSES = [
  { value: "", label: "全部状态" },
  { value: "pending", label: "待审核" },
  { value: "active", label: "正常" },
  { value: "suspended", label: "已暂停" },
];

export default function OPCManagement() {
  const [opcList, setOpcList] = useState<OPC[]>([]);
  const [stats, setStats] = useState<OPCStats>({
    total: 0,
    pending: 0,
    active: 0,
    suspended: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    status: "",
  });
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Dialog states
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [quotaDialogOpen, setQuotaDialogOpen] = useState(false);
  const [selectedOPC, setSelectedOPC] = useState<OPC | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [newQuota, setNewQuota] = useState("");

  useEffect(() => {
    fetchStats();
    fetchOPCList();
  }, []);

  useEffect(() => {
    fetchOPCList();
  }, [page, filters.status]);

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const result = await apiFetch<OPCStats>("/admin/opc/stats", {
        method: "POST",
      });
      setStats(result);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchOPCList = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<OPCListResponse>("/admin/opc/list", {
        method: "POST",
        body: JSON.stringify({
          page,
          page_size: pageSize,
          search: filters.search,
          status: filters.status,
        }),
      });
      setOpcList(result.list || []);
      setTotal(result.total || 0);
    } catch (err) {
      console.error("Failed to fetch OPC list:", err);
      setError("加载OPC数据失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchOPCList();
  };

  const handleRefresh = () => {
    fetchStats();
    fetchOPCList();
  };

  const handleApprove = async (opcId: number) => {
    setActionLoading(opcId);
    try {
      await apiFetch(`/admin/opc/${opcId}/approve`, {
        method: "POST",
      });
      fetchOPCList();
      fetchStats();
    } catch (err) {
      console.error("Failed to approve OPC:", err);
      alert("审核通过失败，请稍后重试");
    } finally {
      setActionLoading(null);
    }
  };

  const openRejectDialog = (opc: OPC) => {
    setSelectedOPC(opc);
    setRejectReason("");
    setRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!selectedOPC || !rejectReason.trim()) return;
    setActionLoading(selectedOPC.id);
    try {
      await apiFetch(`/admin/opc/${selectedOPC.id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason: rejectReason }),
      });
      setRejectDialogOpen(false);
      fetchOPCList();
      fetchStats();
    } catch (err) {
      console.error("Failed to reject OPC:", err);
      alert("拒绝失败，请稍后重试");
    } finally {
      setActionLoading(null);
      setSelectedOPC(null);
    }
  };

  const handleSuspend = async (opcId: number) => {
    setActionLoading(opcId);
    try {
      await apiFetch(`/admin/opc/${opcId}/suspend`, {
        method: "POST",
      });
      fetchOPCList();
      fetchStats();
    } catch (err) {
      console.error("Failed to suspend OPC:", err);
      alert("暂停失败，请稍后重试");
    } finally {
      setActionLoading(null);
    }
  };

  const openQuotaDialog = (opc: OPC) => {
    setSelectedOPC(opc);
    setNewQuota(opc.quota.toString());
    setQuotaDialogOpen(true);
  };

  const handleUpdateQuota = async () => {
    if (!selectedOPC || !newQuota.trim()) return;
    const quotaNum = parseInt(newQuota, 10);
    if (isNaN(quotaNum) || quotaNum < 0) {
      alert("请输入有效的配额数值");
      return;
    }
    setActionLoading(selectedOPC.id);
    try {
      await apiFetch(`/admin/opc/${selectedOPC.id}/quota`, {
        method: "POST",
        body: JSON.stringify({ quota: quotaNum }),
      });
      setQuotaDialogOpen(false);
      fetchOPCList();
    } catch (err) {
      console.error("Failed to update quota:", err);
      alert("更新配额失败，请稍后重试");
    } finally {
      setActionLoading(null);
      setSelectedOPC(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge
            variant="secondary"
            className="bg-emerald-100 text-emerald-700"
          >
            <CheckCircle className="w-3 h-3 mr-1" />
            正常
          </Badge>
        );
      case "pending":
        return (
          <Badge
            variant="secondary"
            className="bg-amber-100 text-amber-700"
          >
            <Clock3 className="w-3 h-3 mr-1" />
            待审核
          </Badge>
        );
      case "suspended":
        return (
          <Badge variant="secondary" className="bg-red-100 text-red-700">
            <Ban className="w-3 h-3 mr-1" />
            已暂停
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-slate-100 text-slate-700">
            {status}
          </Badge>
        );
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  const statsCards = [
    {
      title: "OPC总数",
      value: stats.total,
      icon: Building2,
      color: "bg-blue-500",
      lightColor: "bg-blue-50",
      textColor: "text-blue-600",
    },
    {
      title: "待审核",
      value: stats.pending,
      icon: Clock3,
      color: "bg-amber-500",
      lightColor: "bg-amber-50",
      textColor: "text-amber-600",
    },
    {
      title: "活跃OPC",
      value: stats.active,
      icon: CheckCircle,
      color: "bg-emerald-500",
      lightColor: "bg-emerald-50",
      textColor: "text-emerald-600",
    },
    {
      title: "已暂停",
      value: stats.suspended,
      icon: Ban,
      color: "bg-red-500",
      lightColor: "bg-red-50",
      textColor: "text-red-600",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">OPC管理</h2>
          <p className="text-slate-500 mt-1">管理OPC用户、审核资质和配额</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Shield className="w-4 h-4" />
          <span>Phase 3 功能</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="border-slate-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-500">{stat.title}</p>
                    <p className={cn("text-2xl font-bold mt-1", stat.textColor)}>
                      {statsLoading ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : (
                        stat.value
                      )}
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
                placeholder="搜索OPC名称或联系人..."
                className="pl-10"
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
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
            <Button onClick={handleSearch} disabled={loading}>
              <Search className="w-4 h-4 mr-2" />
              搜索
            </Button>

            {/* Refresh Button */}
            <Button variant="outline" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* OPC Table */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">OPC列表</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-500 border-r-transparent" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-500 mb-4">{error}</p>
              <Button onClick={fetchOPCList}>重试</Button>
            </div>
          ) : opcList.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">暂无OPC数据</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">ID</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">名称</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">联系人</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">状态</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">算力配额</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">注册时间</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {opcList.map((opc) => (
                    <tr key={opc.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 text-sm text-slate-600">#{opc.id}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                            <Building2 className="w-4 h-4 text-indigo-600" />
                          </div>
                          <span className="text-sm font-medium text-slate-900">{opc.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center">
                            <User className="w-3 h-3 text-slate-500" />
                          </div>
                          <span className="text-sm text-slate-700">{opc.contact_name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(opc.status)}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 text-sm text-slate-700">
                          <Cpu className="w-3.5 h-3.5 text-slate-400" />
                          <span>{opc.quota} GPU·h</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {formatDate(opc.created_at)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-slate-600"
                              disabled={actionLoading === opc.id}
                            >
                              {actionLoading === opc.id ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="w-4 h-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            {opc.status === "pending" && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => handleApprove(opc.id)}
                                  className="text-emerald-600 focus:text-emerald-700 focus:bg-emerald-50"
                                >
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  审核通过
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => openRejectDialog(opc)}
                                  className="text-red-600 focus:text-red-700 focus:bg-red-50"
                                >
                                  <X className="w-4 h-4 mr-2" />
                                  拒绝
                                </DropdownMenuItem>
                              </>
                            )}
                            {opc.status === "active" && (
                              <DropdownMenuItem
                                onClick={() => handleSuspend(opc.id)}
                                className="text-amber-600 focus:text-amber-700 focus:bg-amber-50"
                              >
                                <Ban className="w-4 h-4 mr-2" />
                                暂停
                              </DropdownMenuItem>
                            )}
                            {opc.status === "suspended" && (
                              <DropdownMenuItem
                                onClick={() => handleApprove(opc.id)}
                                className="text-emerald-600 focus:text-emerald-700 focus:bg-emerald-50"
                              >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                恢复
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => openQuotaDialog(opc)}
                              className="text-blue-600 focus:text-blue-700 focus:bg-blue-50"
                            >
                              <Settings className="w-4 h-4 mr-2" />
                              修改配额
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && !error && opcList.length > 0 && totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200">
              <p className="text-sm text-slate-500">
                显示第 {(page - 1) * pageSize + 1} 到 {Math.min(page * pageSize, total)} 条，共 {total} 条
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-slate-600 px-2">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      {rejectDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">拒绝原因</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRejectDialogOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-4">
              <p className="text-sm text-slate-600 mb-3">
                请输入拒绝 {selectedOPC?.name} 申请的原因：
              </p>
              <textarea
                className="w-full h-24 p-3 border border-slate-200 rounded-md resize-none focus:outline-none focus:ring-1 focus:ring-slate-950"
                placeholder="请输入拒绝原因..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
                取消
              </Button>
              <Button
                onClick={handleReject}
                disabled={!rejectReason.trim() || actionLoading === selectedOPC?.id}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {actionLoading === selectedOPC?.id ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                确认拒绝
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Quota Dialog */}
      {quotaDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">修改配额</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setQuotaDialogOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-4">
              <p className="text-sm text-slate-600 mb-3">
                修改 {selectedOPC?.name} 的算力配额：
              </p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  placeholder="请输入配额数值"
                  value={newQuota}
                  onChange={(e) => setNewQuota(e.target.value)}
                  className="flex-1"
                />
                <span className="text-sm text-slate-500">GPU·h</span>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <Button variant="outline" onClick={() => setQuotaDialogOpen(false)}>
                取消
              </Button>
              <Button
                onClick={handleUpdateQuota}
                disabled={!newQuota.trim() || actionLoading === selectedOPC?.id}
              >
                {actionLoading === selectedOPC?.id ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                确认修改
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
