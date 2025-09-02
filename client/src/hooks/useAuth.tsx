import { createContext, useContext, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  username: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  console.log("AuthProvider rendering...");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const queryClient = useQueryClient();

  // Check authentication once on mount
  useEffect(() => {
    let mounted = true;
    
    const checkAuth = async () => {
      if (!mounted) return;
      
      try {
        const storedToken = localStorage.getItem('token');
        if (!storedToken) {
          setUser(null);
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          return;
        }

        const response = await fetch("/api/auth", { 
          headers: {
            'Authorization': `Bearer ${storedToken}`
          }
        });
        if (response.ok && mounted) {
          const data = await response.json();
          setUser(data.user);
        } else if (mounted) {
          localStorage.removeItem('token');
          setUser(null);
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
      } catch (error) {
        if (mounted) {
          setUser(null);
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    // Only check once on mount
    checkAuth();

    return () => {
      mounted = false;
    };
  }, []); // Only run once on mount

  const loginMutation = useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) throw new Error("Login failed");
      return response.json();
    },
    onSuccess: (data) => {
      setUser(data.user);
      if (data.token) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
      }
      // Redirect to dashboard after successful login
      window.location.href = '/dashboard';
    },
  });

  const registerMutation = useMutation({
    mutationFn: async ({ email, password, name }: { email: string; password: string; name: string }) => {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, name }),
      });
      if (!response.ok) throw new Error("Registration failed");
      return response.json();
    },
    onSuccess: (data) => {
      setUser(data.user);
      if (data.token) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
      }
      // Redirect to dashboard after successful registration
      window.location.href = '/dashboard';
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => {
      // Just clear local storage, no need for server call with JWT
      localStorage.removeItem('token');
      return Promise.resolve();
    },
    onSuccess: () => {
      setUser(null);
      setToken(null);
      queryClient.clear();
      window.location.href = "/login";
    },
  });

  const login = async (email: string, password: string) => {
    await loginMutation.mutateAsync({ email, password });
  };

  const register = async (email: string, password: string, name: string) => {
    await registerMutation.mutateAsync({ email, password, name });
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
  };

  const value: AuthContextType = {
    user,
    isLoading,
    login,
    register,
    logout,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}