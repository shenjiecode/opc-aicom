import { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { logout, getCurrentUser } from "@/lib/api";
import {
  LayoutDashboard,
  Users,
  FileText,
  LogOut,
  Shield,
  Menu,
  X,
  ClipboardList,
  ShoppingCart,
  Bot,
  Globe,
  CreditCard,
  Coins,
  Building2,
} from "lucide-react";

interface User {
  userId: number;
  username: string;
  role: string;
  vipLevel: number;
}

// Navigation items for admin role (full access)
const adminNavigationItems = [
  { path: "/admin", label: "控制台", icon: LayoutDashboard },
  { path: "/admin/users", label: "用户管理", icon: Users },
  { path: "/admin/review", label: "内容审核", icon: FileText },
  { path: "/admin/tasks", label: "任务管理", icon: ClipboardList },
  { path: "/admin/orders", label: "订单管理", icon: ShoppingCart },
  { path: "/admin/agents", label: "智能体设置", icon: Bot },
  { path: "/admin/billing", label: "计费管理", icon: CreditCard },
  { path: "/admin/points/allocation", label: "积分分配", icon: Coins },
  { path: "/admin/api-gateway", label: "AI 模型网关", icon: Globe },
];

// Navigation items for community_admin role (limited access)
const communityAdminNavigationItems = [
  { path: "/admin", label: "控制台", icon: LayoutDashboard },
  { path: "/admin/users", label: "用户管理", icon: Users },
  { path: "/admin/community", label: "社区管理", icon: Building2 },
  { path: "/admin/opc", label: "OPC企业认证", icon: Shield },
];

// Function to get navigation items based on role
const getNavigationItems = (role: string) => {
  if (role === "community_admin") {
    return communityAdminNavigationItems;
  }
  return adminNavigationItems;
};

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const checkAuth = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        navigate("/login", { state: { from: location.pathname } });
        return;
      }
      // Check if user is admin or community_admin
      if (currentUser.role !== "admin" && currentUser.role !== "community_admin") {
        navigate("/");
        return;
      }
      setUser(currentUser);
    } catch (err) {
      navigate("/login", { state: { from: location.pathname } });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-indigo-500 border-r-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:relative z-50 h-full flex flex-col bg-slate-900 transition-all duration-300 ease-in-out",
          sidebarOpen ? "w-64" : "w-20",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Sidebar Header */}
        <div className="h-16 shrink-0 flex items-center justify-between px-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-white" />
            </div>
            {sidebarOpen && (
              <span className="text-white font-semibold text-lg">管理后台</span>
            )}
          </div>
          {/* Mobile Close Button */}
          <button
            className="lg:hidden text-slate-400 hover:text-white"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
          {/* Desktop Toggle */}
          <button
            className="hidden lg:block text-slate-400 hover:text-white"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {getNavigationItems(user.role).map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path ||
              (item.path !== "/admin" && location.pathname.startsWith(item.path));
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                  isActive
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200",
                  !sidebarOpen && "justify-center"
                )}
                title={!sidebarOpen ? item.label : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800 shrink-0 bg-slate-900 mt-auto">
          {sidebarOpen ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {user?.username?.charAt(0).toUpperCase() || "A"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{user?.username}</p>
                  <p className="text-slate-500 text-xs">{user?.role}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-400 hover:text-white hover:bg-slate-800"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="w-full text-slate-400 hover:text-white hover:bg-slate-800"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            {/* Mobile Menu Button */}
            <button
              className="lg:hidden text-slate-600 hover:text-slate-900"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-600" />
              <h1 className="text-xl font-semibold text-slate-900">OPC 管理平台</h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-slate-500 text-sm hidden sm:block">
              欢迎回来，{user?.username}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:flex items-center gap-2"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4" />
              退出登录
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-slate-50 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
