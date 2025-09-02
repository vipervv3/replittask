import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Projects from "@/pages/Projects";
import ProjectDetails from "@/pages/ProjectDetails";
import Tasks from "@/pages/Tasks";
import AIInsights from "@/pages/AIInsights";
import Analytics from "@/pages/Analytics";
import ProjectReports from "@/pages/ProjectReports";
import ProjectDashboard from "@/pages/ProjectDashboard";
import Meetings from "@/pages/Meetings";
import Calendar from "@/pages/Calendar";
import Team from "@/pages/Team";
import Settings from "@/pages/Settings";
import Security from "@/pages/Security";
import Sidebar from "@/components/layout/Sidebar";
import MobileNav from "@/components/layout/MobileNav";
import PWAInstallButton from "@/components/PWAInstallButton";
import Login from "@/pages/Login";
import AuthTest from "@/components/AuthTest";
import UserProjects from "@/pages/UserProjects";
import VoiceRecordingModal from "@/components/modals/VoiceRecordingModal";
import VoiceAssistantModal from "@/components/modals/VoiceAssistantModal";
import RecordingFloatingButton from "@/components/RecordingFloatingButton";
import RecordingIndicator from "@/components/RecordingIndicator";
import VoiceAssistantFloatingButton from "@/components/VoiceAssistantFloatingButton";
import { VoiceRecordingProvider } from "@/contexts/VoiceRecordingContext";
import { VoiceAssistantProvider } from "@/contexts/VoiceAssistantContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import RecordingDiagnostics from "@/pages/RecordingDiagnostics";
import { useState, useEffect } from "react";
import { Mic, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

// Hook to detect screen size
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint is 1024px
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  return isMobile;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isAssistantModalOpen, setIsAssistantModalOpen] = useState(false);
  const { isAuthenticated, isLoading, user } = useAuth();
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();
  
  // Hide sidebar on all mobile devices by default
  const [mobileHideSidebar, setMobileHideSidebar] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('hideSidebarMobile');
      // Default to true (hidden) on mobile devices if no preference is stored
      return stored !== null ? stored === 'true' : true;
    }
    return true;
  });

  // Listen for storage changes to sync sidebar state
  useEffect(() => {
    const handleStorageChange = () => {
      setMobileHideSidebar(localStorage.getItem('hideSidebarMobile') === 'true');
    };
    
    window.addEventListener('storage', handleStorageChange);
    // Also listen for custom event for same-tab updates
    window.addEventListener('sidebarToggle', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('sidebarToggle', handleStorageChange);
    };
  }, []);

  // Handle redirects in useEffect to avoid state updates during render
  useEffect(() => {
    // If user is authenticated and on login page, redirect to dashboard
    if (user && !isLoading && location === '/login') {
      console.log('User authenticated, redirecting to dashboard...');
      setLocation('/dashboard');
    }
    // If user is not authenticated and not on login page, redirect to login
    else if (!user && !isLoading && location !== '/login') {
      console.log('Not authenticated, redirecting to login page...');
      setLocation('/login');
    }
  }, [user, isLoading, location, setLocation]);
  
  // For login page, don't show the full layout
  if (location === '/login') {
    console.log('Showing login page...');
    return <>{children}</>;
  }
  
  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-md text-center">
          <div className="mb-6">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Loading...
            </h2>
          </div>
        </div>
      </div>
    );
  }

  // For all other pages, require authentication
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-md text-center">
          <div className="mb-6">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Redirecting to login...
            </h2>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-screen bg-gray-50">
        {/* Sidebar - hide on mobile when user preference is set or by default */}
        {!(isMobile && mobileHideSidebar) && (
          <div className={isMobile ? "hidden lg:block lg:w-64 lg:flex-shrink-0" : "w-64 flex-shrink-0"}>
            <Sidebar onStartRecording={() => setIsVoiceModalOpen(true)} />
          </div>
        )}
        
        <main className="flex-1 overflow-auto relative">
          {children}
        </main>
        
        {/* Show mobile nav when sidebar is hidden on mobile */}
        {isMobile && mobileHideSidebar && <MobileNav />}
        
        <VoiceRecordingModal 
          isOpen={isVoiceModalOpen} 
          onClose={() => setIsVoiceModalOpen(false)} 
        />
        
        <VoiceAssistantModal 
          isOpen={isAssistantModalOpen} 
          onClose={() => setIsAssistantModalOpen(false)} 
        />
        
        {/* PWA Install Button */}
        <PWAInstallButton />
      </div>
      
      {/* Floating Action Buttons - Smaller size */}
      <div
        style={{
          position: 'fixed',
          bottom: '100px',
          right: '20px',
          zIndex: 999999,
          width: '60px',
          height: '60px',
          backgroundColor: '#2563eb',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.8)',
          border: '3px solid white',
          fontSize: '24px',
          color: 'white',
          fontWeight: 'bold'
        }}
        onClick={() => setIsVoiceModalOpen(true)}
      >
        🎙️
      </div>
      
      <div
        style={{
          position: 'fixed',
          bottom: '170px',
          right: '20px',
          zIndex: 999998,
          width: '60px',
          height: '60px',
          backgroundColor: '#8b5cf6',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.8)',
          border: '3px solid gold',
          fontSize: '24px',
          color: 'white',
          fontWeight: 'bold'
        }}
        onClick={() => setIsAssistantModalOpen(true)}
      >
        🤖
      </div>
    </>
  );
}

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/projects" component={UserProjects} />
        <Route path="/projects/:id" component={ProjectDetails} />
        <Route path="/tasks" component={Tasks} />
        <Route path="/ai-insights" component={AIInsights} />
        <Route path="/analytics" component={Analytics} />
        <Route path="/reports" component={ProjectReports} />
        <Route path="/projects/:id/dashboard" component={ProjectDashboard} />
        <Route path="/meetings" component={Meetings} />
        <Route path="/calendar" component={Calendar} />
        <Route path="/team" component={Team} />
        <Route path="/settings" component={Settings} />
        <Route path="/security" component={Security} />
        <Route path="/login" component={Login} />
        <Route path="/auth-test" component={AuthTest} />
        <Route path="/my-projects" component={UserProjects} />
        <Route path="/recording-diagnostics" component={RecordingDiagnostics} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  console.log("App component rendering...");
  
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <VoiceRecordingProvider>
            <VoiceAssistantProvider>
              <TooltipProvider>
                <Toaster />
                <Router />
              </TooltipProvider>
            </VoiceAssistantProvider>
          </VoiceRecordingProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
