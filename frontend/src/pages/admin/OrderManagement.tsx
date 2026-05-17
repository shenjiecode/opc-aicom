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
  RotateCcw,
  ShoppingCart,
  RefreshCw,
  DollarSign,
  User,
  FileText,
} from "lucide-react";

interface Order {
  id: number;
  userId: number;
  username: string;
  taskId: number;
  taskTitle: string;
  amount: number;
  status: "pending" | "paid" | "completed" | "refunded";
  createdAt: string;
}

interface OrderListResponse {
  list: Order[];
  total: number;
  page: number;
  pageSize: number;
}

interface FilterState {
  search: string;
  status: string;
}

const STATUSES = [
  { value: "", label: "全部状态" },
  { value: "pending", label: "待支付" },
  { value: "paid", label: "已支付" },
  { value: "completed", label: "已完成" },
  { value: "refunded", label: "已退款" },
];

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "bg-yellow-100", text: "text-yellow-700", label: "待支付" },
  paid: { bg: "bg-blue-100", text: "text-blue-700", label: "已支付" },
  completed: { bg: "bg-emerald-100", text: "text-emerald-700", label: "已完成" },
  refunded: { bg: "bg-slate-100", text: "text-slate-700", label: "已退款" },
};

export default function OrderManagement() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    status: "",
  });
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    fetchOrders();
  }, [page, filters.status]);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<OrderListResponse>("/admin/orders/list", {
        method: "POST",
        body: JSON.stringify({
          page,
          pageSize,
          search: filters.search,
          status: filters.status,
        }),
      });
      setOrders(result.list || []);
      setTotal(result.total || 0);
    } catch (err) {
      console.error("Failed to fetch orders:", err);
      setError("加载订单数据失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchOrders();
  };

  const handleRefund = async (orderId: number) => {
    if (!confirm("确定要退款此订单吗？退款后金额将退回给用户。")) {
      return;
    }
    setActionLoading(orderId);
    try {
      await apiFetch(`/admin/orders/${orderId}/refund`, {
        method: "POST",
      });
      // Refresh the list
      fetchOrders();
    } catch (err) {
      console.error("Failed to refund order:", err);
      alert("操作失败，请稍后重试");
    } finally {
      setActionLoading(null);
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

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: "CNY",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">订单管理</h2>
          <p className="text-slate-500 mt-1">管理平台订单，查看和处理退款</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <ShoppingCart className="w-4 h-4" />
          <span>共 {total} 个订单</span>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="搜索订单ID或用户..."
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
            <Button onClick={handleSearch}>
              <Search className="w-4 h-4 mr-2" />
              搜索
            </Button>

            {/* Refresh Button */}
            <Button variant="outline" onClick={fetchOrders} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Orders Table */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">订单列表</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-500 border-r-transparent" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-500 mb-4">{error}</p>
              <Button onClick={fetchOrders}>重试</Button>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg">
              <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">暂无订单数据</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">ID</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">用户</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">任务</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">金额</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">状态</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">创建时间</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 text-sm text-slate-600">#{order.id}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center">
                            <User className="w-3.5 h-3.5 text-indigo-600" />
                          </div>
                          <span className="text-sm font-medium text-slate-900">{order.username}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-sm text-slate-700 truncate max-w-[150px]">
                            {order.taskTitle}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 text-sm font-medium text-slate-900">
                          <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                          {formatAmount(order.amount)}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="secondary"
                          className={cn(
                            STATUS_BADGE[order.status]?.bg || "bg-slate-100",
                            STATUS_BADGE[order.status]?.text || "text-slate-700"
                          )}
                        >
                          {STATUS_BADGE[order.status]?.label || order.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {(order.status === "paid" || order.status === "completed") && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200"
                            onClick={() => handleRefund(order.id)}
                            disabled={actionLoading === order.id}
                          >
                            {actionLoading === order.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <>
                                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                                退款
                              </>
                            )}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && !error && orders.length > 0 && totalPages > 1 && (
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
