import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shell,
  ArrowLeft,
  History,
  Download,
  Loader2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";
import { getTransactions, getCreditBalance } from "@/lib/api/credit";
import type { CreditTransaction, CreditBalance } from "@/types/credit";

type TransactionType = "all" | "recharge" | "consume";

interface TransactionFilter {
  type: TransactionType;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatNumber(num: number): string {
  return num.toLocaleString("zh-CN");
}

function formatAmount(amount: number): string {
  const sign = amount > 0 ? "+" : "";
  return `${sign}${formatNumber(amount)}`;
}

function getTransactionTypeLabel(type: string): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  switch (type) {
    case "recharge":
      return { label: "充值", variant: "default" };
    case "consume":
      return { label: "消费", variant: "secondary" };
    case "refund":
      return { label: "退款", variant: "outline" };
    default:
      return { label: type, variant: "outline" };
  }
}

export default function CreditHistoryPage() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TransactionFilter>({ type: "all" });
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
  });

  useEffect(() => {
    loadBalance();
    loadTransactions();
  }, [pagination.page, pagination.pageSize, filter.type]);

  const loadBalance = async () => {
    try {
      setBalanceLoading(true);
      const data = await getCreditBalance();
      setBalance(data);
    } catch (err) {
      console.error("[CreditHistory] Failed to load balance:", err);
    } finally {
      setBalanceLoading(false);
    }
  };

  const loadTransactions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getTransactions(
        pagination.page,
        pagination.pageSize,
        filter.type
      );
      setTransactions(response.list);
      setPagination((prev) => ({ ...prev, total: response.total }));
    } catch (err) {
      setError("加载交易记录失败，请稍后重试");
      console.error("[CreditHistory] Failed to load transactions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    // Simple CSV export
    const headers = ["ID", "时间", "类型", "金额", "余额变动后", "描述", "模型", "Token使用量"];
    const rows = transactions.map((t) => [
      t.id,
      t.created_at,
      t.type,
      t.amount,
      t.balance_after,
      t.description,
      t.model || "-",
      t.tokens_used || "-",
    ]);
    
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `transactions_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  const totalPages = Math.ceil(pagination.total / pagination.pageSize);

  return (
    <div className="min-h-full bg-slate-50/50 p-4 lg:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="text-slate-500 hover:text-slate-700"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                <History className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900">海贝明细</h1>
                <p className="text-sm text-slate-500">查看您的海贝交易记录</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleExport}
              className="border-slate-200 text-slate-600"
            >
              <Download className="w-4 h-4 mr-2" />
              导出
            </Button>
            <Button
              variant="outline"
              onClick={loadTransactions}
              className="border-slate-200 text-slate-600"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              刷新
            </Button>
          </div>
        </div>

        {/* Balance Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-violet-500 to-purple-600 border-0 shadow-lg shadow-violet-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-violet-100 text-sm font-medium flex items-center gap-2">
                <Shell className="w-4 h-4" />
                海贝余额
              </CardTitle>
            </CardHeader>
            <CardContent>
              {balanceLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-violet-200" />
                  <span className="text-violet-200">加载中...</span>
                </div>
              ) : (
                <p className="text-4xl font-bold text-white">
                  {formatNumber(balance?.points ?? 0)}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-slate-500 text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                累计充值
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-slate-900">
                {formatNumber(
                  transactions
                    .filter((t) => t.type === "recharge")
                    .reduce((sum, t) => sum + t.amount, 0)
                )}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-slate-500 text-sm font-medium flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-rose-500" />
                累计消费
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-slate-900">
                {formatNumber(
                  Math.abs(
                    transactions
                      .filter((t) => t.type === "consume")
                      .reduce((sum, t) => sum + t.amount, 0)
                  )
                )}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Filter Card */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Wallet className="w-5 h-5 text-violet-500" />
              交易记录
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-500">筛选：</span>
                <Select
                  value={filter.type}
                  onValueChange={(value) => {
                    setFilter({ type: value as TransactionType });
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                >
                  <SelectTrigger className="w-32 border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="recharge">充值</SelectItem>
                    <SelectItem value="consume">消费</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <span className="text-sm text-slate-500">
                共 {pagination.total} 条记录
              </span>
            </div>

            {/* Transactions Table */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    <TableHead className="w-40">时间</TableHead>
                    <TableHead className="w-24">类型</TableHead>
                    <TableHead className="text-right">金额</TableHead>
                    <TableHead className="text-right">余额变动后</TableHead>
                    <TableHead>描述</TableHead>
                    <TableHead className="w-32">模型</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12">
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
                          <span className="text-slate-500">加载中...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
                            <History className="w-8 h-8 text-slate-400" />
                          </div>
                          <p className="text-slate-500">暂无交易记录</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.map((transaction) => {
                      const typeInfo = getTransactionTypeLabel(transaction.type);
                      return (
                        <TableRow key={transaction.id}>
                          <TableCell className="text-slate-600">
                            {formatDate(transaction.created_at)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={typeInfo.variant}
                              className={cn(
                                transaction.type === "recharge" &&
                                  "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
                                transaction.type === "consume" &&
                                  "bg-violet-100 text-violet-700 hover:bg-violet-100",
                                transaction.type === "refund" &&
                                  "bg-amber-100 text-amber-700 hover:bg-amber-100"
                              )}
                            >
                              {typeInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right font-medium",
                              transaction.amount > 0
                                ? "text-emerald-600"
                                : "text-rose-600"
                            )}
                          >
                            {formatAmount(transaction.amount)}
                          </TableCell>
                          <TableCell className="text-right text-slate-600">
                            {formatNumber(transaction.balance_after)}
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-slate-600">
                            {transaction.description}
                          </TableCell>
                          <TableCell className="text-slate-500">
                            {transaction.model || "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <span className="text-sm text-slate-500">
                  第 {pagination.page} 页，共 {totalPages} 页
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        page: Math.max(1, prev.page - 1),
                      }))
                    }
                    disabled={pagination.page <= 1 || loading}
                    className="border-slate-200"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        page: Math.min(totalPages, prev.page + 1),
                      }))
                    }
                    disabled={pagination.page >= totalPages || loading}
                    className="border-slate-200"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
