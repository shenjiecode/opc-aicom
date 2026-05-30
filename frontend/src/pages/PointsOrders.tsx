import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ShoppingCart,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Coins,
  Package,
  Zap,
  Cpu,
} from "lucide-react";

interface PointsOrder {
  id: number;
  order_no: string;
  order_type: "qoder_account" | "compute_recharge";
  product_name: string;
  points_amount: number;
  status: "pending" | "completed" | "cancelled" | "refunded";
  created_at: string;
}

interface OrderListResponse {
  list: PointsOrder[];
  total: number;
  page: number;
  page_size: number;
}

const ORDER_TYPES = [
  { value: "", label: "全部类型" },
  { value: "qoder_account", label: "Qoder 账号" },
  { value: "compute_recharge", label: "算力充值" },
];

const TYPE_BADGE: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  qoder_account: {
    label: "Qoder 账号",
    icon: Zap,
    color: "text-blue-600 bg-blue-50",
  },
  compute_recharge: {
    label: "算力充值",
    icon: Cpu,
    color: "text-purple-600 bg-purple-50",
  },
};

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "待处理", variant: "secondary" },
  completed: { label: "已完成", variant: "default" },
  cancelled: { label: "已取消", variant: "outline" },
  refunded: { label: "已退款", variant: "destructive" },
};

export default function PointsOrders() {
  const [orders, setOrders] = useState<PointsOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState<string>("");

  useEffect(() => {
    fetchOrders();
  }, [page, typeFilter]);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("pageSize", pageSize.toString());
      if (typeFilter) {
        params.append("type", typeFilter);
      }

      const result = await apiFetch<OrderListResponse>(`/orders?${params.toString()}`, {
        method: "GET",
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString("zh-CN");
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="min-h-full bg-slate-50/50 p-4 lg:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">积分订单</h1>
              <p className="text-sm text-slate-500">查看您的积分消费记录</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Package className="w-4 h-4" />
            <span>共 {total} 个订单</span>
          </div>
        </div>

        {/* Filters */}
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">订单类型:</span>
                <Select
                  value={typeFilter}
                  onValueChange={(value) => {
                    setTypeFilter(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="选择类型" />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDER_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                onClick={fetchOrders}
                disabled={loading}
                className="ml-auto"
              >
                <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
                刷新
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
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-amber-500 border-r-transparent" />
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>订单号</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead>商品名称</TableHead>
                      <TableHead>积分</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>创建时间</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => {
                      const typeInfo = TYPE_BADGE[order.order_type];
                      const TypeIcon = typeInfo?.icon;
                      const statusInfo = STATUS_BADGE[order.status];

                      return (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono text-sm text-slate-600">
                            {order.order_no}
                          </TableCell>
                          <TableCell>
                            {TypeIcon && (
                              <div className={cn(
                                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                                typeInfo.color
                              )}>
                                <TypeIcon className="w-3.5 h-3.5" />
                                {typeInfo.label}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-slate-700">
                            {order.product_name}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-amber-600 font-medium">
                              <Coins className="w-4 h-4" />
                              {formatNumber(order.points_amount)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusInfo?.variant || "outline"}>
                              {statusInfo?.label || order.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">
                            {formatDate(order.created_at)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
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
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
