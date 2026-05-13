import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  LogOut, 
  User, 
  ChevronDown, 
  Zap,
  Menu,
  Bell
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface HeaderProps {
  className?: string;
  onMenuClick?: () => void;
  sidebarCollapsed?: boolean;
}

export function Header({ className, onMenuClick, sidebarCollapsed = false }: HeaderProps) {
  const navigate = useNavigate();
  const [notifications] = useState(3);

  // Mock user data - in real app, this would come from auth context
  const user = {
    name: 'SuperBuilder',
    avatar: 'S',
    role: 'AI 原生创业者',
  };

  const handleLogout = () => {
    // Clear auth token
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <header 
      className={cn(
        "fixed top-0 right-0 left-0 z-50 h-[var(--header-height)]",
        "bg-[var(--gray-900)] border-b border-[var(--gray-800)]",
        "flex items-center justify-between px-4 lg:px-6",
        "transition-all duration-300 ease-in-out",
        sidebarCollapsed ? "lg:left-16" : "lg:left-64",
        className
      )}
    >
      {/* Left Section - Mobile Menu + Logo */}
      <div className="flex items-center gap-4">
        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden text-[var(--gray-400)] hover:text-white hover:bg-[var(--gray-800)]"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Logo - Mobile only, desktop logo is in sidebar */}
        <Link to="/" className="lg:hidden flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--primary-500)] to-[var(--primary-700)] flex items-center justify-center shadow-lg shadow-[var(--primary-500)]/20 group-hover:shadow-[var(--primary-500)]/40 transition-shadow">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-semibold text-white text-lg tracking-tight">OPC</span>
        </Link>
      </div>

      {/* Right Section - Notifications + User */}
      <div className="flex items-center gap-2 lg:gap-4">
        {/* Notification Button */}
        <Button
          variant="ghost"
          size="icon"
          className="relative text-[var(--gray-400)] hover:text-white hover:bg-[var(--gray-800)]"
        >
          <Bell className="h-5 w-5" />
          {notifications > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--primary-500)] animate-pulse" />
          )}
        </Button>

        {/* User Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 px-2 py-1.5 h-auto hover:bg-[var(--gray-800)]"
            >
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--primary-500)] to-[var(--primary-700)] flex items-center justify-center text-white text-sm font-medium shadow-lg">
                {user.avatar}
              </div>
              
              {/* User Info - Hidden on mobile */}
              <div className="hidden sm:flex flex-col items-start text-left">
                <span className="text-sm font-medium text-white leading-tight">{user.name}</span>
                <span className="text-xs text-[var(--gray-400)] leading-tight">{user.role}</span>
              </div>

              <ChevronDown className="w-4 h-4 text-[var(--gray-400)] hidden sm:block" />
            </Button>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent 
            align="end" 
            className="w-56 bg-[var(--gray-900)] border-[var(--gray-800)] text-white"
          >
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--primary-500)] to-[var(--primary-700)] flex items-center justify-center text-white font-medium">
                {user.avatar}
              </div>
              <div className="flex flex-col">
                <span className="font-medium text-sm">{user.name}</span>
                <span className="text-xs text-[var(--gray-400)]">{user.role}</span>
              </div>
            </div>
            
            <DropdownMenuSeparator className="bg-[var(--gray-800)]" />
            
            <DropdownMenuItem 
              className="text-[var(--gray-300)] focus:text-white focus:bg-[var(--gray-800)] cursor-pointer"
              onClick={() => navigate('/profile')}
            >
              <User className="w-4 h-4 mr-2" />
              个人资料
            </DropdownMenuItem>
            
            <DropdownMenuSeparator className="bg-[var(--gray-800)]" />
            
            <DropdownMenuItem 
              className="text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4 mr-2" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export default Header;
