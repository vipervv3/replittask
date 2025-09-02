import { Link, useLocation } from "wouter";
import { ChartLine, Folder, CheckSquare, Settings, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MobileNav() {
  const [location] = useLocation();

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: ChartLine },
    { name: "Projects", href: "/my-projects", icon: Folder },
    { name: "Tasks", href: "/tasks", icon: CheckSquare },
    { name: "AI Insights", href: "/ai-insights", icon: Lightbulb },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="grid grid-cols-5 gap-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href || (location === "/" && item.href === "/dashboard");
          
          return (
            <Link key={item.name} href={item.href}>
              <span className={cn(
                "flex flex-col items-center justify-center p-3 transition-colors cursor-pointer",
                isActive ? "text-primary" : "text-gray-400"
              )}>
                <Icon className="w-6 h-6 mb-1" />
                <span className="text-xs font-medium">{item.name}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
