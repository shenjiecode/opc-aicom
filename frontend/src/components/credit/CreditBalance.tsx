import { useState, useEffect } from "react";
import { Shell, Loader2, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getCreditBalance } from "@/lib/api/credit";
import type { CreditBalance } from "@/types/credit";

interface CreditBalanceProps {
  className?: string;
  showIcon?: boolean;
  showLabel?: boolean;
  compact?: boolean;
}

function formatNumber(num: number): string {
  return num.toLocaleString("zh-CN");
}

export default function CreditBalance({
  className,
  showIcon = true,
  showLabel = true,
  compact = false,
}: CreditBalanceProps) {
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);

  useEffect(() => {
    loadBalance();
  }, []);

  const loadBalance = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCreditBalance();
      setBalance(data);
    } catch (err) {
      setError("获取余额失败");
      console.error("[CreditBalance] Failed to load balance:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleShowHistory = () => {
    // Navigate to history page instead of showing dialog
    window.location.href = "/credit/history";
  };

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 bg-gradient-to-r from-violet-600/10 to-indigo-600/10",
          "border border-violet-500/20 rounded-full px-3 py-1.5",
          "hover:border-violet-500/40 transition-colors cursor-pointer",
          className
        )}
        onClick={handleShowHistory}
      >
        {showIcon && (
          <Shell className="w-4 h-4 text-violet-500" />
        )}
        {loading ? (
          <Loader2 className="w-3 h-3 animate-spin text-violet-500" />
        ) : (
          <span className="text-sm font-medium text-violet-600 dark:text-violet-400">
            {formatNumber(balance?.points ?? 0)} 海贝
          </span>
        )}
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-3 bg-gradient-to-r from-violet-600/10 via-purple-600/10 to-indigo-600/10",
          "border border-violet-500/20 rounded-xl px-4 py-2.5",
          "hover:border-violet-500/40 transition-all cursor-pointer group",
          className
        )}
        onClick={handleShowHistory}
      >
        {showIcon && (
          <div className="relative">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20 group-hover:shadow-violet-500/40 transition-shadow">
              <Shell className="w-4 h-4 text-white" />
            </div>
            {/* Decorative ring */}
            <div className="absolute inset-0 w-8 h-8 rounded-lg bg-gradient-to-br from-violet-400 to-purple-500 blur-md opacity-0 group-hover:opacity-50 transition-opacity" />
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          {showLabel && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">海贝余额</p>
          )}
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin text-violet-500" />
              <span className="text-sm text-slate-400">加载中...</span>
            </div>
          ) : error ? (
            <span className="text-sm text-red-500">--</span>
          ) : (
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-semibold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                {formatNumber(balance?.points ?? 0)}
              </span>
              <span className="text-xs text-slate-500">海贝</span>
            </div>
          )}
        </div>

        <History className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Quick History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shell className="w-5 h-5 text-violet-500" />
              海贝余额详情
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Balance Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl p-4 text-white">
                <p className="text-violet-100 text-sm mb-1">海贝余额</p>
                <p className="text-3xl font-bold">{formatNumber(balance?.points ?? 0)}</p>
              </div>
              <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-4">
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">优惠券</p>
                <p className="text-3xl font-bold text-slate-700 dark:text-slate-200">{balance?.coupons ?? 0}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                className="flex-1 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
                onClick={() => {
                  setShowHistoryDialog(false);
                  window.location.href = "/credit/history";
                }}
              >
                <History className="w-4 h-4 mr-2" />
                查看明细
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
