import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { register } from "@/lib/api";
import { Cpu, AlertCircle, Loader2, CheckCircle } from "lucide-react";

export default function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!username.trim()) {
      setError("请输入用户名");
      return;
    }

    if (username.trim().length < 3) {
      setError("用户名至少需要 3 个字符");
      return;
    }

    if (!password.trim()) {
      setError("请输入密码");
      return;
    }

    if (password.length < 6) {
      setError("密码至少需要 6 个字符");
      return;
    }

    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    setIsLoading(true);

    try {
      await register(username, password);
      setSuccess("注册成功！即将跳转到登录页面...");
      setTimeout(() => {
        navigate("/login");
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败，请重试");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-12">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-200/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-200/30 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md relative z-10 shadow-xl border-slate-200/60">
        <CardHeader className="space-y-6 pb-8">
          {/* Logo */}
          <div className="flex flex-col items-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#6C5CE7] to-[#A29BFE] flex items-center justify-center shadow-lg shadow-purple-500/25">
              <Cpu className="w-8 h-8 text-white" />
            </div>
            <div className="text-center">
              <CardTitle className="text-2xl font-bold text-slate-900">
                创建账号
              </CardTitle>
              <CardDescription className="text-slate-500 mt-1">
                加入 OPC 赋能中心，开启 AI 之旅
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-slate-700 font-medium">
                用户名
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="请输入用户名（至少3个字符）"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                className="h-11 border-slate-200 focus:border-[#6C5CE7] focus:ring-[#6C5CE7]/20 transition-all"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700 font-medium">
                密码
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="请输入密码（至少6个字符）"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="h-11 border-slate-200 focus:border-[#6C5CE7] focus:ring-[#6C5CE7]/20 transition-all"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="confirmPassword"
                className="text-slate-700 font-medium"
              >
                确认密码
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="请再次输入密码"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                className="h-11 border-slate-200 focus:border-[#6C5CE7] focus:ring-[#6C5CE7]/20 transition-all"
              />
            </div>

            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Success message */}
            {success && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-100 text-green-600 text-sm">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-gradient-to-r from-[#6C5CE7] to-[#A29BFE] hover:from-[#5A4BD1] hover:to-[#8B7AE8] text-white font-medium shadow-lg shadow-purple-500/25 transition-all duration-200 disabled:opacity-70"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  注册中...
                </>
              ) : (
                "创建账号"
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-white text-slate-400">已有账号？</span>
            </div>
          </div>

          {/* Login link */}
          <div className="text-center">
            <Link
              to="/login"
              className="inline-flex items-center justify-center w-full h-10 px-4 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 hover:border-slate-300 transition-all duration-200"
            >
              立即登录
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="fixed bottom-6 left-0 right-0 text-center text-slate-400 text-sm">
        © 2026 OPC 赋能中心. All rights reserved.
      </div>
    </div>
  );
}