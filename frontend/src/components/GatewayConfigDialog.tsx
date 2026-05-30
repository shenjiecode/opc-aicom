import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Copy,
  Eye,
  EyeOff,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Globe,
  Key,
  BarChart3,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

interface GatewayConfig {
  api_key: string;
  gateway_url: string;
  quota: number;
  used_tokens: number;
  remaining: number;
  usage_percent: number;
}

interface GatewayConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function maskApiKey(key: string): string {
  if (!key || key.length < 4) return key;
  return `****${key.slice(-4)}`;
}

function formatNumber(num: number): string {
  return num.toLocaleString("zh-CN");
}

export function GatewayConfigDialog({
  open,
  onOpenChange,
}: GatewayConfigDialogProps) {
  const [config, setConfig] = useState<GatewayConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfig(null);
      setError(null);
      setShowKey(false);
      return;
    }

    const fetchConfig = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<GatewayConfig>("/gateway/config");
        setConfig(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "加载配置失败");
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [open]);

  const handleCopy = async (
    text: string,
    setCopied: (value: boolean) => void
  ) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("[GatewayConfigDialog] Failed to copy:", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <Globe className="w-4 h-4 text-blue-600" />
            </div>
            Gateway 配置
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center gap-3 py-8">
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
            <span className="text-slate-500">加载中...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {!loading && !error && config && (
          <div className="space-y-5">
            {/* API Key */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Key className="w-3.5 h-3.5 text-slate-400" />
                API Key
              </label>
              <div className="flex gap-2">
                <Input
                  value={showKey ? config.api_key : maskApiKey(config.api_key)}
                  readOnly
                  className="font-mono text-sm bg-slate-50 border-slate-200 flex-1"
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
                  onClick={() => handleCopy(config.api_key, setCopiedKey)}
                  className="flex-shrink-0 border-slate-200"
                  title="复制"
                >
                  {copiedKey ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-slate-500" />
                  )}
                </Button>
              </div>
            </div>

            {/* Gateway URL */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-slate-400" />
                Gateway URL
              </label>
              <div className="flex gap-2">
                <Input
                  value={config.gateway_url}
                  readOnly
                  className="font-mono text-sm bg-slate-50 border-slate-200 flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => handleCopy(config.gateway_url, setCopiedUrl)}
                  className="flex-shrink-0 border-slate-200"
                  title="复制"
                >
                  {copiedUrl ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-slate-500" />
                  )}
                </Button>
              </div>
            </div>

            {/* Quota Info */}
            <div className="space-y-3 pt-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <BarChart3 className="w-3.5 h-3.5 text-slate-400" />
                配额使用
              </label>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">使用率</span>
                  <span className="font-medium text-slate-700">
                    {config.usage_percent.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      config.usage_percent > 80
                        ? "bg-rose-500"
                        : config.usage_percent > 50
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    )}
                    style={{ width: `${Math.min(100, config.usage_percent)}%` }}
                  />
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <div className="text-xs text-slate-500 mb-1">总额</div>
                  <div className="text-sm font-semibold text-slate-900">
                    {formatNumber(config.quota)}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <div className="text-xs text-slate-500 mb-1">已用</div>
                  <div className="text-sm font-semibold text-slate-900">
                    {formatNumber(config.used_tokens)}
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                  <div className="text-xs text-slate-500 mb-1">剩余</div>
                  <div className="text-sm font-semibold text-blue-600">
                    {formatNumber(config.remaining)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
