import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Brain, UserPlus, LogIn, Fingerprint, Shield, Eye } from "lucide-react";
import { 
  isBiometricSupported, 
  authenticateWithBiometric, 
  registerBiometric,
  getDeviceName,
  getWebAuthnErrorMessage 
} from "@/lib/webauthn";

const baseSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const registerSchema = baseSchema.extend({
  name: z.string().min(2, "Name must be at least 2 characters"),
});

const loginSchema = baseSchema.extend({
  name: z.string().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isRegistering, setIsRegistering] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState<boolean | null>(null);
  const [showBiometricLogin, setShowBiometricLogin] = useState(false);
  const [biometricEmail, setBiometricEmail] = useState("");

  // Check biometric support on component mount
  useEffect(() => {
    const checkBiometricSupport = async () => {
      try {
        const supported = await isBiometricSupported();
        setBiometricSupported(supported);
      } catch (error) {
        console.error('Error checking biometric support:', error);
        setBiometricSupported(false);
      }
    };
    
    checkBiometricSupport();
  }, []);

  const form = useForm<LoginForm>({
    resolver: zodResolver(isRegistering ? registerSchema : loginSchema),
    defaultValues: {
      email: "",
      password: "",
      name: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: (data: LoginForm) => {
      const payload = isRegistering 
        ? { email: data.email, password: data.password, name: data.name || data.email.split('@')[0] }
        : { email: data.email, password: data.password };
        
      return fetch(`/api/${isRegistering ? 'register' : 'login'}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Important for sessions
        body: JSON.stringify(payload),
      }).then(async res => {
        const responseData = await res.json();
        if (!res.ok) {
          throw new Error(responseData.error || "Authentication failed");
        }
        return responseData;
      });
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/me"], { user: data.user });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: isRegistering ? "Account created successfully!" : "Welcome back!",
        description: isRegistering 
          ? "You can now start managing your projects" 
          : `Logged in as ${data.user.name}`,
      });
      // Navigate to dashboard after successful login
      window.location.href = "/dashboard";
    },
    onError: (error: any) => {
      toast({
        title: "Authentication failed",
        description: error.message || "Please check your credentials and try again",
        variant: "destructive",
      });
    },
  });

  // Biometric authentication mutation
  const biometricLoginMutation = useMutation({
    mutationFn: async (email: string) => {
      return await authenticateWithBiometric(email);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/me"], { user: data.user });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: "Welcome back!",
        description: `Authenticated with biometrics as ${data.user.name}`,
      });
      window.location.href = "/dashboard";
    },
    onError: (error: any) => {
      toast({
        title: "Biometric authentication failed",
        description: getWebAuthnErrorMessage(error),
        variant: "destructive",
      });
    },
  });


  const onSubmit = (data: LoginForm) => {
    loginMutation.mutate(data);
  };

  const handleBiometricLogin = () => {
    if (biometricEmail) {
      biometricLoginMutation.mutate(biometricEmail);
    }
  };


  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
              <Brain className="h-6 w-6 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl">
            {isRegistering ? "Create Account" : "Welcome Back"}
          </CardTitle>
          <CardDescription>
            {isRegistering 
              ? "Start managing your AI-powered projects" 
              : "Sign in to your AI ProjectHub account"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input 
                        type="email" 
                        placeholder="you@example.com" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isRegistering && (
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input 
                          type="text" 
                          placeholder="Your full name" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder={isRegistering ? "Choose a secure password" : "Enter your password"}
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full" 
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  "Please wait..."
                ) : (
                  <>
                    {isRegistering ? (
                      <><UserPlus className="mr-2 h-4 w-4" /> Create Account</>
                    ) : (
                      <><LogIn className="mr-2 h-4 w-4" /> Sign In</>
                    )}
                  </>
                )}
              </Button>
            </form>
          </Form>

          {/* Biometric Authentication Section */}
          {biometricSupported && !isRegistering && (
            <>
              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                  </div>
                </div>
              </div>

              {!showBiometricLogin ? (
                <div className="mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => setShowBiometricLogin(true)}
                    data-testid="button-biometric-option"
                  >
                    <Fingerprint className="mr-2 h-4 w-4" />
                    Use Fingerprint or Face ID
                  </Button>
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="biometric-email" className="text-sm font-medium">
                      Email for biometric authentication
                    </label>
                    <Input
                      id="biometric-email"
                      type="email"
                      placeholder="Enter your email"
                      value={biometricEmail}
                      onChange={(e) => setBiometricEmail(e.target.value)}
                      data-testid="input-biometric-email"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowBiometricLogin(false)}
                      data-testid="button-biometric-cancel"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={handleBiometricLogin}
                      disabled={!biometricEmail || biometricLoginMutation.isPending}
                      data-testid="button-biometric-authenticate"
                    >
                      {biometricLoginMutation.isPending ? (
                        "Authenticating..."
                      ) : (
                        <>
                          <Fingerprint className="mr-2 h-4 w-4" />
                          Authenticate
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Info about biometric setup */}
          {biometricSupported && !isRegistering && !showBiometricLogin && (
            <div className="mt-4">
              <div className="text-center text-xs text-gray-500 bg-blue-50 p-3 rounded-lg">
                <Shield className="h-4 w-4 text-blue-600 mx-auto mb-1" />
                <p>Set up fingerprint or Face ID authentication in Settings after logging in</p>
              </div>
            </div>
          )}

          <div className="mt-6 text-center">
            <Button
              variant="link"
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-sm"
              data-testid="button-toggle-register"
            >
              {isRegistering 
                ? "Already have an account? Sign in" 
                : "Don't have an account? Sign up"
              }
            </Button>
          </div>

          {isRegistering && (
            <Alert className="mt-4">
              <AlertDescription className="text-sm">
                Your account will be ready immediately with full access to AI-powered project management, 
                voice recording, and intelligent task extraction.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}