import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell, 
  BarChart, 
  Bar, 
  ResponsiveContainer,
  Legend
} from "recharts";
import { 
  Shield, 
  Lock, 
  Smartphone, 
  Clock, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  Activity,
  Fingerprint,
  Key
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface SecurityAnalytics {
  totalLogins: number;
  biometricLogins: number;
  passwordLogins: number;
  failedAttempts: number;
  uniqueDevices: number;
  lastLogin: string | null;
  averageSessionDuration: number;
  loginFrequency: { date: string; count: number; method: string }[];
  deviceBreakdown: { deviceName: string; count: number; lastUsed: string }[];
  recentEvents: Array<{
    id: string;
    type: string;
    method: string;
    deviceName: string | null;
    createdAt: string;
    ipAddress: string | null;
    location: string | null;
  }>;
}

const COLORS = {
  biometric: "#10b981", // green
  password: "#3b82f6", // blue
  failed: "#ef4444", // red
  success: "#22c55e", // light green
};

const getEventIcon = (type: string, method: string) => {
  if (type.includes("failure")) return <AlertTriangle className="h-4 w-4 text-red-500" />;
  if (method === "biometric") return <Fingerprint className="h-4 w-4 text-green-500" />;
  if (method === "password") return <Key className="h-4 w-4 text-blue-500" />;
  return <CheckCircle className="h-4 w-4 text-gray-500" />;
};

const getEventBadgeVariant = (type: string) => {
  if (type.includes("failure")) return "destructive";
  if (type.includes("success") || type.includes("login")) return "default";
  return "secondary";
};

export default function Security() {
  const { data: analytics, isLoading } = useQuery<SecurityAnalytics>({
    queryKey: ["/api/auth/security-analytics"],
  });

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center space-x-3">
          <Shield className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold">Security Dashboard</h1>
            <p className="text-gray-500">Loading security analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center space-x-3">
          <Shield className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold">Security Dashboard</h1>
            <p className="text-gray-500">Unable to load security data</p>
          </div>
        </div>
      </div>
    );
  }

  const securityScore = Math.round(
    ((analytics.biometricLogins / Math.max(analytics.totalLogins, 1)) * 40) +
    (Math.min(analytics.uniqueDevices / 3, 1) * 20) +
    (Math.max(1 - (analytics.failedAttempts / Math.max(analytics.totalLogins, 1)), 0) * 40)
  );

  const authMethodData = [
    { name: "Biometric", value: analytics.biometricLogins, color: COLORS.biometric },
    { name: "Password", value: analytics.passwordLogins, color: COLORS.password },
  ].filter(item => item.value > 0);

  const loginActivityData = analytics.loginFrequency.reduce((acc, curr) => {
    const existingDate = acc.find(item => item.date === curr.date);
    if (existingDate) {
      existingDate[curr.method] = curr.count;
    } else {
      acc.push({
        date: curr.date,
        [curr.method]: curr.count,
        biometric: curr.method === 'biometric' ? curr.count : 0,
        password: curr.method === 'password' ? curr.count : 0,
      });
    }
    return acc;
  }, [] as any[]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center space-x-3">
        <Shield className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold">Security Dashboard</h1>
          <p className="text-gray-500">Monitor your account security and authentication patterns</p>
        </div>
      </div>

      {/* Security Score Overview */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{securityScore}/100</div>
            <p className="text-xs text-muted-foreground">
              {securityScore >= 80 ? "Excellent" : securityScore >= 60 ? "Good" : "Needs Improvement"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Logins</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalLogins}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Devices</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.uniqueDevices}</div>
            <p className="text-xs text-muted-foreground">Unique devices used</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Attempts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{analytics.failedAttempts}</div>
            <p className="text-xs text-muted-foreground">Security incidents</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Authentication Methods Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Lock className="h-5 w-5" />
              <span>Authentication Methods</span>
            </CardTitle>
            <CardDescription>
              Distribution of login methods used
            </CardDescription>
          </CardHeader>
          <CardContent>
            {authMethodData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={authMethodData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {authMethodData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                No login data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Login Activity Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Login Activity</span>
            </CardTitle>
            <CardDescription>
              Daily login frequency by method
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loginActivityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={loginActivityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => format(new Date(value), "MMM dd")}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(value) => format(new Date(value), "MMMM dd, yyyy")}
                  />
                  <Legend />
                  <Bar dataKey="biometric" stackId="a" fill={COLORS.biometric} name="Biometric" />
                  <Bar dataKey="password" stackId="a" fill={COLORS.password} name="Password" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                No activity data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Device Usage and Recent Events */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Device Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Smartphone className="h-5 w-5" />
              <span>Device Usage</span>
            </CardTitle>
            <CardDescription>
              Devices used to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.deviceBreakdown.length > 0 ? (
                analytics.deviceBreakdown.map((device, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center space-x-3">
                      <Smartphone className="h-5 w-5 text-gray-500" />
                      <div>
                        <p className="font-medium">{device.deviceName}</p>
                        <p className="text-sm text-gray-500">
                          {device.count} login{device.count !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Last used</p>
                      <p className="text-sm font-medium">
                        {formatDistanceToNow(new Date(device.lastUsed), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-8">No device data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Security Events */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Recent Activity</span>
            </CardTitle>
            <CardDescription>
              Latest authentication events
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.recentEvents.length > 0 ? (
                analytics.recentEvents.map((event, index) => (
                  <div key={event.id} className="flex items-center space-x-3 p-3 rounded-lg border">
                    {getEventIcon(event.type, event.method)}
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <Badge variant={getEventBadgeVariant(event.type)}>
                          {event.type.replace(/_/g, ' ').toUpperCase()}
                        </Badge>
                        <span className="text-sm text-gray-500">
                          via {event.method}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {event.deviceName && `${event.deviceName} • `}
                        {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-8">No recent activity</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Security Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Security Recommendations</span>
          </CardTitle>
          <CardDescription>
            Suggestions to improve your account security
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics.biometricLogins === 0 && (
              <div className="flex items-start space-x-3 p-4 rounded-lg bg-blue-50 border border-blue-200">
                <Fingerprint className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-900">Enable Biometric Authentication</h4>
                  <p className="text-sm text-blue-700">
                    Set up fingerprint or Face ID authentication in Settings for enhanced security and convenience.
                  </p>
                </div>
              </div>
            )}
            
            {analytics.failedAttempts > 3 && (
              <div className="flex items-start space-x-3 p-4 rounded-lg bg-red-50 border border-red-200">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-red-900">Multiple Failed Login Attempts</h4>
                  <p className="text-sm text-red-700">
                    We detected {analytics.failedAttempts} failed login attempts. Consider changing your password if you suspect unauthorized access.
                  </p>
                </div>
              </div>
            )}
            
            {securityScore >= 80 && (
              <div className="flex items-start space-x-3 p-4 rounded-lg bg-green-50 border border-green-200">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-green-900">Excellent Security</h4>
                  <p className="text-sm text-green-700">
                    Your account security is excellent! Keep up the good security practices.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}