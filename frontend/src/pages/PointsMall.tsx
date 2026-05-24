import { useState, useEffect } from "react";
import {
  ShoppingBag,
  Coins,
  Package,
  History,
  CheckCircle,
  AlertCircle,
  Zap,
  Cpu,
  Gift,
  Loader2,
  Clock,
  Wallet,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getPackages, getBalance, purchasePackage, getMyPackages } from "@/lib/api/mall";
import type { MallPackage, MallBalance, MyPackage } from "@/types/mall";

// Toast notification type
interface Toast {
  id: string;
  type: "success" | "error";
  title: string;
  message: string;
}

// Format number with commas
function formatNumber(num: number | undefined | null): string {
  return (num ?? 0).toLocaleString("zh-CN");
}

// Format date
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// Get package type label and icon
const getPackageTypeInfo = (type: string) => {
  switch (type) {
    case "qoder":
      return { label: "Qoder 算力", icon: Zap, color: "bg-blue-500", textColor: "text-blue-600" };
    case "gpu":
      return { label: "GPU 算力", icon: Cpu, color: "bg-purple-500", textColor: "text-purple-600" };
    default:
      return { label: "其他", icon: Gift, color: "bg-emerald-500", textColor: "text-emerald-600" };
  }
};

// Get status badge for my packages
const getStatusBadge = (status: string, expiresAt: string) => {
  const isExpired = new Date(expiresAt) < new Date();
  
  if (status === "expired" || isExpired) {
    return { label: "已过期", variant: "destructive" as const };
  }
  if (status === "cancelled") {
    return { label: "已取消", variant: "outline" as const };
  }
  return { label: "有效", variant: "default" as const };
};

export default function PointsMall() {
  // State
  const [packages, setPackages] = useState<MallPackage[]>([]);
  const [balance, setBalance] = useState<MallBalance>({ points: 0 });
  const [myPackages, setMyPackages] = useState<MyPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [myPackagesLoading, setMyPackagesLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"shop" | "my-packages">("shop");
  const [selectedPackage, setSelectedPackage] = useState<MallPackage | null>(null);
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Fetch data on mount
  useEffect(() => {
    loadPackages();
    loadBalance();
    loadMyPackages();
  }, []);

  // Load packages
  const loadPackages = async () => {
    try {
      setLoading(true);
      const response = await getPackages();
      const allPackages = response?.list || [];
      const activePackages = allPackages.filter((p) => p.status === "active");
      // Sort by sort_order
      activePackages.sort((a, b) => a.sort_order - b.sort_order);
      setPackages(activePackages);
    } catch (err) {
      console.error("[PointsMall] Failed to load packages:", err);
      showToast("error", "加载失败", "无法加载商品列表，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  // Load balance
  const loadBalance = async () => {
    try {
      setBalanceLoading(true);
      const data = await getBalance();
      setBalance(data);
    } catch (err) {
      console.error("[PointsMall] Failed to load balance:", err);
      showToast("error", "加载失败", "无法加载积分余额");
    } finally {
      setBalanceLoading(false);
    }
  };

  // Load my packages
  const loadMyPackages = async () => {
    try {
      setMyPackagesLoading(true);
      const response = await getMyPackages();
      setMyPackages(response?.list || []);
    } catch (err) {
      console.error("[PointsMall] Failed to load my packages:", err);
      showToast("error", "加载失败", "无法加载已购套餐");
    } finally {
      setMyPackagesLoading(false);
    }
  };

  // Show toast notification
  const showToast = (type: "success" | "error", title: string, message: string) => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, type, title, message }]);
    // Auto remove after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Remove toast
  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Open purchase dialog
  const handlePurchaseClick = (pkg: MallPackage) => {
    setSelectedPackage(pkg);
    setIsPurchaseDialogOpen(true);
  };

  // Confirm purchase
  const handleConfirmPurchase = async () => {
    if (!selectedPackage) return;

    // Check balance
    if (balance.points < selectedPackage.price) {
      showToast("error", "积分不足", `您的积分余额 (${balance.points}) 不足以购买此套餐 (${selectedPackage.price})`);
      setIsPurchaseDialogOpen(false);
      return;
    }

    setIsPurchasing(true);
    try {
      const response = await purchasePackage({ package_id: selectedPackage.id });
      
      if (response.success) {
        showToast("success", "购买成功", response.message || `成功购买 ${selectedPackage.name}`);
        // Refresh balance and my packages
        await loadBalance();
        await loadMyPackages();
        setIsPurchaseDialogOpen(false);
        setSelectedPackage(null);
      } else {
        showToast("error", "购买失败", response.message || "购买过程中出现错误");
      }
    } catch (err) {
      console.error("[PointsMall] Purchase failed:", err);
      showToast("error", "购买失败", err instanceof Error ? err.message : "购买过程中出现错误");
    } finally {
      setIsPurchasing(false);
    }
  };

  return (
    <div className="min-h-full bg-slate-50/50 p-4 lg:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">积分商城</h1>
              <p className="text-sm text-slate-500">使用积分购买算力套餐</p>
            </div>
          </div>

          {/* Balance Card */}
          <Card className="bg-gradient-to-br from-amber-500 to-orange-600 border-0 shadow-lg shadow-amber-500/20">
            <CardContent className="flex items-center gap-4 py-3 px-4">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <Coins className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-amber-100 text-xs font-medium">当前积分</p>
                {balanceLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                ) : (
                  <p className="text-2xl font-bold text-white">{formatNumber(balance.points)}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200">
          <button
            onClick={() => setActiveTab("shop")}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors relative",
              activeTab === "shop"
                ? "text-amber-600"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              商品列表
            </div>
            {activeTab === "shop" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500" />
            )}
          </button>
          <button
            onClick={() => setActiveTab("my-packages")}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors relative",
              activeTab === "my-packages"
                ? "text-amber-600"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              我的套餐
              {myPackages.length > 0 && (
                <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">
                  {myPackages.length}
                </Badge>
              )}
            </div>
            {activeTab === "my-packages" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500" />
            )}
          </button>
        </div>

        {/* Shop Tab */}
        {activeTab === "shop" && (
          <>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-4" />
                <p className="text-slate-500">加载商品中...</p>
              </div>
            ) : packages.length === 0 ? (
              <div className="text-center py-20">
                <ShoppingBag className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">暂无商品</h3>
                <p className="text-slate-500">商品正在上架中，请稍后再来</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {packages.map((pkg) => {
                  const typeInfo = getPackageTypeInfo(pkg.type);
                  const IconComponent = typeInfo.icon;
                  const canAfford = balance.points >= pkg.price;

                  return (
                    <Card
                      key={pkg.id}
                      className="group flex flex-col border-slate-200 transition-all duration-300 hover:shadow-lg hover:border-amber-200"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between mb-3">
                          <div
                            className={cn(
                              "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                              typeInfo.color,
                              "bg-opacity-10"
                            )}
                          >
                            <IconComponent className={cn("w-6 h-6", typeInfo.textColor)} />
                          </div>
                          <Badge variant="outline" className={cn("text-xs", typeInfo.textColor)}>
                            {typeInfo.label}
                          </Badge>
                        </div>
                        <CardTitle className="text-lg">{pkg.name}</CardTitle>
                        <CardDescription className="line-clamp-2">
                          {pkg.description}
                        </CardDescription>
                      </CardHeader>

                      <CardContent className="flex-1 space-y-3">
                        {/* Specs */}
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-slate-600">
                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                            <span>{pkg.specs}</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-600">
                            <Wallet className="w-4 h-4 text-blue-500" />
                            <span>包含 {formatNumber(pkg.credits)} 积分</span>
                          </div>
                          <div className="flex items-center gap-2 text-slate-600">
                            <Clock className="w-4 h-4 text-amber-500" />
                            <span>有效期 {pkg.duration_days} 天</span>
                          </div>
                        </div>
                      </CardContent>

                      <CardFooter className="flex items-center justify-between border-t border-slate-100 pt-4">
                        <div className="flex items-center gap-1 text-xl font-bold text-amber-600">
                          <Coins className="w-5 h-5" />
                          {formatNumber(pkg.price)}
                        </div>
                        <Button
                          onClick={() => handlePurchaseClick(pkg)}
                          disabled={!canAfford}
                          className={cn(
                            "transition-all",
                            canAfford
                              ? "bg-amber-500 hover:bg-amber-600 text-white"
                              : "bg-slate-100 text-slate-400 cursor-not-allowed"
                          )}
                        >
                          {canAfford ? "立即购买" : "积分不足"}
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* My Packages Tab */}
        {activeTab === "my-packages" && (
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-amber-600" />
                我的套餐
              </CardTitle>
              <CardDescription>查看您购买的所有算力套餐</CardDescription>
            </CardHeader>
            <CardContent>
              {myPackagesLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-4" />
                  <p className="text-slate-500">加载中...</p>
                </div>
              ) : myPackages.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">暂无套餐</h3>
                  <p className="text-slate-500 mb-4">您还没有购买任何套餐</p>
                  <Button
                    onClick={() => setActiveTab("shop")}
                    className="bg-amber-500 hover:bg-amber-600 text-white"
                  >
                    去商城看看
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {myPackages.map((pkg) => {
                    const statusBadge = getStatusBadge(pkg.status, pkg.expires_at);
                    const usagePercent = pkg.credits_total > 0
                      ? Math.round((pkg.credits_used / pkg.credits_total) * 100)
                      : 0;

                    return (
                      <div
                        key={pkg.id}
                        className="flex items-start gap-4 p-4 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                      >
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center flex-shrink-0">
                          <Package className="w-6 h-6 text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="text-base font-semibold text-slate-900 truncate">
                              {pkg.package_name}
                            </h4>
                            <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                          </div>
                          <p className="text-sm text-slate-500 mb-2">
                            有效期至 {formatDate(pkg.expires_at)}
                          </p>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs text-slate-600">
                              <span>积分使用</span>
                              <span>
                                {formatNumber(pkg.credits_used)} / {formatNumber(pkg.credits_total)}
                              </span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={cn(
                                  "h-full rounded-full transition-all",
                                  usagePercent > 90 ? "bg-red-500" : "bg-amber-500"
                                )}
                                style={{ width: `${Math.min(usagePercent, 100)}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Purchase Confirmation Dialog */}
        <Dialog open={isPurchaseDialogOpen} onOpenChange={setIsPurchaseDialogOpen}>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-amber-600" />
                确认购买
              </DialogTitle>
              <DialogDescription>
                请确认购买以下套餐
              </DialogDescription>
            </DialogHeader>

            {selectedPackage && (
              <div className="space-y-4 py-4">
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-slate-900">{selectedPackage.name}</h4>
                    <Badge variant="outline">{getPackageTypeInfo(selectedPackage.type).label}</Badge>
                  </div>
                  <p className="text-sm text-slate-500 mb-3">{selectedPackage.description}</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2 text-slate-600">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      <span>{selectedPackage.specs}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Wallet className="w-4 h-4 text-blue-500" />
                      <span>包含 {formatNumber(selectedPackage.credits)} 积分</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Clock className="w-4 h-4 text-amber-500" />
                      <span>有效期 {selectedPackage.duration_days} 天</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <span className="text-sm text-slate-600">支付金额</span>
                  <div className="flex items-center gap-1 text-xl font-bold text-amber-600">
                    <Coins className="w-5 h-5" />
                    {formatNumber(selectedPackage.price)}
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">购买后余额</span>
                  <span className={cn(
                    "font-medium",
                    balance.points - selectedPackage.price < 0 ? "text-red-500" : "text-slate-900"
                  )}>
                    {formatNumber(balance.points - selectedPackage.price)} 积分
                  </span>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsPurchaseDialogOpen(false)}
                disabled={isPurchasing}
              >
                取消
              </Button>
              <Button
                onClick={handleConfirmPurchase}
                disabled={isPurchasing || (selectedPackage ? balance.points < selectedPackage.price : true)}
                className="bg-amber-500 hover:bg-amber-600 text-white"
              >
                {isPurchasing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    处理中...
                  </>
                ) : (
                  "确认购买"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Toast Notifications */}
        <div className="fixed bottom-4 right-4 z-50 space-y-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={cn(
                "flex items-start gap-3 p-4 rounded-lg shadow-lg min-w-[300px] max-w-[400px] animate-in slide-in-from-right-2",
                toast.type === "success"
                  ? "bg-emerald-50 border border-emerald-200"
                  : "bg-red-50 border border-red-200"
              )}
            >
              <div className="flex-shrink-0 mt-0.5">
                {toast.type === "success" ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "font-medium",
                  toast.type === "success" ? "text-emerald-900" : "text-red-900"
                )}>
                  {toast.title}
                </p>
                <p className={cn(
                  "text-sm",
                  toast.type === "success" ? "text-emerald-700" : "text-red-700"
                )}>
                  {toast.message}
                </p>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="flex-shrink-0 text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
