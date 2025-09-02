import { useState, useEffect, createContext, useContext } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Switch, Route, useLocation } from "wouter";
import Dashboard from "@/pages/Dashboard";
import Projects from "@/pages/Projects";
import Tasks from "@/pages/Tasks";
import Calendar from "@/pages/Calendar";
import Meetings from "@/pages/Meetings";
import Settings from "@/pages/Settings";

// Create a simple query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

// Simple auth user interface
interface AuthUser {
  id: string;
  name: string;
  email: string;
  username: string;
}

// Auth context interface matching the original useAuth hook
interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

// Create auth context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// useAuth hook for compatibility
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

// Simple AuthProvider component
function SimpleAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/auth/me", { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include'
    });

    if (response.ok) {
      const data = await response.json();
      setUser(data.user);
    } else {
      throw new Error('Login failed');
    }
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
  };

  const register = async (email: string, password: string, name: string) => {
    // Placeholder - implement if needed
    throw new Error('Registration not implemented');
  };

  const value: AuthContextType = {
    user,
    isLoading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
  };

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, []);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default function FixedApp() {
  console.log("FixedApp rendering...");
  
  return (
    <QueryClientProvider client={queryClient}>
      <SimpleAuthProvider>
        <AppContent />
      </SimpleAuthProvider>
    </QueryClientProvider>
  );
}

function AppContent() {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  // Simple login component
  const SimpleLogin = () => {
    const { login } = useAuth();
    
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const email = (form.email as HTMLInputElement).value;
      const password = (form.password as HTMLInputElement).value;

      try {
        await login(email, password);
      } catch (error) {
        alert('Login failed. Please check your credentials.');
      }
    };

    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to AI ProjectHub</h1>
            <p className="text-gray-600">Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                name="email"
                type="email"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                name="password"
                type="password"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  };

  // Simple navigation component  
  const SimpleNavigation = () => {
    const { user, logout } = useAuth();
    
    return (
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">AI ProjectHub</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <a 
                href="/" 
                className={`px-3 py-2 rounded-md text-sm ${location === '/' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Dashboard
              </a>
              <a 
                href="/projects" 
                className={`px-3 py-2 rounded-md text-sm ${location === '/projects' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Projects
              </a>
              <a 
                href="/tasks" 
                className={`px-3 py-2 rounded-md text-sm ${location === '/tasks' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Tasks
              </a>
              <a 
                href="/calendar" 
                className={`px-3 py-2 rounded-md text-sm ${location === '/calendar' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Calendar
              </a>
              <a 
                href="/meetings" 
                className={`px-3 py-2 rounded-md text-sm ${location === '/meetings' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:text-gray-900'}`}
              >
                Meetings
              </a>
              
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Hi, {user?.name}!</span>
                <button
                  onClick={() => logout()}
                  className="text-sm bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!user) {
    return <SimpleLogin />;
  }

  // Show main app if authenticated
  return (
    <div className="min-h-screen bg-gray-50">
      <SimpleNavigation />
      
      <main className="py-6">
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/projects" component={Projects} />
          <Route path="/tasks" component={Tasks} />
          <Route path="/calendar" component={Calendar} />
          <Route path="/meetings" component={Meetings} />
          <Route path="/settings" component={Settings} />
          <Route>
            <div className="max-w-7xl mx-auto px-4">
              <div className="text-center py-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Page Not Found</h2>
                <p className="text-gray-600">The page you're looking for doesn't exist.</p>
                <a href="/" className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                  Go Home
                </a>
              </div>
            </div>
          </Route>
        </Switch>
      </main>
    </div>
  );
}