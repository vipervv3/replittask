import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Brain, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Users,
  Target,
  Lightbulb,
  Bell,
  Mail,
  Calendar,
  Activity
} from "lucide-react";
import { useState } from "react";

interface ProjectInsights {
  healthScore: number;
  completionPrediction: string;
  riskFactors: string[];
  recommendations: string[];
  workloadBalance: {
    overloaded: string[];
    underutilized: string[];
  };
}

interface Project {
  id: string;
  name: string;
}

interface SmartNotification {
  id: string;
  type: 'deadline_alert' | 'project_health' | 'workload_balance' | 'ai_suggestion' | 'daily_summary';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  message: string;
  actionable: boolean;
  data?: any;
  createdAt: string;
}

interface DailySummary {
  date: string;
  totalTasks: number;
  completedToday: number;
  upcomingDeadlines: number;
  projectsAtRisk: string[];
  keyRecommendations: string[];
  productivityScore: number;
}

interface OverallInsights {
  productivityTrend: number;
  burnoutRisk: string;
  teamEfficiency: number;
  upcomingDeadlines: number;
}

export default function AIInsights() {
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smartAlerts, setSmartAlerts] = useState(true);

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: insights, isLoading } = useQuery<ProjectInsights>({
    queryKey: ["/api/ai/project-insights", selectedProject],
    enabled: !!selectedProject,
  });

  const { data: notifications } = useQuery<SmartNotification[]>({
    queryKey: ["/api/ai/notifications"],
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: dailySummary } = useQuery<DailySummary>({
    queryKey: ["/api/ai/daily-summary"],
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  const { data: overallInsights, isLoading: overallLoading } = useQuery<OverallInsights>({
    queryKey: ["/api/ai/overall-insights"],
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  return (
    <div className="p-4 lg:p-8 pb-20 lg:pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
            AI Insights
          </h1>
          <p className="text-gray-600">
            Intelligent analysis and recommendations for your projects
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Brain className="w-8 h-8 text-secondary" />
          <Badge className="bg-secondary text-white">AI Powered</Badge>
        </div>
      </div>

      {/* Overall Insights Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{(overallInsights?.productivityTrend || 0) > 0 ? '+' : ''}{overallInsights?.productivityTrend || 0}%</div>
            <p className="text-sm text-gray-600">Productivity Trend</p>
            <p className={`text-xs mt-1 ${
              (overallInsights?.productivityTrend || 0) > 0 ? 'text-green-600' :
              (overallInsights?.productivityTrend || 0) < 0 ? 'text-red-600' : 'text-gray-600'
            }`}>
              {(overallInsights?.productivityTrend || 0) > 0 ? '↗ Up from last week' :
               (overallInsights?.productivityTrend || 0) < 0 ? '↘ Down from last week' : '→ No change'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Target className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{overallInsights?.teamEfficiency || 0}%</div>
            <p className="text-sm text-gray-600">Team Efficiency</p>
            <Progress value={overallInsights?.teamEfficiency || 0} className="mt-2 h-1" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{overallInsights?.burnoutRisk || 'Low'}</div>
            <p className="text-sm text-gray-600">Burnout Risk</p>
            <Badge className={`mt-1 ${
              overallInsights?.burnoutRisk === 'High' ? 'bg-red-100 text-red-800' :
              overallInsights?.burnoutRisk === 'Medium' ? 'bg-yellow-100 text-yellow-800' :
              'bg-green-100 text-green-800'
            }`} variant="secondary">
              {overallInsights?.burnoutRisk === 'High' ? 'At Risk' :
               overallInsights?.burnoutRisk === 'Medium' ? 'Caution' : 'Healthy'}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-red-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{overallInsights?.upcomingDeadlines || 0}</div>
            <p className="text-sm text-gray-600">Upcoming Deadlines</p>
            <p className="text-xs text-red-600 mt-1">Next 7 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily Summary */}
      {dailySummary && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="w-5 h-5 mr-2 text-blue-500" />
              Today's AI Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{dailySummary.completedToday}</div>
                <p className="text-sm text-gray-600">Tasks Completed Today</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{dailySummary.upcomingDeadlines}</div>
                <p className="text-sm text-gray-600">Upcoming Deadlines</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{dailySummary.projectsAtRisk.length}</div>
                <p className="text-sm text-gray-600">Projects at Risk</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{dailySummary.productivityScore}%</div>
                <p className="text-sm text-gray-600">Productivity Score</p>
              </div>
            </div>
            
            {dailySummary.keyRecommendations.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">AI Recommendations for Today</h4>
                <div className="space-y-2">
                  {dailySummary.keyRecommendations.map((rec, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                      <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-gray-700">{rec}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Smart Notifications */}
      {notifications && notifications.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <Bell className="w-5 h-5 mr-2 text-orange-500" />
                Smart Notifications
              </div>
              <Badge variant="secondary">{notifications.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {notifications.slice(0, 5).map((notification) => (
                <div key={notification.id} className={`flex items-start space-x-4 p-4 rounded-lg border-l-4 ${
                  notification.priority === 'urgent' ? 'bg-red-50 border-red-400' :
                  notification.priority === 'high' ? 'bg-orange-50 border-orange-400' :
                  notification.priority === 'medium' ? 'bg-yellow-50 border-yellow-400' :
                  'bg-blue-50 border-blue-400'
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    notification.type === 'deadline_alert' ? 'bg-red-100 text-red-600' :
                    notification.type === 'project_health' ? 'bg-orange-100 text-orange-600' :
                    notification.type === 'ai_suggestion' ? 'bg-blue-100 text-blue-600' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {notification.type === 'deadline_alert' ? <Clock className="w-4 h-4" /> :
                     notification.type === 'project_health' ? <AlertTriangle className="w-4 h-4" /> :
                     notification.type === 'ai_suggestion' ? <Lightbulb className="w-4 h-4" /> :
                     <Bell className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-medium text-gray-900">{notification.title}</h4>
                      <Badge variant="outline" className="text-xs">
                        {notification.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{notification.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(notification.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Settings */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Mail className="w-5 h-5 mr-2 text-green-500" />
            AI Notification Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">Email Daily Summary</label>
                <p className="text-sm text-gray-500">Receive daily project insights and recommendations via email</p>
              </div>
              <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">Smart Alerts</label>
                <p className="text-sm text-gray-500">Get proactive notifications about deadlines and project risks</p>
              </div>
              <Switch checked={smartAlerts} onCheckedChange={setSmartAlerts} />
            </div>

            <div className="pt-4 border-t space-y-3">
              <Button 
                className="w-full" 
                onClick={async () => {
                  try {
                    const response = await fetch('/api/ai/send-notification-email', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ 
                        type: 'daily_summary', 
                        email: 'demo@example.com' // In production, use actual user email
                      })
                    });
                    const result = await response.json();
                    alert(result.note || result.message);
                  } catch (error) {
                    console.error('Email send error:', error);
                    alert('Failed to send email');
                  }
                }}
              >
                <Mail className="w-4 h-4 mr-2" />
                Send Daily Summary Email
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={async () => {
                  try {
                    const response = await fetch('/api/ai/send-notification-email', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ 
                        type: 'test_email',
                        email: 'demo@example.com'
                      })
                    });
                    const result = await response.json();
                    alert(result.note || result.message);
                  } catch (error) {
                    console.error('Test email error:', error);
                    alert('Failed to send test email');
                  }
                }}
              >
                <Bell className="w-4 h-4 mr-2" />
                Send Test Email
              </Button>

              {selectedProject && (
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={async () => {
                    try {
                      const response = await fetch(`/api/ai/notify-project-members/${selectedProject}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                          type: 'health_alert',
                          message: 'Project needs your attention based on AI analysis'
                        })
                      });
                      const result = await response.json();
                      alert(`${result.message}\n${result.emailsSent ? 'Emails sent via Resend' : 'Emails logged to console (Resend not configured)'}`);
                    } catch (error) {
                      console.error('Member notification error:', error);
                      alert('Failed to notify project members');
                    }
                  }}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Notify Project Members
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Project-Specific Insights */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Project Selection & Health */}
        <Card>
          <CardHeader>
            <CardTitle>Project Health Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Project
              </label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a project to analyze..." />
                </SelectTrigger>
                <SelectContent>
                  {projects?.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedProject && insights && !isLoading && (
              <div className="space-y-6">
                {/* Health Score */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Health Score</span>
                    <span className="text-lg font-bold text-gray-900">{insights.healthScore}/100</span>
                  </div>
                  <Progress value={insights.healthScore} className="mb-2" />
                  <p className="text-xs text-gray-500">
                    {insights.healthScore >= 80 ? "Excellent" : 
                     insights.healthScore >= 60 ? "Good" : 
                     insights.healthScore >= 40 ? "Needs Attention" : "Critical"}
                  </p>
                </div>

                {/* Completion Prediction */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Completion Prediction</h4>
                  <p className="text-sm text-gray-900">{insights.completionPrediction}</p>
                </div>

                {/* Risk Factors */}
                {insights.riskFactors.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Risk Factors</h4>
                    <div className="space-y-2">
                      {insights.riskFactors.map((risk, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                          <span className="text-sm text-gray-600">{risk}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedProject && isLoading && (
              <div className="flex items-center justify-center h-32">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-sm text-gray-500">Analyzing project...</p>
                </div>
              </div>
            )}

            {!selectedProject && (
              <div className="text-center py-8">
                <Brain className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-sm text-gray-500">Select a project to view AI insights</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle>Smart Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedProject && insights && !isLoading && (
              <div className="space-y-4">
                {insights.recommendations.map((recommendation, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
                    <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-700">{recommendation}</p>
                  </div>
                ))}
                
                {insights.recommendations.length === 0 && (
                  <div className="text-center py-4">
                    <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No recommendations - project is on track!</p>
                  </div>
                )}
              </div>
            )}

            {selectedProject && isLoading && (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            )}

            {!selectedProject && (
              <div className="text-center py-8">
                <Lightbulb className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-sm text-gray-500">Project recommendations will appear here</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
