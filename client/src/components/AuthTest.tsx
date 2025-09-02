import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";

export default function AuthTest() {
  const [email, setEmail] = useState("test@example.com");
  const [password, setPassword] = useState("password123");
  const [name, setName] = useState("Test User");
  const { user, login, register, logout, isAuthenticated } = useAuth();

  const handleLogin = async () => {
    try {
      await login(email, password);
      alert("Login successful!");
    } catch (error) {
      alert("Login failed: " + (error as Error).message);
    }
  };

  const handleRegister = async () => {
    try {
      await register(email, password, name);
      alert("Registration successful!");
    } catch (error) {
      alert("Registration failed: " + (error as Error).message);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      alert("Logout successful!");
    } catch (error) {
      alert("Logout failed: " + (error as Error).message);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Authentication Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input 
              id="name"
              value={name} 
              onChange={(e) => setName(e.target.value)} 
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email"
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input 
              id="password"
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
            />
          </div>
          
          <div className="space-y-2">
            <Button onClick={handleRegister} className="w-full">
              Register
            </Button>
            <Button onClick={handleLogin} variant="outline" className="w-full">
              Login
            </Button>
            {isAuthenticated && (
              <Button onClick={handleLogout} variant="destructive" className="w-full">
                Logout
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current User</CardTitle>
        </CardHeader>
        <CardContent>
          {isAuthenticated && user ? (
            <div className="space-y-1">
              <p><strong>Name:</strong> {user.name}</p>
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Username:</strong> {user.username}</p>
              <p><strong>ID:</strong> {user.id}</p>
            </div>
          ) : (
            <p className="text-gray-500">Not logged in</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}