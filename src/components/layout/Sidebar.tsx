import { useState } from "react";
import { 
  BookOpen, 
  GraduationCap, 
  PenTool, 
  Users, 
  FileText, 
  Settings,
  Home,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Plus
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home, description: "Overview & insights" },
  { name: "Create Content", href: "/create", icon: Sparkles, description: "AI course builder" },
  { name: "Courses", href: "/courses", icon: BookOpen, description: "Course library" },
  { name: "My Courses", href: "/my-courses", icon: FileText, description: "Generated content" },
  { name: "Students", href: "/students", icon: Users, description: "Manage learners" },
];

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation();

  return (
    <aside 
      className={cn(
        "fixed md:sticky top-16 left-0 z-40 h-[calc(100vh-4rem)] border-r border-border bg-sidebar/95 backdrop-blur-sm transition-all duration-300",
        collapsed ? "w-16 md:w-16" : "w-64 md:w-64",
        collapsed ? "-translate-x-full md:translate-x-0" : "translate-x-0"
      )}
    >
      <div className="flex h-full flex-col">
        {/* Toggle Button */}
        <div className="flex justify-end p-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-8 w-8"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-lg transition-smooth group",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-elegant"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-soft",
                  collapsed && "justify-center px-2"
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0 text-foreground" />
                {!collapsed && (
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{item.name}</div>
                    <div className="text-xs opacity-70 mt-0.5 truncate">
                      {item.description}
                    </div>
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Settings */}
        <div className="border-t border-sidebar-border p-3">
          <NavLink
            to="/settings"
            className={cn(
              "flex items-center gap-3 px-3 py-3 text-sm font-medium rounded-lg transition-smooth",
              "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              location.pathname === "/settings" && "bg-primary text-primary-foreground shadow-elegant",
              collapsed && "justify-center px-2"
            )}
          >
            <Settings className="h-5 w-5 flex-shrink-0" />
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <div className="font-medium">Settings</div>
                <div className="text-xs opacity-70 mt-0.5">
                  Preferences & account
                </div>
              </div>
            )}
          </NavLink>
        </div>
      </div>
    </aside>
  );
}