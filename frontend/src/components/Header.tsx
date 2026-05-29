import { Link, useNavigate } from "react-router-dom";
import {
  LogOut,
  User,
  ChevronDown,
  Zap,
  Menu,
  Sun,
  Moon,
  Circle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationDropdown } from "@/components/NotificationDropdown";
interface HeaderProps {
  className?: string;
  onMenuClick?: () => void;
}

export function Header({ className, onMenuClick }: HeaderProps) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { user, logout, isAuthenticated } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <header
      className={cn(
        "flex-shrink-0 h-[var(--header-height)]",
        "bg-[var(--header-bg)] border-b border-[var(--header-border)]",
        "flex items-center justify-between px-4 lg:px-6",
        className,
      )}
    >
      {/* Left Section - Mobile Menu + Logo */}
      <div className="flex items-center gap-4">
        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-muted)]"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Logo - Mobile only, desktop logo is in sidebar */}
        <Link to="/" className="lg:hidden flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--primary-500)] to-[var(--primary-700)] flex items-center justify-center shadow-lg shadow-[var(--primary-500)]/20 group-hover:shadow-[var(--primary-500)]/40 transition-shadow">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-[var(--text-primary)] text-lg tracking-tight">
            OPC
          </span>
        </Link>

        {/* Current User Status - More prominent display */}
        {isAuthenticated && user && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-muted)] border border-[var(--border-default)]">
            <Circle className="w-2.5 h-2.5 fill-green-500 text-green-500" />
            <span className="text-sm font-medium text-[var(--text-primary)]">
              {user.username}
            </span>
            <span className="text-xs text-green-500 font-medium">在线</span>
          </div>
        )}
      </div>

      {/* Right Section - Theme Toggle + Notifications + User */}
      <div className="flex items-center gap-2 lg:gap-4">
        {/* Theme Toggle Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-muted)]"
        >
          {theme === "light" ? (
            <Moon className="h-5 w-5" />
          ) : (
            <Sun className="h-5 w-5" />
          )}
        </Button>

        {/* Notification Dropdown */}
        <NotificationDropdown />
        {/* User Dropdown or Login Button */}
        {isAuthenticated && user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-2 px-2 py-1.5 h-auto hover:bg-[var(--bg-muted)]"
              >
                {/* Avatar with online indicator */}
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--primary-500)] to-[var(--primary-700)] flex items-center justify-center text-white text-sm font-medium shadow-lg">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  {/* Online indicator dot */}
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-[var(--header-bg)]" />
                </div>

                {/* User Info - Hidden on mobile */}
                <div className="hidden sm:flex flex-col items-start text-left">
                  <span className="text-sm font-medium text-[var(--text-primary)] leading-tight">
                    {user.username}
                  </span>
                  <span className="text-xs text-[var(--text-muted)] leading-tight flex items-center gap-1">
                    <Circle className="w-2 h-2 fill-green-500 text-green-500" />
                    在线
                  </span>
                </div>

                <ChevronDown className="w-4 h-4 text-[var(--text-muted)] hidden sm:block" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              className="w-56 bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-primary)]"
            >
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--primary-500)] to-[var(--primary-700)] flex items-center justify-center text-white font-medium">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-[var(--bg-elevated)]" />
                </div>
                <div className="flex flex-col">
                  <span className="font-medium text-sm">{user.username}</span>
                  <span className="text-xs text-green-500 flex items-center gap-1">
                    <Circle className="w-2 h-2 fill-green-500 text-green-500" />
                    当前在线
                  </span>
                </div>
              </div>

              <DropdownMenuSeparator className="bg-[var(--border-default)]" />

              <DropdownMenuItem
                className="text-[var(--text-secondary)] focus:text-[var(--text-primary)] focus:bg-[var(--bg-muted)] cursor-pointer"
                onClick={() => navigate("/profile")}
              >
                <User className="w-4 h-4 mr-2" />
                个人资料
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
        ) : (
          <Button
            variant="ghost"
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-muted)]"
            onClick={() => navigate("/login")}
          >
            登录
          </Button>
        )}
      </div>
    </header>
  );
}

export default Header;