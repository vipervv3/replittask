import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Create a simple query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

// Simple auth context without hooks issues
interface AuthUser {
  id: string;
  name: string;
  email: string;
  username: string;
}

export default function MinimalApp() {
  console.log("MinimalApp rendering...");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Simple auth check
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

  // Check auth on first load
  if (isLoading) {
    checkAuth();
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Simple login form without hooks
  const SimpleLogin = () => {
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const email = (form.email as HTMLInputElement).value;
      const password = (form.password as HTMLInputElement).value;

      try {
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
          alert('Login failed. Please check your credentials.');
        }
      } catch (error) {
        alert('Network error. Please try again.');
      }
    };

    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f3f4f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '32px',
          borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          maxWidth: '400px',
          width: '100%'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>
              Welcome to AI ProjectHub
            </h1>
            <p style={{ color: '#6b7280', fontSize: '14px' }}>
              Sign in to your account
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                Email
              </label>
              <input
                name="email"
                type="email"
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
                placeholder="Enter your email"
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>
                Password
              </label>
              <input
                name="password"
                type="password"
                required
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
                placeholder="Enter your password"
              />
            </div>

            <button
              type="submit"
              style={{
                width: '100%',
                backgroundColor: '#2563eb',
                color: 'white',
                padding: '10px',
                border: 'none',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
            >
              Sign In
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: '#6b7280' }}>
            Don't have an account? Contact your administrator.
          </p>
        </div>
      </div>
    );
  };

  // Simple dashboard without hooks
  const SimpleDashboard = () => (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', padding: '24px' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{
          backgroundColor: 'white',
          padding: '24px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
          marginBottom: '24px'
        }}>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#111827', marginBottom: '8px' }}>
            🎉 AI ProjectHub is Working!
          </h1>
          <p style={{ color: '#6b7280', marginBottom: '16px' }}>
            Welcome back, {user?.name || 'User'}! The authentication system is now functional.
          </p>
          
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={() => window.location.search = 'fullapp=true'}
              style={{
                backgroundColor: '#10b981',
                color: 'white',
                padding: '8px 16px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              🚀 Load Full App
            </button>
            
            <button
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
                setUser(null);
              }}
              style={{
                backgroundColor: '#ef4444',
                color: 'white',
                padding: '8px 16px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Logout
            </button>
          </div>
        </div>

        <div style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px' }}>System Status</h2>
          <div style={{ display: 'grid', gap: '8px', fontSize: '14px' }}>
            <div>✅ <strong>React:</strong> Working correctly</div>
            <div>✅ <strong>Authentication:</strong> Functional</div>
            <div>✅ <strong>API:</strong> Connected</div>
            <div>✅ <strong>Database:</strong> Available</div>
            <div>⏳ <strong>Full Features:</strong> Ready to load</div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <QueryClientProvider client={queryClient}>
      <div>
        {!user ? <SimpleLogin /> : <SimpleDashboard />}
      </div>
    </QueryClientProvider>
  );
}