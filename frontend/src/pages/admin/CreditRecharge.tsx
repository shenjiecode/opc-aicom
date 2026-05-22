import { useState } from "react";
import {
  Shell,
  User,
  Coins,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ArrowRight,
  Calculator,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import { rechargeCredits } from "@/lib/api/credit";
import type { RechargeResponse } from "@/types/credit";

export default function CreditRechargePage() {
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RechargeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const haibeiAmount = parseInt(amount) * 10; // 1 RMB = 10 Haibei

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim() || !amount.trim()) {
      setError("请填写完整的用户信息");
      return;
    }

    const rmbAmount = parseFloat(amount);
    if (isNaN(rmbAmount) || rmbAmount <= 0) {
      setError("充值金额必须大于 0");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const response = await rechargeCredits({
        email: email.trim(),
        amount: rmbAmount * 10, // Convert to Haibei
      });

      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "充值失败，请稍后重试");
      console.error("[CreditRecharge] Failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setEmail("");
    setAmount("");
    setResult(null);
    setError(null);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Shell className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">海贝充值</h1>
            <p className="text-sm text-slate-500">为用户充值海贝积分</p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-3 p-4 mb-6 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Success Message */}
      {result?.success && (
        <div className="flex items-center gap-3 p-4 mb-6 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-700">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-medium">充值成功！</p>
            <p className="text-sm text-emerald-600">{result.message}</p>
          </div>
        </div>
      )}

      {/* Recharge Form */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-violet-500" />
            充值信息
          </CardTitle>
          <CardDescription>
            输入用户邮箱和充值金额，1 RMB = 10 海贝
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* User Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                用户邮箱 <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="pl-10 border-slate-200 focus:border-violet-400 focus:ring-violet-400"
                />
              </div>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-sm font-medium text-slate-700">
                充值金额 (RMB) <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Coins className="w-4 h-4" />
                </div>
                <Input
                  id="amount"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="例如：100"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={loading}
                  className="pl-10 border-slate-200 focus:border-violet-400 focus:ring-violet-400"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                  元
                </div>
              </div>
              <p className="text-xs text-slate-500">
                最小充值金额 1 元，请输入正整数
              </p>
            </div>

            {/* Preview */}
            {amount && parseInt(amount) > 0 && (
              <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl p-4 border border-violet-200">
                <div className="flex items-center gap-2 mb-3">
                  <Calculator className="w-4 h-4 text-violet-600" />
                  <span className="text-sm font-medium text-violet-900">充值预览</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-xs text-slate-500 mb-1">充值金额</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {amount}
                        <span className="text-sm font-normal text-slate-500 ml-1">元</span>
                      </p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-400" />
                    <div className="text-center">
                      <p className="text-xs text-slate-500 mb-1">海贝数量</p>
                      <p className="text-2xl font-bold text-violet-600">
                        {haibeiAmount.toLocaleString("zh-CN")}
                        <span className="text-sm font-normal text-violet-400 ml-1">海贝</span>
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-violet-200 text-violet-600 bg-violet-50"
                  >
                    1:10 汇率
                  </Badge>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={loading}
                className="flex-1 border-slate-200 text-slate-600"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                重置
              </Button>
              <Button
                type="submit"
                disabled={loading || !email.trim() || !amount.trim()}
                className="flex-1 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    处理中...
                  </>
                ) : (
                  <>
                    <Coins className="w-4 h-4 mr-2" />
                    确认充值
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Instructions Card */}
      <Card className="mt-6 border-slate-200 bg-slate-50/50">
        <CardHeader>
          <CardTitle className="text-base">充值说明</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-slate-600">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-1.5 flex-shrink-0" />
              <span>充值汇率固定为 1 RMB = 10 海贝</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-1.5 flex-shrink-0" />
              <span>充值后海贝将立即到账，用户可在个人中心查看余额</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-1.5 flex-shrink-0" />
              <span>充值记录将生成一条交易明细，用户可在海贝明细中查看</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-1.5 flex-shrink-0" />
              <span>请仔细核对用户邮箱，确保充值到正确的账户</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
