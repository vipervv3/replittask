import { Link, useLocation } from "wouter";
import { Brain, ChartLine, Folder, CheckSquare, Lightbulb, Mic, Calendar, Users, Settings, Shield, User, Smartphone, LogOut, BarChart3, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  onStartRecording: () => void;
}

export default function Sidebar({ onStartRecording }: SidebarProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: ChartLine },
    { name: "My Projects", href: "/my-projects", icon: Folder },
    { name: "Tasks", href: "/tasks", icon: CheckSquare },
    { name: "AI Insights", href: "/ai-insights", icon: Lightbulb, badge: "AI" },
    { name: "Analytics", href: "/analytics", icon: BarChart3, badge: "🧠" },
    { name: "Reports", href: "/reports", icon: FileText, badge: "📈" },
    { name: "Meetings", href: "/meetings", icon: Mic },
    { name: "Calendar", href: "/calendar", icon: Calendar },
    { name: "Team", href: "/team", icon: Users },
    { name: "Security", href: "/security", icon: Shield, badge: "🔒" },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <aside className="flex flex-col w-full h-full bg-white border-r border-gray-200 lg:block">
      {/* Logo */}
      <div className="flex items-center px-6 py-4 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">AI ProjectHub</h1>
            <p className="text-xs text-gray-500">Intelligent Management</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href || (location === "/" && item.href === "/dashboard");
          
          return (
            <Link key={item.name} href={item.href}>
              <span className={cn(
                "flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-colors cursor-pointer",
                isActive
                  ? "text-white bg-primary"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              )}>
                <Icon className="w-5 h-5 mr-3" />
                {item.name}
                {item.badge && (
                  <span className="ml-auto bg-secondary text-white text-xs px-2 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="px-4 py-4 border-t border-gray-200">
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-gray-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900">{user?.name || 'Guest User'}</p>
            <p className="text-xs text-gray-500">{user?.email || 'Please log in'}</p>
          </div>
        </div>
        {user && (
          <Button 
            onClick={handleLogout}
            variant="outline" 
            size="sm" 
            className="w-full text-xs"
          >
            <LogOut className="w-3 h-3 mr-1" />
            Logout
          </Button>
        )}
        {!user && (
          <Button 
            onClick={() => window.location.href = '/login'}
            variant="outline" 
            size="sm" 
            className="w-full text-xs"
          >
            <User className="w-3 h-3 mr-1" />
            Login
          </Button>
        )}
      </div>
    </aside>
  );
}
