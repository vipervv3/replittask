import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Brain, 
  Mail, 
  Bell, 
  Clock, 
  Shield,
  User,
  Palette,
  Globe,
  LogOut,
  Fingerprint,
  Smartphone,
  Plus,
  Trash2,
  Save,
  Settings as SettingsIcon
} from "lucide-react";
import { 
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSettingsSchema } from "@shared/schema";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { registerBiometric, getWebAuthnErrorMessage } from "@/lib/webauthn";
import { useTheme } from "@/contexts/ThemeContext";

type SettingsFormData = z.infer<typeof insertUserSettingsSchema>;

interface UserSettings {
  id: string;
  userId: string;
  emailNotifications: boolean;
  morningBriefing: boolean;
  lunchReminder: boolean;
  endOfDaySummary: boolean;
  meetingReminders: boolean;
  taskDeadlineAlerts: boolean;
  aiInsights: boolean;
  workingHoursStart: string;
  workingHoursEnd: string;
  urgentOnly: boolean;
  updatedAt: string;
}

// Profile form schema
const profileFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

export default function Settings() {
  const [activeSection, setActiveSection] = useState("profile");
  const { toast } = useToast();
  const { logout, user } = useAuth();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();

  // Profile form setup
  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
    },
  });

  // Update form values when user data loads (only once)
  useEffect(() => {
    if (user && !form.formState.isDirty) {
      form.reset({
        name: user.name,
        email: user.email,
      });
    }
  }, [user]);
  
  // Biometric authentication state
  const [biometricSupported, setBiometricSupported] = useState(false);

  // Check biometric support on component mount
  useEffect(() => {
    const checkBiometricSupport = async () => {
      try {
        const { isBiometricSupported } = await import('@/lib/webauthn');
        const supported = await isBiometricSupported();
        setBiometricSupported(supported);
      } catch (error) {
        console.error('Error checking biometric support:', error);
        setBiometricSupported(false);
      }
    };
    
    checkBiometricSupport();
  }, []);

  const { data: settings, isLoading } = useQuery<UserSettings>({
    queryKey: ["/api/settings"],
  });

  // Get user's registered authenticators
  const { data: authenticators, isLoading: isLoadingAuthenticators } = useQuery({
    queryKey: ["/api/auth/webauthn/authenticators"],
    enabled: biometricSupported, // Only fetch if biometric is supported
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: Partial<SettingsFormData>) => {
      const response = await apiRequest("PUT", "/api/settings", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Success",
        description: "Settings updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive",
      });
    },
  });

  const testEmailMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/settings/test-email", {});
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Test email sent successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send test email",
        variant: "destructive",
      });
    },
  });

  const sendDailyBriefingMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/daily-briefing/send", {});
      return response.json();
    },
    onSuccess: (data) => {
      if (data.emailSent) {
        toast({
          title: "Daily Briefing Sent!",
          description: "Your AI-powered daily briefing has been sent to your email",
        });
      } else {
        toast({
          title: "Daily Briefing Generated",
          description: "AI content created successfully. Email delivery requires domain verification for your account.",
          variant: "default",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send daily briefing",
        variant: "destructive",
      });
    },
  });

  const enableDailyBriefingMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/daily-briefing/enable", {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Daily Briefings Enabled!",
        description: "You'll now receive AI-powered daily briefings at 9 AM",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error", 
        description: error.message || "Failed to enable daily briefings",
        variant: "destructive",
      });
    },
  });

  // Profile update mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: { email: string; name: string }) => {
      const response = await apiRequest("PUT", "/api/profile", data);
      return response.json();
    },
    onSuccess: (data) => {
      // Update user in context
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      });
    },
  });

  const handleSettingChange = (key: string, value: any) => {
    updateSettingsMutation.mutate({ [key]: value });
  };

  // Biometric registration mutation
  const biometricRegisterMutation = useMutation({
    mutationFn: async () => {
      const deviceName = `${navigator.platform} - ${new Date().toLocaleDateString()}`;
      await registerBiometric(deviceName);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/webauthn/authenticators"] });
      toast({
        title: "Biometric authentication set up!",
        description: "You can now use fingerprint or face recognition to sign in",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to set up biometric authentication",
        description: getWebAuthnErrorMessage(error),
        variant: "destructive",
      });
    },
  });

  // Delete authenticator mutation
  const deleteAuthenticatorMutation = useMutation({
    mutationFn: async (credentialId: string) => {
      const response = await apiRequest("DELETE", `/api/auth/webauthn/authenticators/${credentialId}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/webauthn/authenticators"] });
      toast({
        title: "Biometric authentication removed",
        description: "The biometric authentication method has been removed",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove biometric authentication",
        variant: "destructive",
      });
    },
  });

  const sections = [
    { id: "profile", label: "Profile", icon: User },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "ai", label: "AI Assistant", icon: Brain },
    { id: "account", label: "Account", icon: SettingsIcon },
    { id: "appearance", label: "Appearance", icon: Palette },
    { id: "privacy", label: "Privacy", icon: Shield },
  ];

  if (isLoading) {
    return (
      <div className="p-4 lg:p-8 pb-20 lg:pb-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-500">Loading settings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 pb-20 lg:pb-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">Manage your account preferences and AI assistant configuration.</p>
      </div>

      <div className="grid lg:grid-cols-4 gap-8">
        {/* Settings Navigation */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-0">
              <nav className="space-y-1">
                {sections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full flex items-center px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                        activeSection === section.id 
                          ? 'bg-primary/10 text-primary border-r-2 border-primary' 
                          : 'text-gray-700'
                      }`}
                    >
                      <Icon className="w-4 h-4 mr-3" />
                      {section.label}
                    </button>
                  );
                })}
              </nav>
            </CardContent>
          </Card>
        </div>

        {/* Settings Content */}
        <div className="lg:col-span-3 space-y-6">
          {activeSection === "profile" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="w-5 h-5 mr-2 text-primary" />
                  Profile Information
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Update your personal information and account details
                </p>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit((data) => updateProfileMutation.mutate(data))} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="Enter your full name"
                              className="max-w-md"
                              data-testid="input-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="email"
                              placeholder="Enter your email address"
                              className="max-w-md"
                              data-testid="input-email"
                              autoComplete="email"
                            />
                          </FormControl>
                          <FormDescription>
                            This email will be used for notifications and account recovery
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex items-center gap-3 pt-4">
                      <Button
                        type="submit"
                        disabled={updateProfileMutation.isPending}
                        data-testid="button-save-profile"
                      >
                        {updateProfileMutation.isPending ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            Save Changes
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}

          {activeSection === "notifications" && (
            <>
              {/* Daily Assistant Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Brain className="w-5 h-5 mr-2 text-secondary" />
                    📧 Daily Assistant Settings
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    Configure how your AI assistant keeps you informed throughout the day
                  </p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Email Notifications Toggle */}
                  <div className="flex items-center justify-between py-4 border-b border-gray-200">
                    <div>
                      <h3 className="font-medium text-gray-900">Enable Email Notifications</h3>
                      <p className="text-sm text-gray-600">
                        Receive intelligent notifications and daily digests via email
                      </p>
                    </div>
                    <Switch
                      checked={settings?.emailNotifications ?? true}
                      onCheckedChange={(checked) => handleSettingChange('emailNotifications', checked)}
                    />
                  </div>

                  {/* Daily Digests */}
                  <div className="py-6 border-b border-gray-200">
                    <h3 className="font-medium text-gray-900 mb-4">Daily Digests</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">Morning Briefing (7:00 AM)</p>
                          <p className="text-sm text-gray-600">
                            Start your day with AI insights, priorities, and schedule overview
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={settings?.morningBriefing ?? true}
                            onCheckedChange={(checked) => handleSettingChange('morningBriefing', checked)}
                          />
                          {!settings?.morningBriefing && (
                            <Button 
                              variant="default" 
                              size="sm"
                              onClick={() => enableDailyBriefingMutation.mutate()}
                              disabled={enableDailyBriefingMutation.isPending}
                            >
                              {enableDailyBriefingMutation.isPending ? "Enabling..." : "Enable"}
                            </Button>
                          )}
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => sendDailyBriefingMutation.mutate()}
                            disabled={sendDailyBriefingMutation.isPending}
                          >
                            {sendDailyBriefingMutation.isPending ? "Sending..." : "Send Now"}
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">Lunch Break Reminder (12:00 PM)</p>
                          <p className="text-sm text-gray-600">
                            Gentle reminder to take a break with afternoon preview
                          </p>
                        </div>
                        <Switch
                          checked={settings?.lunchReminder ?? false}
                          onCheckedChange={(checked) => handleSettingChange('lunchReminder', checked)}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">End of Day Summary (5:00 PM)</p>
                          <p className="text-sm text-gray-600">
                            Review accomplishments and prepare for tomorrow
                          </p>
                        </div>
                        <Switch
                          checked={settings?.endOfDaySummary ?? true}
                          onCheckedChange={(checked) => handleSettingChange('endOfDaySummary', checked)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Smart Notifications */}
                  <div className="py-6 border-b border-gray-200">
                    <h3 className="font-medium text-gray-900 mb-4">Smart Notifications</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">Meeting Reminders</p>
                          <p className="text-sm text-gray-600">
                            Get notified 30 minutes before meetings start
                          </p>
                        </div>
                        <Switch
                          checked={settings?.meetingReminders ?? true}
                          onCheckedChange={(checked) => handleSettingChange('meetingReminders', checked)}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">Task Deadline Alerts</p>
                          <p className="text-sm text-gray-600">
                            Notifications for approaching and overdue tasks
                          </p>
                        </div>
                        <Switch
                          checked={settings?.taskDeadlineAlerts ?? true}
                          onCheckedChange={(checked) => handleSettingChange('taskDeadlineAlerts', checked)}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">AI Proactive Insights</p>
                          <p className="text-sm text-gray-600">
                            Intelligent suggestions for optimization and risk prevention
                          </p>
                        </div>
                        <Switch
                          checked={settings?.aiInsights ?? true}
                          onCheckedChange={(checked) => handleSettingChange('aiInsights', checked)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Working Hours */}
                  <div className="py-6">
                    <h3 className="font-medium text-gray-900 mb-4">Notification Settings</h3>
                    <div className="grid sm:grid-cols-2 gap-6 mb-6">
                      <div>
                        <Label className="block text-sm font-medium text-gray-700 mb-2">
                          Working Hours Start
                        </Label>
                        <Input
                          type="time"
                          value={settings?.workingHoursStart || "09:00"}
                          onChange={(e) => handleSettingChange('workingHoursStart', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="block text-sm font-medium text-gray-700 mb-2">
                          Working Hours End
                        </Label>
                        <Input
                          type="time"
                          value={settings?.workingHoursEnd || "18:00"}
                          onChange={(e) => handleSettingChange('workingHoursEnd', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="urgent-only"
                        checked={settings?.urgentOnly ?? false}
                        onCheckedChange={(checked) => handleSettingChange('urgentOnly', checked)}
                      />
                      <Label htmlFor="urgent-only" className="text-sm text-gray-900">
                        Urgent Notifications Only - Only receive notifications for high-priority and urgent items
                      </Label>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-200">
                    <Button
                      onClick={() => updateSettingsMutation.mutate({})}
                      disabled={updateSettingsMutation.isPending}
                      className="bg-primary hover:bg-primary/90"
                    >
                      {updateSettingsMutation.isPending ? "Saving..." : "Save Preferences"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => testEmailMutation.mutate()}
                      disabled={testEmailMutation.isPending}
                    >
                      {testEmailMutation.isPending ? "Sending..." : "Test Email Configuration"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {activeSection === "ai" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Brain className="w-5 h-5 mr-2 text-secondary" />
                  AI Assistant Configuration
                </CardTitle>
                <p className="text-sm text-gray-600">
                  Customize how the AI assistant helps you manage your projects
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-2">🤖 What your AI assistant does:</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Analyzing your schedule and workload patterns</li>
                    <li>• Providing proactive insights and suggestions</li>
                    <li>• Detecting potential conflicts and risks</li>
                    <li>• Sending timely reminders and updates</li>
                    <li>• Helping you maintain work-life balance</li>
                  </ul>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Voice Recording Analysis</p>
                      <p className="text-sm text-gray-600">
                        Automatically transcribe and extract tasks from meetings
                      </p>
                    </div>
                    <Switch 
                      checked={settings?.aiInsights ?? true}
                      onCheckedChange={(checked) => handleSettingChange('voiceAnalysis', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Project Health Monitoring</p>
                      <p className="text-sm text-gray-600">
                        Regular analysis of project progress and risk factors
                      </p>
                    </div>
                    <Switch 
                      checked={settings?.aiInsights ?? true}
                      onCheckedChange={(checked) => handleSettingChange('projectMonitoring', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">Smart Task Suggestions</p>
                      <p className="text-sm text-gray-600">
                        AI-powered recommendations for task prioritization
                      </p>
                    </div>
                    <Switch 
                      checked={settings?.aiInsights ?? true}
                      onCheckedChange={(checked) => handleSettingChange('smartSuggestions', checked)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === "account" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  Account Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center space-x-4">
                  <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
                    <User className="w-8 h-8 text-gray-500" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{user?.name || 'User'}</h3>
                    <p className="text-sm text-gray-600">Team Member</p>
                    <Button variant="outline" size="sm" className="mt-2">
                      Change Avatar
                    </Button>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name
                    </Label>
                    <Input defaultValue={user?.name || ''} />
                  </div>
                  <div>
                    <Label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </Label>
                    <Input defaultValue={user?.email || ''} disabled className="bg-gray-50" />
                  </div>
                  <div>
                    <Label className="block text-sm font-medium text-gray-700 mb-2">
                      Job Title
                    </Label>
                    <Input defaultValue="Team Member" />
                  </div>
                  <div>
                    <Label className="block text-sm font-medium text-gray-700 mb-2">
                      Time Zone
                    </Label>
                    <Input defaultValue="UTC (Coordinated Universal Time)" />
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button className="bg-primary hover:bg-primary/90">
                    Update Account
                  </Button>
                  <Button 
                    variant="outline" 
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={async () => {
                      try {
                        await logout();
                      } catch (error) {
                        console.error("Logout error:", error);
                        toast({
                          title: "Error",
                          description: "Failed to logout. Please try again.",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === "appearance" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Palette className="w-5 h-5 mr-2" />
                  Appearance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4">
                    Theme 
                    <span className="text-sm font-normal text-gray-500 ml-2">
                      (Current: {theme})
                    </span>
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div 
                      className={`p-4 border-2 rounded-lg bg-white cursor-pointer transition-all hover:shadow-md ${
                        theme === 'light' ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setTheme('light')}
                    >
                      <div className="w-full h-16 bg-gray-100 rounded mb-2"></div>
                      <p className="text-sm font-medium text-center">Light</p>
                    </div>
                    <div 
                      className={`p-4 border-2 rounded-lg bg-gray-900 cursor-pointer transition-all hover:shadow-md ${
                        theme === 'dark' ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setTheme('dark')}
                    >
                      <div className="w-full h-16 bg-gray-800 rounded mb-2"></div>
                      <p className="text-sm font-medium text-center text-white">Dark</p>
                    </div>
                    <div 
                      className={`p-4 border-2 rounded-lg bg-gradient-to-br from-white to-gray-100 cursor-pointer transition-all hover:shadow-md ${
                        theme === 'auto' ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setTheme('auto')}
                    >
                      <div className="w-full h-16 bg-gradient-to-br from-gray-100 to-gray-800 rounded mb-2"></div>
                      <p className="text-sm font-medium text-center">Auto</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
                    {theme === 'auto' && "Automatically adjusts to your system preference"}
                    {theme === 'light' && "Always use light theme"}
                    {theme === 'dark' && "Always use dark theme"}
                  </p>
                </div>

                <div>
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-4">Compact Mode</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">Compact Interface</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Reduce spacing and padding for more content
                      </p>
                    </div>
                    <Switch 
                      disabled
                      title="Coming soon - compact mode will reduce UI spacing for more content"
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                    Compact mode coming soon
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === "privacy" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="w-5 h-5 mr-2" />
                  Privacy & Security
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-medium text-gray-900 mb-4">Data Collection</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">Analytics</p>
                        <p className="text-sm text-gray-600">
                          Help improve the app by sharing usage analytics
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">Voice Recording Storage</p>
                        <p className="text-sm text-gray-600">
                          Store voice recordings for AI analysis
                        </p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-gray-900 mb-4">Security</h3>
                  <div className="space-y-4">
                    {/* Biometric Authentication Section */}
                    <div className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <Fingerprint className="w-5 h-5 text-blue-600" />
                          <div>
                            <h4 className="font-medium text-gray-900">Biometric Authentication</h4>
                            <p className="text-sm text-gray-600">Use fingerprint or Face ID to sign in</p>
                          </div>
                        </div>
                        {biometricSupported && (
                          <Button
                            onClick={() => biometricRegisterMutation.mutate()}
                            disabled={biometricRegisterMutation.isPending}
                            size="sm"
                            data-testid="button-add-biometric"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            {biometricRegisterMutation.isPending ? "Setting up..." : "Add"}
                          </Button>
                        )}
                      </div>

                      {!biometricSupported && (
                        <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded">
                          Biometric authentication is not supported on this device or browser.
                        </div>
                      )}

                      {biometricSupported && !isLoadingAuthenticators && (
                        <div className="space-y-2">
                          {authenticators && Array.isArray(authenticators) && authenticators.length > 0 ? (
                            authenticators.map((auth: any) => (
                              <div key={auth.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center space-x-3">
                                  <Smartphone className="w-4 h-4 text-gray-500" />
                                  <div>
                                    <p className="font-medium text-gray-900">{auth.deviceName || "Biometric Device"}</p>
                                    <p className="text-sm text-gray-500">
                                      Added on {new Date(auth.createdAt).toLocaleDateString()}
                                    </p>
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteAuthenticatorMutation.mutate(auth.id)}
                                  disabled={deleteAuthenticatorMutation.isPending}
                                  data-testid="button-remove-biometric"
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-gray-500 bg-blue-50 p-3 rounded border border-blue-200">
                              No biometric authentication methods set up. Add one above for faster, more secure login.
                            </div>
                          )}
                        </div>
                      )}

                      {isLoadingAuthenticators && (
                        <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded">
                          Loading biometric authentication methods...
                        </div>
                      )}
                    </div>

                    {/* Other Security Options */}
                    <Button variant="outline" className="w-full justify-start">
                      Change Password
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      Download My Data
                    </Button>
                  </div>
                </div>

                <div className="pt-6 border-t border-gray-200">
                  <Button variant="destructive" className="w-full">
                    Delete Account
                  </Button>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    This action cannot be undone. All your data will be permanently deleted.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
