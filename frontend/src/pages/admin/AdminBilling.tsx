import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  CreditCard,
  DollarSign,
  Clock,
  TrendingUp,
  Package,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ComputeUsageRecord {
  id: number;
  userId: number;
  username: string;
  packageId: number;
  packageName: string;
  creditsUsed: string;
  computeHours: number;
  resourceType: string;
  resourceId: number;
  description: string;
  createdAt: string;
}

interface ComputeUsageListResponse {
  list: ComputeUsageRecord[];
  total: number;
  page: number;
  pageSize: number;
}

interface ComputeUsageSummary {
  totalCreditsUsed: string;
  totalComputeHours: number;
  totalRecords: number;
}

interface FilterState {
  search: string;
  userId: string;
  packageId: string;
  resourceType: string;
  startDate: string;
  endDate: string;
}

interface SummaryCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  color: string;
  bgColor: string;
}

const RESOURCE_TYPES = [
  { value: "", label: "全部类型" },
  { value: "cpu", label: "CPU" },
  { value: "gpu", label: "GPU" },
  { value: "memory", label: "内存" },
  { value: "storage", label: "存储" },
];

function SummaryCard({ icon: Icon, label, value, color, bgColor }: SummaryCardProps) {
  return (
    <Card className="border-slate-200">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className={cn("p-2 rounded-lg", bgColor)}>
            <Icon className={cn("w-5 h-5", color)} />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          <p className="text-sm text-slate-500 mt-0.5">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminBilling() {
  const [records, setRecords] = useState<ComputeUsageRecord[]>([]);
  const [summary, setSummary] = useState<ComputeUsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    userId: "",
    packageId: "",
    resourceType: "",
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    fetchRecords();
    fetchSummary();
  }, [page]);

  const fetchSummary = async () => {
    setSummaryLoading(true);
    try {
      const result = await apiFetch<ComputeUsageSummary>("/admin/compute/usage/summary", {
        method: "POST",
        body: JSON.stringify({
          startDate: filters.startDate,
          endDate: filters.endDate,
        }),
      });
      setSummary(result);
    } catch (err) {
      console.error("Failed to fetch summary:", err);
    } finally {
      setSummaryLoading(false);
    }
  };

  const fetchRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<ComputeUsageListResponse>("/admin/compute/usage/list", {
        method: "POST",
        body: JSON.stringify({
          page,
          pageSize,
          userId: filters.userId ? parseInt(filters.userId) : 0,
          packageId: filters.packageId ? parseInt(filters.packageId) : 0,
          resourceType: filters.resourceType,
          startDate: filters.startDate,
          endDate: filters.endDate,
        }),
      });
      setRecords(result.list || []);
      setTotal(result.total || 0);
    } catch (err) {
      console.error("Failed to fetch records:", err);
      setError("加载数据失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchRecords();
    fetchSummary();
  };

  const handleResetFilters = () => {
    setFilters({
      search: "",
      userId: "",
      packageId: "",
      resourceType: "",
      startDate: "",
      endDate: "",
    });
    setPage(1);
    setTimeout(() => {
      fetchRecords();
      fetchSummary();
    }, 0);
  };


  const formatDateTime = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getResourceTypeBadge = (type: string) => {
    const styles: Record<string, { bg: string; text: string; label: string }> = {
      cpu: { bg: "bg-blue-100", text: "text-blue-700", label: "CPU" },
      gpu: { bg: "bg-purple-100", text: "text-purple-700", label: "GPU" },
      memory: { bg: "bg-green-100", text: "text-green-700", label: "内存" },
      storage: { bg: "bg-orange-100", text: "text-orange-700", label: "存储" },
    };

    const style = styles[type] || { bg: "bg-slate-100", text: "text-slate-700", label: type || "其他" };

    return (
      <Badge variant="secondary" className={cn(style.bg, style.text)}>
        {style.label}
      </Badge>
    );
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">计算计费管理</h2>
          <p className="text-slate-500 mt-1">查看和管理所有用户的计算资源使用情况</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <CreditCard className="w-4 h-4" />
          <span>共 {total} 条记录</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <SummaryCard
          icon={DollarSign}
          label="总积分消耗"
          value={summaryLoading ? "-" : summary?.totalCreditsUsed || "0"}
          color="text-emerald-600"
          bgColor="bg-emerald-50"
        />
        <SummaryCard
          icon={Clock}
          label="总算力小时"
          value={summaryLoading ? "-" : summary?.totalComputeHours?.toFixed(2) || "0"}
          color="text-blue-600"
          bgColor="bg-blue-50"
        />
        <SummaryCard
          icon={TrendingUp}
          label="总记录数"
          value={summaryLoading ? "-" : summary?.totalRecords || 0}
          color="text-purple-600"
          bgColor="bg-purple-50"
        />
      </div>

      {/* Filters */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            {/* First Row */}
            <div className="flex flex-col sm:flex-row gap-4">
              {/* User ID Filter */}
              <div className="relative flex-1 max-w-xs">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="用户ID..."
                  className="pl-10"
                  value={filters.userId}
                  onChange={(e) => setFilters((prev) => ({ ...prev, userId: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>

              {/* Package ID Filter */}
              <div className="relative flex-1 max-w-xs">
                <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="套餐ID..."
                  className="pl-10"
                  value={filters.packageId}
                  onChange={(e) => setFilters((prev) => ({ ...prev, packageId: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
              </div>

              {/* Resource Type Filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  className="h-9 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-slate-950"
                  value={filters.resourceType}
                  onChange={(e) => setFilters((prev) => ({ ...prev, resourceType: e.target.value }))}
                >
                  {RESOURCE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Second Row - Date Range */}
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600 whitespace-nowrap">开始日期:</span>
                <Input
                  type="date"
                  className="h-9 w-40"
                  value={filters.startDate}
                  onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600 whitespace-nowrap">结束日期:</span>
                <Input
                  type="date"
                  className="h-9 w-40"
                  value={filters.endDate}
                  onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
                />
              </div>

              <div className="flex gap-2 ml-auto">
                <Button variant="outline" onClick={handleResetFilters}>
                  重置
                </Button>
                <Button onClick={handleSearch}>
                  <Search className="w-4 h-4 mr-2" />
                  搜索
                </Button>
                <Button variant="outline" onClick={fetchRecords} disabled={loading}>
                  <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Records Table */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">使用记录列表</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-500 border-r-transparent" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-500 mb-4">{error}</p>
              <Button onClick={fetchRecords}>重试</Button>
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg">
              <CreditCard className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">暂无使用记录</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">ID</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">用户</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">套餐</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">积分消耗</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">算力小时</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">资源类型</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">描述</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">使用时间</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 text-sm text-slate-600">#{record.id}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center">
                            <User className="w-3.5 h-3.5 text-indigo-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{record.username}</p>
                            <p className="text-xs text-slate-500">ID: {record.userId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Package className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-sm text-slate-700">
                            {record.packageName || `套餐 #${record.packageId}`}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 text-sm font-medium text-emerald-600">
                          <span>{record.creditsUsed}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 text-sm font-medium text-slate-900">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{record.computeHours.toFixed(2)}h</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {getResourceTypeBadge(record.resourceType)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-slate-600 max-w-[200px] block truncate">
                          {record.description || "-"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {formatDateTime(record.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && !error && records.length > 0 && totalPages > 1 && (
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
    </div>
  );
}
