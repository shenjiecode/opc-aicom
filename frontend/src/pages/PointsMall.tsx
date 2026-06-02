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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { getPackages, getBalance, purchasePackage, getMyPackages, purchaseQoder } from "@/lib/api/mall";
import type { MallPackage, MallBalance, MyPackage } from "@/types/mall";
import { useAuth } from "@/contexts/AuthContext";

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
  // Auth context for global user state
  const { user, refreshUser } = useAuth();

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
  const [isQoderDialogOpen, setIsQoderDialogOpen] = useState(false);
  const [qoderEmail, setQoderEmail] = useState("");
  const [isQoderPurchasing, setIsQoderPurchasing] = useState(false);

  // Use auth user assets as primary source for points display
  const displayPoints = user?.assets?.points ?? balance.points;

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
        // Refresh global user state
        await refreshUser();
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

  // Handle Qoder purchase click
  const handleQoderPurchaseClick = () => {
    if (balance.points < 300) {
      showToast("error", "积分不足", `您的积分余额 (${balance.points}) 不足以购买此账号 (300)`);
      return;
    }
    setIsQoderDialogOpen(true);
  };

  // Confirm Qoder purchase
  const handleConfirmQoderPurchase = async () => {
    if (!qoderEmail || !qoderEmail.includes("@")) {
      showToast("error", "参数错误", "请输入有效的邮箱地址");
      return;
    }

    setIsQoderPurchasing(true);
    try {
      const response = await purchaseQoder({ email: qoderEmail });

      if (response.code === 0) {
        showToast("success", "购买成功", `Qoder账号：${response.data.account_email}，有效期至 ${response.data.expires_at}`);
        await loadBalance();
        // Refresh global user state
        await refreshUser();
        setIsQoderDialogOpen(false);
        setQoderEmail("");
      } else if (response.code === 402) {
        showToast("error", "积分不足", "您的积分不足以购买此账号");
      } else {
        showToast("error", "购买失败", response.message || "购买过程中出现错误");
      }
    } catch (err) {
      console.error("[PointsMall] Qoder purchase failed:", err);
      showToast("error", "购买失败", err instanceof Error ? err.message : "购买过程中出现错误");
    } finally {
      setIsQoderPurchasing(false);
    }
  };

  return (
    <div className="min-h-screen bg-white w-full overflow-x-hidden flex flex-col">
      {/* Header - Sticky with backdrop blur */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-6 h-[var(--header-height)] shrink-0">
        <div className="flex items-center space-x-3">
          <span className="text-2xl">🛒</span>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">积分商城</h1>
          <div className="h-4 w-px bg-slate-200 mx-2"></div>
          <p className="text-sm text-slate-500 hidden md:block">使用积分兑换算力套餐与AI工具</p>
        </div>
        <div className="flex items-center space-x-4">
          {/* Balance Badge */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 shadow-lg shadow-amber-500/20">
            <Coins className="w-4 h-4 text-white" />
            {balanceLoading && <Loader2 className="w-4 h-4 animate-spin text-white" />}
          </div>
        </div>
      </div>

      <div className="px-6 py-6 flex-1 max-w-[1400px]">
        {/* Tabs - Pill style */}
        <div className="flex space-x-3 mb-8">
          <button
            onClick={() => setActiveTab('shop')}
            className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all flex items-center space-x-2 ${
              activeTab === 'shop'
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>🛒</span>
            <span>商品列表</span>
          </button>
          <button
            onClick={() => setActiveTab('my-packages')}
            className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all flex items-center space-x-2 ${
              activeTab === 'my-packages'
                ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>📦</span>
            <span>我的套餐</span>
            {myPackages.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-400/30 text-xs">
                {myPackages.length}
              </span>
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
              <>
                {/* Qoder Account Featured Product - Modern Card Style */}
                <div className="bg-white border border-slate-100 rounded-2xl p-6 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300 group mb-6">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-2xl mb-5">
                    <Zap className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">
                    Qoder 账号
                  </h3>
                  <div className="text-xs font-medium text-slate-500 mb-4">AI 工具</div>
                  <p className="text-sm text-slate-600 leading-relaxed mb-5">
                    专业AI代码助手，智能编程伴侣，提升开发效率
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mb-6">
                    <div className="px-2.5 py-1 bg-emerald-50 rounded-md text-[11px] font-medium text-emerald-600">
                      无限次AI代码生成
                    </div>
                    <div className="px-2.5 py-1 bg-amber-50 rounded-md text-[11px] font-medium text-amber-600">
                      有效期 30 天
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <div className="text-lg font-bold text-blue-600">
                      300 <span className="text-sm font-medium">积分</span>
                    </div>
                    <button
                      onClick={handleQoderPurchaseClick}
                      disabled={balance.points < 300}
                      className={cn(
                        "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                        balance.points >= 300
                          ? "bg-blue-100 hover:bg-blue-500 hover:text-white text-blue-700"
                          : "bg-slate-100 text-slate-400 cursor-not-allowed"
                      )}
                    >
                      {balance.points >= 300 ? "立即购买" : "积分不足"}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {packages.map((pkg) => {
                    const typeInfo = getPackageTypeInfo(pkg.type);
                    const IconComponent = typeInfo.icon;
                    const canAfford = balance.points >= pkg.price;

                    return (
                      <div
                        key={pkg.id}
                        className="bg-white border border-slate-100 rounded-2xl p-6 hover:shadow-xl hover:shadow-amber-500/5 transition-all duration-300 group flex flex-col h-full"
                      >
                        {/* Icon */}
                        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-5", typeInfo.color.replace('bg-', 'bg-').replace('500', '50'))}>
                          <IconComponent className={cn("w-6 h-6", typeInfo.textColor)} />
                        </div>
                        
                        {/* Content */}
                        <h3 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-amber-600 transition-colors">
                          {pkg.name}
                        </h3>
                        <div className="text-xs font-medium text-slate-500 mb-4">{typeInfo.label}</div>
                        <p className="text-sm text-slate-600 leading-relaxed mb-5 line-clamp-3 flex-1">
                          {pkg.description}
                        </p>

                        {/* Meta row */}
                        <div className="flex flex-wrap items-center gap-2 mb-6">
                          <div className="px-2.5 py-1 bg-emerald-50 rounded-md text-[11px] font-medium text-emerald-600">
                            {pkg.specs}
                          </div>
                          <div className="px-2.5 py-1 bg-blue-50 rounded-md text-[11px] font-medium text-blue-600">
                            {formatNumber(pkg.credits)} 积分
                          </div>
                          <div className="px-2.5 py-1 bg-amber-50 rounded-md text-[11px] font-medium text-amber-600">
                            有效期 {pkg.duration_days} 天
                          </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-50">
                          <div className="text-lg font-bold text-amber-600">
                            {formatNumber(pkg.price)} <span className="text-sm font-medium">积分</span>
                          </div>
                          <button
                            onClick={() => handlePurchaseClick(pkg)}
                            disabled={!canAfford}
                            className={cn(
                              "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                              canAfford
                                ? "bg-amber-100 hover:bg-amber-500 hover:text-white text-amber-700"
                                : "bg-slate-100 text-slate-400 cursor-not-allowed"
                            )}
                          >
                            {canAfford ? "立即购买" : "积分不足"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
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

        {/* Qoder Purchase Dialog */}
        <Dialog open={isQoderDialogOpen} onOpenChange={setIsQoderDialogOpen}>
          <DialogContent className="sm:max-w-[450px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-blue-600" />
                购买 Qoder 账号
              </DialogTitle>
              <DialogDescription>
                请输入您的邮箱地址，用于接收 Qoder 账号凭证
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-slate-900">Qoder 账号</h4>
                  <Badge variant="outline">AI 工具</Badge>
                </div>
                <p className="text-sm text-slate-500 mb-3">专业AI代码助手</p>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2 text-slate-600">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    <span>每月无限次AI代码生成</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    <span>支持多种主流编程语言</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <span>有效期 30 天</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">邮箱地址</label>
                <input
                  type="email"
                  value={qoderEmail}
                  onChange={(e) => setQoderEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200">
                <span className="text-sm text-slate-600">支付金额</span>
                <div className="flex items-center gap-1 text-xl font-bold text-amber-600">
                  <Coins className="w-5 h-5" />
                  300
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">购买后余额</span>
                <span className={cn(
                  "font-medium",
                  balance.points - 300 < 0 ? "text-red-500" : "text-slate-900"
                )}>
                  {formatNumber(balance.points - 300)} 积分
                </span>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsQoderDialogOpen(false);
                  setQoderEmail("");
                }}
                disabled={isQoderPurchasing}
              >
                取消
              </Button>
              <Button
                onClick={handleConfirmQoderPurchase}
                disabled={isQoderPurchasing || balance.points < 300 || !qoderEmail}
                className="bg-blue-500 hover:bg-blue-600 text-white"
              >
                {isQoderPurchasing ? (
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
