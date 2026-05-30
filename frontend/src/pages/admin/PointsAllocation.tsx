import { useState, useEffect } from "react";
import {
  Coins,
  User,
  Calendar,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Calculator,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";

interface User {
  id: number;
  username: string;
  email?: string;
}

interface UserSearchResponse {
  list: User[];
  total: number;
}

interface AllocationResponse {
  success: boolean;
  message: string;
  points?: number;
}

// Toast notification
interface Toast {
  id: string;
  type: "success" | "error";
  title: string;
  message: string;
}

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timers = toasts.map((toast) =>
      setTimeout(() => onDismiss(toast.id), 4000)
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts, onDismiss]);

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-start gap-3 p-4 rounded-lg shadow-lg border max-w-sm animate-in slide-in-from-right ${
            toast.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{toast.title}</p>
            <p className="text-xs opacity-80 mt-0.5">{toast.message}</p>
          </div>
          <button onClick={() => onDismiss(toast.id)} className="text-current opacity-50 hover:opacity-100">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export default function PointsAllocationPage() {
  const [email, setEmail] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const [points, setPoints] = useState<string>("");
  const [reason, setReason] = useState("");
  const [expiryDate, setExpiryDate] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Set default expiry to 1 year from now
  useEffect(() => {
    const oneYearLater = new Date();
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    setExpiryDate(oneYearLater.toISOString().split("T")[0]);
  }, []);

  // Search users by email
  const searchUsers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const result = await apiFetch<UserSearchResponse>("/admin/users/list", {
        method: "POST",
        body: JSON.stringify({
          search: query,
          page: 1,
          pageSize: 10,
        }),
      });
      setSearchResults(result.list || []);
    } catch (err) {
      console.error("Search failed:", err);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (email && !selectedUser) {
        searchUsers(email);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [email]);

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setSelectedUser(null);
    setShowDropdown(true);
  };

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setEmail(user.username || user.email || "");
    setShowDropdown(false);
    setSearchResults([]);
  };

  const addToast = (type: "success" | "error", title: string, message: string) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, title, message }]);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!selectedUser) {
      addToast("error", "操作失败", "请选择有效的用户");
      return;
    }

    const pointsNum = parseInt(points);
    if (isNaN(pointsNum) || pointsNum < 1) {
      addToast("error", "操作失败", "积分数量必须大于等于 1");
      return;
    }

    if (!reason.trim()) {
      addToast("error", "操作失败", "请填写分配原因");
      return;
    }

    try {
      setLoading(true);
      const response = await apiFetch<AllocationResponse>("/admin/points/allocate", {
        method: "POST",
        body: JSON.stringify({
          user_id: selectedUser.id,
          points: pointsNum,
          reason: reason.trim(),
          expires_at: expiryDate ? new Date(expiryDate).toISOString() : undefined,
        }),
      });

      if (response.success) {
        addToast(
          "success",
          "分配成功",
          `已成功分配 ${pointsNum} 积分给用户 ${selectedUser.username}`
        );
        // Reset form
        setEmail("");
        setSelectedUser(null);
        setPoints("");
        setReason("");
        const oneYearLater = new Date();
        oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
        setExpiryDate(oneYearLater.toISOString().split("T")[0]);
      } else {
        addToast("error", "分配失败", response.message || "操作失败，请稍后重试");
      }
    } catch (err) {
      console.error("Allocation failed:", err);
      addToast("error", "分配失败", err instanceof Error ? err.message : "操作失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setEmail("");
    setSelectedUser(null);
    setPoints("");
    setReason("");
    const oneYearLater = new Date();
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    setExpiryDate(oneYearLater.toISOString().split("T")[0]);
  };

  const pointsNum = parseInt(points) || 0;
  const isValidAllocation = selectedUser && pointsNum >= 1 && reason.trim();

  return (
    <div className="max-w-2xl mx-auto">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Coins className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">积分分配</h1>
            <p className="text-sm text-slate-500">为用户分配平台积分</p>
          </div>
        </div>
      </div>

      {/* Allocation Form */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-amber-500" />
            分配信息
          </CardTitle>
          <CardDescription>输入用户信息、积分数量和分配原因</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* User Selection */}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                用户邮箱/用户名 <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <Input
                  id="email"
                  type="text"
                  placeholder="输入邮箱或用户名搜索..."
                  value={email}
                  onChange={(e) => handleEmailChange(e.target.value)}
                  onFocus={() => setShowDropdown(true)}
                  disabled={loading}
                  className="pl-10 border-slate-200 focus:border-amber-400 focus:ring-amber-400"
                />
                {searching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                  </div>
                )}
              </div>
              {/* Dropdown */}
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleSelectUser(user)}
                      className="w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center gap-2"
                    >
                      <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                        <span className="text-amber-600 text-sm font-medium">
                          {user.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{user.username}</p>
                        {user.email && (
                          <p className="text-xs text-slate-500">{user.email}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {selectedUser && (
                <div className="flex items-center gap-2 mt-2">
                  <Badge className="bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    已选择: {selectedUser.username}
                  </Badge>
                </div>
              )}
            </div>

            {/* Points Amount */}
            <div className="space-y-2">
              <Label htmlFor="points" className="text-sm font-medium text-slate-700">
                积分数量 <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Coins className="w-4 h-4" />
                </div>
                <Input
                  id="points"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="请输入积分数量"
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  disabled={loading}
                  className="pl-10 border-slate-200 focus:border-amber-400 focus:ring-amber-400"
                />
              </div>
              <p className="text-xs text-slate-500">最小分配 1 积分，请输入正整数</p>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason" className="text-sm font-medium text-slate-700">
                分配原因 <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <div className="absolute left-3 top-3 text-slate-400">
                  <FileText className="w-4 h-4" />
                </div>
                <textarea
                  id="reason"
                  placeholder="请输入分配原因..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={loading}
                  rows={3}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-amber-400 resize-none"
                />
              </div>
            </div>

            {/* Expiry Date */}
            <div className="space-y-2">
              <Label htmlFor="expiry" className="text-sm font-medium text-slate-700">
                过期时间 <span className="text-slate-400">(可选)</span>
              </Label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Calendar className="w-4 h-4" />
                </div>
                <Input
                  id="expiry"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  disabled={loading}
                  className="pl-10 border-slate-200 focus:border-amber-400 focus:ring-amber-400"
                />
              </div>
              <p className="text-xs text-slate-500">默认过期时间为 1 年后</p>
            </div>

            {/* Preview */}
            {isValidAllocation && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200">
                <div className="flex items-center gap-2 mb-3">
                  <Calculator className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-900">分配预览</span>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-slate-700">
                    将分配 <span className="text-amber-600 font-bold">{pointsNum}</span> 积分给用户{" "}
                    <span className="font-medium">{selectedUser?.username}</span>
                  </p>
                  <Badge variant="outline" className="border-amber-200 text-amber-600 bg-amber-50">
                    {expiryDate ? `有效期至 ${expiryDate}` : "永久有效"}
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
                disabled={loading || !isValidAllocation}
                className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    处理中...
                  </>
                ) : (
                  <>
                    <Coins className="w-4 h-4 mr-2" />
                    确认分配
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
          <CardTitle className="text-base">分配说明</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-slate-600">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
              <span>分配的积分将立即到账，用户可在个人中心查看余额</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
              <span>积分分配记录将生成一条明细，用户可在积分明细中查看</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
              <span>请仔细核对用户信息，确保分配到正确的账户</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
              <span>分配原因将记录在案，请如实填写</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
