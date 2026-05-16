import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Home,
  Globe,
  ClipboardList,
  Bot,
  Palette,
  User,
  Workflow,
  Briefcase,
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
  Zap,
  Circle,
  LogOut,
  Settings,
  ChevronUp,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Navigation item type
interface NavItem {
  id: string;
  path: string;
  icon: React.ElementType;
  label: string;
  badge?: string | number;
  badgeType?: "default" | "hot" | "new";
}

// Navigation group type
interface NavGroup {
  section: string;
  items: NavItem[];
}

// Navigation configuration
const navigationGroups: NavGroup[] = [
  {
    section: "核心板块",
    items: [
      { id: "home", path: "/", icon: Home, label: "首页" },
      { id: "aibit", path: "/aibit", icon: Zap, label: "AI比特", badgeType: "hot" },
      {
        id: "community",
        path: "/community",
        icon: Globe,
        label: "社区",
        badge: 508,
      },
      {
        id: "tasks",
        path: "/tasks",
        icon: ClipboardList,
        label: "任务中心",
        badge: 23,
        badgeType: "hot",
      },
      {
        id: "ai-resources",
        path: "/ai-resources",
        icon: Bot,
        label: "AI资源",
        badge: 12,
        badgeType: "hot",
      },

      {
        id: "service-center",
        path: "/service-center",
        icon: Palette,
        label: "服务中心",
        badge: 16,
      },
    ],
  },
  {
    section: "个人中心",
    items: [
      { id: "my-opc", path: "/my-opc", icon: User, label: "我的OPC" },
      { id: "my-agents", path: "/my-agents", icon: Bot, label: "我的智能体" },
      {
        id: "my-workflows",
        path: "/my-workflows",
        icon: Workflow,
        label: "我的工作流",
      },
      {
        id: "opc-workbench",
        path: "/opc-workbench",
        icon: Briefcase,
        label: "OPC工作台",
      },
      {
        id: "my-events",
        path: "/my-events",
        icon: Calendar,
        label: "我的活动",
      },
      {
        id: "points-mall",
        path: "/points-mall",
        icon: ShoppingBag,
        label: "积分商城",
      },
    ],
  },
];

interface SidebarProps {
  className?: string;
  collapsed?: boolean;
  onCollapseChange?: (collapsed: boolean) => void;
}

export function Sidebar({
  className,
  collapsed: controlledCollapsed,
  onCollapseChange,
}: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const [internalCollapsed, setInternalCollapsed] = useState(false);

  // Support both controlled and uncontrolled collapsed state
  const collapsed = controlledCollapsed ?? internalCollapsed;
  const setCollapsed = (value: boolean) => {
    if (controlledCollapsed === undefined) {
      setInternalCollapsed(value);
    }
    onCollapseChange?.(value);
  };

  // Check if a nav item is active
  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <aside
      className={cn(
        "relative h-full flex-shrink-0",
        "bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)]",
        "flex flex-col",
        "transition-all duration-300 ease-in-out",
        collapsed ? "w-16" : "w-[230px]",
        className,
      )}
    >
      {/* Logo Section */}
      <div
        className={cn(
          "h-[var(--header-height)] flex items-center border-b border-[var(--sidebar-border)]",
          collapsed ? "justify-center px-2" : "px-4",
        )}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--primary-500)] to-[var(--primary-700)] flex items-center justify-center shadow-lg shadow-[var(--primary-500)]/20 flex-shrink-0">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div
            className={cn(
              "flex flex-col overflow-hidden transition-all duration-300",
              collapsed ? "w-0 opacity-0" : "w-auto opacity-100",
            )}
          >
            <span className="font-bold text-[var(--text-primary)] text-lg tracking-tight whitespace-nowrap">
              BitBay OPC
            </span>
            <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">
              OPC协作平台
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-6 scrollbar-thin scrollbar-thumb-[var(--border-default)] scrollbar-track-transparent">
        {navigationGroups.map((group) => (
          <div key={group.section}>
            {/* Section Title - Hidden when collapsed */}
            <div
              className={cn(
                "px-3 mb-2 transition-all duration-300",
                collapsed
                  ? "h-0 opacity-0 overflow-hidden"
                  : "h-auto opacity-100",
              )}
            >
              <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                {group.section}
              </span>
            </div>

            {/* Nav Items */}
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);

                return (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg",
                      "transition-all duration-200 group relative",
                      "hover:bg-[var(--bg-muted)]",
                      active
                        ? "bg-[var(--primary-500)]/10 text-[var(--primary-500)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                      collapsed && "justify-center px-2",
                    )}
                  >
                    {/* Icon */}
                    <Icon
                      className={cn(
                        "w-5 h-5 flex-shrink-0 transition-colors",
                        active
                          ? "text-[var(--primary-500)]"
                          : "group-hover:text-[var(--text-primary)]",
                      )}
                    />

                    {/* Label - Hidden when collapsed */}
                    <span
                      className={cn(
                        "text-sm font-medium whitespace-nowrap transition-all duration-300",
                        collapsed ? "w-0 opacity-0" : "w-auto opacity-100",
                      )}
                    >
                      {item.label}
                    </span>

                    {/* Badge - Hidden when collapsed */}
                    {item.badge && !collapsed && (
                      <span
                        className={cn(
                          "ml-auto text-xs px-2 py-0.5 rounded-full",
                          item.badgeType === "hot"
                            ? "bg-red-500/20 text-red-500"
                            : "bg-[var(--primary-500)]/20 text-[var(--primary-500)]",
                        )}
                      >
                        {item.badge}
                      </span>
                    )}

                    {/* Active indicator line */}
                    {active && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-[var(--primary-500)]" />
                    )}

                    {/* Tooltip for collapsed state */}
                    {collapsed && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[var(--text-primary)] text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                        {item.label}
                        {item.badge && (
                          <span className="ml-2 text-xs text-[var(--primary-500)]">
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User Section - Bottom of sidebar */}
      {isAuthenticated && user && (
        <div className="border-t border-[var(--sidebar-border)] p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "w-full flex items-center gap-3 p-2 rounded-lg",
                  "hover:bg-[var(--bg-muted)] transition-colors cursor-pointer",
                  collapsed && "justify-center",
                )}
              >
                {/* Avatar with online indicator */}
                <div className="relative flex-shrink-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--primary-500)] to-[var(--primary-700)] flex items-center justify-center text-white text-sm font-medium shadow-lg">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  {/* Online indicator */}
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-[var(--sidebar-bg)]" />
                </div>

                {/* User info - Hidden when collapsed */}
                {!collapsed && (
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {user.username}
                      </span>
                      <ChevronUp className="w-4 h-4 text-[var(--text-muted)] ml-auto" />
                    </div>
                    <div className="flex items-center gap-1">
                      <Circle className="w-2 h-2 fill-green-500 text-green-500" />
                      <span className="text-xs text-green-500">在线</span>
                    </div>
                  </div>
                )}

                {/* Tooltip for collapsed state */}
                {collapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[var(--text-primary)] text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                    {user.username}
                    <span className="ml-2 text-xs text-green-500">在线</span>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              side="top"
              align={collapsed ? "start" : "end"}
              className="w-56 bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)] mb-2"
            >
              {/* User Info Header */}
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--primary-500)] to-[var(--primary-700)] flex items-center justify-center text-white font-medium">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-[var(--bg-elevated)]" />
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-sm">{user.username}</span>
                  <div className="flex items-center gap-1">
                    <Circle className="w-2 h-2 fill-green-500 text-green-500" />
                    <span className="text-xs text-green-500">当前在线</span>
                  </div>
                </div>
              </div>

              <DropdownMenuSeparator className="bg-[var(--border-default)]" />

              {/* User Stats */}
              <div className="px-3 py-2 text-xs text-[var(--text-muted)]">
                <div className="flex justify-between mb-1">
                  <span>角色</span>
                  <span className="text-[var(--text-secondary)]">
                    {user.role === 'user' ? '普通用户' : user.role}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>VIP等级</span>
                  <span className="text-[var(--text-secondary)]">
                    {user.vipLevel > 0 ? `VIP ${user.vipLevel}` : '普通会员'}
                  </span>
                </div>
              </div>

              <DropdownMenuSeparator className="bg-[var(--border-default)]" />

              <DropdownMenuItem
                className="text-[var(--text-secondary)] focus:text-[var(--text-primary)] focus:bg-[var(--bg-muted)] cursor-pointer"
                onClick={() => navigate("/my-opc")}
              >
                <User className="w-4 h-4 mr-2" />
                个人中心
              </DropdownMenuItem>

              <DropdownMenuItem
                className="text-[var(--text-secondary)] focus:text-[var(--text-primary)] focus:bg-[var(--bg-muted)] cursor-pointer"
                onClick={() => navigate("/settings")}
              >
                <Settings className="w-4 h-4 mr-2" />
                设置
              </DropdownMenuItem>

              <DropdownMenuSeparator className="bg-[var(--border-default)]" />

              <DropdownMenuItem
                className="text-red-500 focus:text-red-400 focus:bg-red-500/10 cursor-pointer"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Login Button - When not authenticated */}
      {!isAuthenticated && (
        <div className="border-t border-[var(--sidebar-border)] p-3">
          <button
            onClick={() => navigate("/login")}
            className={cn(
              "w-full flex items-center gap-3 p-2 rounded-lg",
              "hover:bg-[var(--bg-muted)] transition-colors cursor-pointer",
              "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
              collapsed && "justify-center",
            )}
          >
            <User className="w-5 h-5 flex-shrink-0" />
            {!collapsed && (
              <span className="text-sm font-medium">登录</span>
            )}
          </button>
        </div>
      )}

      {/* Collapse Toggle Button on the boundary */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 -right-3.5 w-7 h-7 bg-[var(--sidebar-bg)] border border-[var(--sidebar-border)] rounded-full flex items-center justify-center cursor-pointer z-50",
          "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-muted)] transition-colors shadow-sm",
        )}
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>
    </aside>
  );
}

export default Sidebar;