import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Ban,
  CheckCircle,
  Users,
  RefreshCw,
  Shield,
  User,
  UserCog,
  Building2,
} from "lucide-react";

interface User {
  id: number;
  username: string;
  role: string;
  status: "active" | "banned";
  createdAt: string;
}

interface UserListResponse {
  list: User[];
  total: number;
  page: number;
  pageSize: number;
}

interface FilterState {
  search: string;
  role: string;
  status: string;
}

const ROLES = [
  { value: "", label: "全部角色" },
  { value: "admin", label: "管理员" },
  { value: "community_admin", label: "社区管理员" },
  { value: "user", label: "普通用户" },
];

const STATUSES = [
  { value: "", label: "全部状态" },
  { value: "active", label: "正常" },
  { value: "banned", label: "已封禁" },
];

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    role: "",
    status: "",
  });
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [roleChangeUser, setRoleChangeUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [roleChangeLoading, setRoleChangeLoading] = useState(false);


  useEffect(() => {
    fetchUsers();
  }, [page, filters.role, filters.status]);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<UserListResponse>("/admin/users/list", {
        method: "POST",
        body: JSON.stringify({
          page,
          pageSize,
          search: filters.search,
          role: filters.role,
          status: filters.status,
        }),
      });
      setUsers(result.list || []);
      setTotal(result.total || 0);
    } catch (err) {
      console.error("Failed to fetch users:", err);
      setError("加载用户数据失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchUsers();
  };

  const handleBanUser = async (userId: number, currentStatus: string) => {
    setActionLoading(userId);
    try {
      const newStatus = currentStatus === "active" ? "banned" : "active";
      await apiFetch("/admin/users/ban", {
        method: "POST",
        body: JSON.stringify({
          userId,
          status: newStatus,
        }),
      });
      // Refresh the list
      fetchUsers();
    } catch (err) {
      console.error("Failed to update user status:", err);
      alert("操作失败，请稍后重试");
    } finally {
      setActionLoading(null);
    }
  };

  const handleChangeRole = async () => {
    if (!roleChangeUser || !selectedRole) return;

    setRoleChangeLoading(true);
    try {
      await apiFetch(`/admin/users/${roleChangeUser.id}/role`, {
        method: "POST",
        body: JSON.stringify({
          role: selectedRole,
        }),
      });
      // Refresh the list
      fetchUsers();
      setRoleChangeUser(null);
      setSelectedRole("");
    } catch (err) {
      console.error("Failed to change user role:", err);
      alert("修改角色失败，请稍后重试");
    } finally {
      setRoleChangeLoading(false);
    }
  };

  const openRoleChangeDialog = (user: User) => {
    setRoleChangeUser(user);
    setSelectedRole(user.role);
  };

  const getRoleLabel = (role: string) => {
    const roleMap: Record<string, string> = {
      admin: "管理员",
      community_admin: "社区管理员",
      user: "普通用户",
    };
    return roleMap[role] || role;
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-purple-100 text-purple-700";
      case "community_admin":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin":
        return <Shield className="w-3 h-3 mr-1" />;
      case "community_admin":
        return <Building2 className="w-3 h-3 mr-1" />;
      default:
        return <User className="w-3 h-3 mr-1" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">用户管理</h2>
          <p className="text-slate-500 mt-1">管理平台用户，查看和编辑用户信息</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Users className="w-4 h-4" />
          <span>共 {total} 位用户</span>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-slate-200">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="搜索用户名..."
                className="pl-10"
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>

            {/* Role Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                className="h-9 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-slate-950"
                value={filters.role}
                onChange={(e) => setFilters((prev) => ({ ...prev, role: e.target.value }))}
              >
                {ROLES.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <select
                className="h-9 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-slate-950"
                value={filters.status}
                onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
              >
                {STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Button */}
            <Button onClick={handleSearch}>
              <Search className="w-4 h-4 mr-2" />
              搜索
            </Button>

            {/* Refresh Button */}
            <Button variant="outline" onClick={fetchUsers} disabled={loading}>
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900">用户列表</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-500 border-r-transparent" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-500 mb-4">{error}</p>
              <Button onClick={fetchUsers}>重试</Button>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">暂无用户数据</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">ID</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">用户名</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">角色</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">状态</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">创建时间</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 text-sm text-slate-600">#{user.id}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                            <span className="text-indigo-600 text-sm font-medium">
                              {user.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-slate-900">{user.username}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="secondary"
                          className={cn(getRoleBadgeClass(user.role))}
                        >
                          {getRoleIcon(user.role)}
                          {getRoleLabel(user.role)}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="secondary"
                          className={cn(
                            user.status === "active"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-red-100 text-red-700"
                          )}
                        >
                          {user.status === "active" ? "正常" : "已封禁"}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                            onClick={() => openRoleChangeDialog(user)}
                          >
                            <UserCog className="w-3.5 h-3.5 mr-1" />
                            修改角色
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                              "h-8",
                              user.status === "active"
                                ? "text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                            )}
                            onClick={() => handleBanUser(user.id, user.status)}
                            disabled={actionLoading === user.id}
                          >
                            {actionLoading === user.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : user.status === "active" ? (
                              <>
                                <Ban className="w-3.5 h-3.5 mr-1" />
                                封禁
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                                解封
                              </>
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && !error && users.length > 0 && totalPages > 1 && (
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
        </CardContent>
      </Card>

      {/* Role Change Dialog */}
      <Dialog open={!!roleChangeUser} onOpenChange={() => setRoleChangeUser(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>修改用户角色</DialogTitle>
            <DialogDescription>
              为用户 <span className="font-medium text-slate-900">{roleChangeUser?.username}</span> 选择新角色
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="选择角色" />
              </SelectTrigger>
              <SelectContent>
                {ROLES.filter(r => r.value !== "").map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleChangeUser(null)}>
              取消
            </Button>
            <Button
              onClick={handleChangeRole}
              disabled={!selectedRole || roleChangeLoading || selectedRole === roleChangeUser?.role}
            >
              {roleChangeLoading ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <UserCog className="w-4 h-4 mr-2" />
              )}
              确认修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
