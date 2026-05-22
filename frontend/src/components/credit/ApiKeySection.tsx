import { useState, useEffect } from "react";
import {
  Key,
  Copy,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Eye,
  EyeOff,
  BarChart3,
  Coins,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { getMyGateway, createGateway, revokeGateway } from "@/lib/api/credit";
import type { LLMGateway } from "@/types/credit";

interface ApiKeySectionProps {
  className?: string;
}

function formatNumber(num: number): string {
  return num.toLocaleString("zh-CN");
}

function maskApiKey(key: string): string {
  if (!key || key.length < 12) return key;
  const prefix = key.slice(0, 7); // sk-xxx
  const suffix = key.slice(-6);
  return `${prefix}****...****${suffix}`;
}

export default function ApiKeySection({ className }: ApiKeySectionProps) {
  const [gateway, setGateway] = useState<LLMGateway | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadGateway();
  }, []);

  const loadGateway = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMyGateway();
      setGateway(data);
    } catch (err) {
      setError("加载 API Key 失败");
      console.error("[ApiKeySection] Failed to load gateway:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!gateway?.api_key) return;
    try {
      await navigator.clipboard.writeText(gateway.api_key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("[ApiKeySection] Failed to copy:", err);
    }
  };

  const handleCreate = async () => {
    try {
      setCreating(true);
      setError(null);
      const data = await createGateway();
      setGateway(data);
    } catch (err) {
      setError("创建 API Key 失败，请稍后重试");
      console.error("[ApiKeySection] Failed to create gateway:", err);
    } finally {
      setCreating(false);
    }
  };

  const handleRegenerate = async () => {
    try {
      setRegenerating(true);
      setError(null);
      // Revoke old and create new
      await revokeGateway();
      const data = await createGateway();
      setGateway(data);
      setShowRegenerateDialog(false);
    } catch (err) {
      setError("重新生成 API Key 失败，请稍后重试");
      console.error("[ApiKeySection] Failed to regenerate gateway:", err);
    } finally {
      setRegenerating(false);
    }
  };

  const usagePercentage = gateway?.quota
    ? Math.min(100, (gateway.credits_used / gateway.quota) * 100)
    : 0;

  if (loading) {
    return (
      <Card className={cn("border-slate-200", className)}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
            <span className="text-slate-500">加载中...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No gateway exists yet - show create button
  if (!gateway) {
    return (
      <Card className={cn("border-slate-200", className)}>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-violet-50 flex items-center justify-center">
              <Key className="w-3.5 h-3.5 text-violet-600" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold text-slate-900">API Key</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                为您的 Agent 配置专属 API Key
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
              <Key className="w-8 h-8 text-slate-400" />
            </div>
            <div className="text-center">
              <p className="text-sm text-slate-500 mb-4">
                您还没有创建 API Key，创建后即可用于 AgentBaba 智能体
              </p>
              <Button
                onClick={handleCreate}
                disabled={creating}
                className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
              >
                {creating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    创建中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    创建 API Key
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={cn("border-slate-200", className)}>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-violet-50 flex items-center justify-center">
              <Key className="w-3.5 h-3.5 text-violet-600" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold text-slate-900">API Key</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                您的专属 API Key 和配额信息
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* API Key Display */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-700">API Key</label>
            <div className="flex gap-2">
              <Input
                value={showKey ? gateway.api_key : maskApiKey(gateway.api_key)}
                readOnly
                className="font-mono text-sm bg-slate-50 border-slate-200"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowKey(!showKey)}
                className="flex-shrink-0 border-slate-200"
                title={showKey ? "隐藏" : "显示"}
              >
                {showKey ? (
                  <EyeOff className="w-4 h-4 text-slate-500" />
                ) : (
                  <Eye className="w-4 h-4 text-slate-500" />
                )}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className="flex-shrink-0 border-slate-200"
                title="复制"
              >
                {copied ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Copy className="w-4 h-4 text-slate-500" />
                )}
              </Button>
            </div>
            <p className="text-[10px] text-slate-500">
              妥善保管您的 API Key，不要分享给他人
            </p>
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-700">状态：</span>
            <Badge
              variant={gateway.status === "active" ? "default" : "destructive"}
              className={cn(
                gateway.status === "active" &&
                  "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
              )}
            >
              {gateway.status === "active" ? "正常" : "已撤销"}
            </Badge>
          </div>

          {/* Usage Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="w-4 h-4 text-violet-500" />
                <span className="text-xs text-slate-500">已用额度</span>
              </div>
              <p className="text-lg font-semibold text-slate-900">
                {formatNumber(gateway.credits_used)}
              </p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-indigo-500" />
                <span className="text-xs text-slate-500">Token 使用量</span>
              </div>
              <p className="text-lg font-semibold text-slate-900">
                {formatNumber(gateway.used_tokens)}
              </p>
            </div>
          </div>

          {/* Quota Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">配额使用</span>
              <span className="font-medium text-slate-700">
                {usagePercentage.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  usagePercentage > 80
                    ? "bg-rose-500"
                    : usagePercentage > 50
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                )}
                style={{ width: `${usagePercentage}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">
                已用: {formatNumber(gateway.credits_used)}
              </span>
              <span className="text-slate-400">
                总额: {formatNumber(gateway.quota)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRegenerateDialog(true)}
              className="flex-1 border-slate-200 text-slate-600"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              重新生成
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Regenerate Confirmation Dialog */}
      <Dialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <DialogContent className="bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              确认重新生成 API Key？
            </DialogTitle>
            <DialogDescription>
              重新生成后，旧 API Key 将立即失效。使用旧 Key 的 Agent 将无法正常工作，需要更新配置。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowRegenerateDialog(false)}
              disabled={regenerating}
              className="border-slate-200"
            >
              取消
            </Button>
            <Button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
            >
              {regenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  处理中...
                </>
              ) : (
                "确认重新生成"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
