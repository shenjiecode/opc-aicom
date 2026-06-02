import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Users,
  RefreshCw,
  Building2,
  CheckCircle,
  XCircle,
  Clock,
  Shield,
  User,
  Check,
  X,
} from "lucide-react";

interface User {
  id: number;
  username: string;
  role: string;
  status: "active" | "banned";
  memberType: string;
  verificationStatus: string;
  enterpriseName?: string;
  realName?: string;
  createdAt: string;
}

interface UserListResponse {
  list: User[];
  total: number;
  page: number;
  pageSize: number;
}

interface Enterprise {
  id: number;
  username: string;
  enterpriseName: string;
  verificationStatus: string;
  createdAt: string;
}

interface EnterpriseListResponse {
  list: Enterprise[];
  total: number;
  page: number;
  pageSize: number;
}

type TabType = "users" | "enterprises" | "verification";

const TABS = [
  { id: "users" as TabType, label: "用户列表", icon: Users },
  { id: "enterprises" as TabType, label: "OPC企业", icon: Building2 },
  { id: "verification" as TabType, label: "认证审批", icon: Shield },
];

const ROLES = [
  { value: "", label: "全部角色" },
  { value: "admin", label: "管理员" },
  { value: "community_admin", label: "社区管理员" },
  { value: "user", label: "普通用户" },
];

const VERIFICATION_STATUSES = [
  { value: "", label: "全部状态" },
  { value: "pending", label: "待审核" },
  { value: "verified", label: "已通过" },
  { value: "rejected", label: "已拒绝" },
];

export default function CommunityManagement() {
  const [activeTab, setActiveTab] = useState<TabType>("users");

  // Users tab state
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotal, setUsersTotal] = useState(0);
  const [userFilters, setUserFilters] = useState({
    search: "",
    role: "",
  });

  // Enterprises tab state
  const [enterprises, setEnterprises] = useState<Enterprise[]>([]);
  const [enterprisesLoading, setEnterprisesLoading] = useState(true);
  const [enterprisesPage, setEnterprisesPage] = useState(1);
  const [enterprisesTotal, setEnterprisesTotal] = useState(0);

  // Verification tab state
  const [verifications, setVerifications] = useState<User[]>([]);
  const [verificationsLoading, setVerificationsLoading] = useState(true);
  const [verificationsPage, setVerificationsPage] = useState(1);
  const [verificationsTotal, setVerificationsTotal] = useState(0);
  const [verificationFilter, setVerificationFilter] = useState("pending");
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const pageSize = 10;

  useEffect(() => {
    if (activeTab === "users") {
      fetchUsers();
    } else if (activeTab === "enterprises") {
      fetchEnterprises();
    } else if (activeTab === "verification") {
      fetchVerifications();
    }
  }, [activeTab, usersPage, enterprisesPage, verificationsPage, verificationFilter, userFilters.role]);

  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const result = await apiFetch<UserListResponse>("/admin/users/list", {
        method: "POST",
        body: JSON.stringify({
          page: usersPage,
          pageSize,
          search: userFilters.search,
          role: userFilters.role,
        }),
      });
      setUsers(result.list || []);
      setUsersTotal(result.total || 0);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setUsersLoading(false);
    }
  };

  const fetchEnterprises = async () => {
    setEnterprisesLoading(true);
    try {
      const result = await apiFetch<EnterpriseListResponse>("/admin/enterprises/list", {
        method: "POST",
        body: JSON.stringify({
          page: enterprisesPage,
          pageSize,
        }),
      });
      setEnterprises(result.list || []);
      setEnterprisesTotal(result.total || 0);
    } catch (err) {
      console.error("Failed to fetch enterprises:", err);
    } finally {
      setEnterprisesLoading(false);
    }
  };

  const fetchVerifications = async () => {
    setVerificationsLoading(true);
    try {
      const result = await apiFetch<UserListResponse>("/admin/verification/list", {
        method: "POST",
        body: JSON.stringify({
          page: verificationsPage,
          pageSize,
          status: verificationFilter,
        }),
      });
      setVerifications(result.list || []);
      setVerificationsTotal(result.total || 0);
    } catch (err) {
      console.error("Failed to fetch verifications:", err);
    } finally {
      setVerificationsLoading(false);
    }
  };

  const handleVerify = async (userId: number, status: "verified" | "rejected") => {
    setActionLoading(userId);
    try {
      await apiFetch(`/admin/verification/${userId}/approve`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      fetchVerifications();
    } catch (err) {
      console.error("Failed to verify:", err);
      alert("操作失败，请稍后重试");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUserSearch = () => {
    setUsersPage(1);
    fetchUsers();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
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

  const getRoleLabel = (role: string) => {
    const roleMap: Record<string, string> = {
      admin: "管理员",
      community_admin: "社区管理员",
      user: "普通用户",
    };
    return roleMap[role] || role;
  };

  const getVerificationBadgeClass = (status: string) => {
    switch (status) {
      case "verified":
        return "bg-emerald-100 text-emerald-700";
      case "rejected":
        return "bg-red-100 text-red-700";
      case "pending":
        return "bg-amber-100 text-amber-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const getVerificationLabel = (status: string) => {
    const map: Record<string, string> = {
      verified: "已通过",
      rejected: "已拒绝",
      pending: "待审核",
      none: "未认证",
    };
    return map[status] || status;
  };

  const renderUsersTab = () => {
    const totalPages = Math.ceil(usersTotal / pageSize);

    return (
      <Card className="border-slate-200">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-lg font-semibold text-slate-900">用户列表</CardTitle>
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="搜索用户名..."
                  className="pl-10 w-48"
                  value={userFilters.search}
                  onChange={(e) => setUserFilters((prev) => ({ ...prev, search: e.target.value }))}
                  onKeyDown={(e) => e.key === "Enter" && handleUserSearch()}
                />
              </div>
              {/* Role Filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  className="h-9 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-slate-950"
                  value={userFilters.role}
                  onChange={(e) => setUserFilters((prev) => ({ ...prev, role: e.target.value }))}
                >
                  {ROLES.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>
              <Button size="sm" onClick={handleUserSearch}>
                <Search className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={fetchUsers} disabled={usersLoading}>
                <RefreshCw className={cn("w-4 h-4", usersLoading && "animate-spin")} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {usersLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-500 border-r-transparent" />
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">暂无用户数据</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">ID</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">用户名</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">角色</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">认证状态</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">创建时间</th>
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
                            {getRoleLabel(user.role)}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant="secondary"
                            className={cn(getVerificationBadgeClass(user.verificationStatus))}
                          >
                            {getVerificationLabel(user.verificationStatus)}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600">
                          {formatDate(user.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200">
                  <p className="text-sm text-slate-500">
                    显示第 {(usersPage - 1) * pageSize + 1} 到 {Math.min(usersPage * pageSize, usersTotal)} 条，共 {usersTotal} 条
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
                      disabled={usersPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-slate-600 px-2">
                      {usersPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setUsersPage((p) => Math.min(totalPages, p + 1))}
                      disabled={usersPage === totalPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderEnterprisesTab = () => {
    const totalPages = Math.ceil(enterprisesTotal / pageSize);

    return (
      <Card className="border-slate-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-slate-900">OPC企业列表</CardTitle>
            <Button size="sm" variant="outline" onClick={fetchEnterprises} disabled={enterprisesLoading}>
              <RefreshCw className={cn("w-4 h-4", enterprisesLoading && "animate-spin")} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {enterprisesLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-500 border-r-transparent" />
            </div>
          ) : enterprises.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg">
              <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">暂无企业数据</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">ID</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">企业名称</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">管理员</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">认证状态</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">注册时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enterprises.map((enterprise) => (
                      <tr key={enterprise.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4 text-sm text-slate-600">#{enterprise.id}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                              <Building2 className="w-4 h-4 text-blue-600" />
                            </div>
                            <span className="text-sm font-medium text-slate-900">{enterprise.enterpriseName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-700">{enterprise.username}</td>
                        <td className="py-3 px-4">
                          <Badge
                            variant="secondary"
                            className={cn(getVerificationBadgeClass(enterprise.verificationStatus))}
                          >
                            {getVerificationLabel(enterprise.verificationStatus)}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600">
                          {formatDate(enterprise.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200">
                  <p className="text-sm text-slate-500">
                    显示第 {(enterprisesPage - 1) * pageSize + 1} 到 {Math.min(enterprisesPage * pageSize, enterprisesTotal)} 条，共 {enterprisesTotal} 条
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEnterprisesPage((p) => Math.max(1, p - 1))}
                      disabled={enterprisesPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-slate-600 px-2">
                      {enterprisesPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEnterprisesPage((p) => Math.min(totalPages, p + 1))}
                      disabled={enterprisesPage === totalPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderVerificationTab = () => {
    const totalPages = Math.ceil(verificationsTotal / pageSize);

    return (
      <Card className="border-slate-200">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-lg font-semibold text-slate-900">认证审批</CardTitle>
            <div className="flex items-center gap-3">
              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  className="h-9 px-3 rounded-md border border-slate-200 bg-white text-sm focus:outline-none focus:ring-1 focus:ring-slate-950"
                  value={verificationFilter}
                  onChange={(e) => {
                    setVerificationFilter(e.target.value);
                    setVerificationsPage(1);
                  }}
                >
                  {VERIFICATION_STATUSES.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
              <Button size="sm" variant="outline" onClick={fetchVerifications} disabled={verificationsLoading}>
                <RefreshCw className={cn("w-4 h-4", verificationsLoading && "animate-spin")} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {verificationsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-500 border-r-transparent" />
            </div>
          ) : verifications.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg">
              {verificationFilter === "pending" ? (
                <>
                  <CheckCircle className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
                  <p className="text-slate-500">暂无待审核的认证申请</p>
                </>
              ) : verificationFilter === "rejected" ? (
                <>
                  <XCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">暂无已拒绝的认证申请</p>
                </>
              ) : (
                <>
                  <Shield className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
                  <p className="text-slate-500">暂无已通过的认证申请</p>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">ID</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">用户名</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">企业名称</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">状态</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">申请时间</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verifications.map((user) => (
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
                        <td className="py-3 px-4 text-sm text-slate-700">
                          {user.enterpriseName || "-"}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant="secondary"
                            className={cn(getVerificationBadgeClass(user.verificationStatus))}
                          >
                            {user.verificationStatus === "pending" && <Clock className="w-3 h-3 mr-1" />}
                            {user.verificationStatus === "verified" && <CheckCircle className="w-3 h-3 mr-1" />}
                            {user.verificationStatus === "rejected" && <XCircle className="w-3 h-3 mr-1" />}
                            {getVerificationLabel(user.verificationStatus)}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600">
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {user.verificationStatus === "pending" && (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
                                onClick={() => handleVerify(user.id, "verified")}
                                disabled={actionLoading === user.id}
                              >
                                {actionLoading === user.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <>
                                    <Check className="w-3.5 h-3.5 mr-1" />
                                    通过
                                  </>
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                onClick={() => handleVerify(user.id, "rejected")}
                                disabled={actionLoading === user.id}
                              >
                                <X className="w-3.5 h-3.5 mr-1" />
                                拒绝
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-200">
                  <p className="text-sm text-slate-500">
                    显示第 {(verificationsPage - 1) * pageSize + 1} 到 {Math.min(verificationsPage * pageSize, verificationsTotal)} 条，共 {verificationsTotal} 条
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setVerificationsPage((p) => Math.max(1, p - 1))}
                      disabled={verificationsPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm text-slate-600 px-2">
                      {verificationsPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setVerificationsPage((p) => Math.min(totalPages, p + 1))}
                      disabled={verificationsPage === totalPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">社区管理</h2>
          <p className="text-slate-500 mt-1">管理社区用户、企业和认证审批</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "group inline-flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors",
                  isActive
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                )}
              >
                <Icon className={cn("w-4 h-4", isActive ? "text-indigo-500" : "text-slate-400 group-hover:text-slate-500")} />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === "users" && renderUsersTab()}
        {activeTab === "enterprises" && renderEnterprisesTab()}
        {activeTab === "verification" && renderVerificationTab()}
      </div>
    </div>
  );
}
