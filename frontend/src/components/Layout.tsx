import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { cn } from "@/lib/utils";

interface LayoutProps {
  className?: string;
}

export function Layout({ className }: LayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  return (
    <div
      className={cn(
        "h-screen overflow-hidden bg-[var(--bg-base)] flex",
        className,
      )}
    >
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Desktop: relative, Mobile: fixed with slide-in */}
      <div
        className={cn(
          "fixed lg:relative h-full z-50 transition-transform duration-300 ease-in-out lg:translate-x-0",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Sidebar
          collapsed={sidebarCollapsed}
          onCollapseChange={setSidebarCollapsed}
          className="lg:block"
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 h-full overflow-hidden">
        <main className="h-full overflow-y-auto bg-[var(--bg-surface)]">
          <div className="p-0 min-h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default Layout;
