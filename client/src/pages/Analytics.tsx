import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Target, 
  Users, 
  Clock,
  Brain,
  Activity,
  BarChart3,
  PieChart,
  Zap,
  Shield,
  Calendar,
  CheckCircle2,
  AlertCircle,
  XCircle
} from "lucide-react";

interface ProjectPrediction {
  projectId: string;
  successProbability: number;
  riskFactors: string[];
  recommendations: string[];
  timelineConfidence: number;
  resourceUtilization: number;
  completionPrediction: string;
  criticalPath: string[];
}

interface WorkloadAnalysis {
  userId: string;
  burnoutRisk: 'Low' | 'Medium' | 'High' | 'Critical';
  workloadScore: number;
  weeklyHours: number;
  taskDistribution: {
    urgent: number;
    high: number;
    medium: number;
    low: number;
  };
  recommendations: string[];
  optimalCapacity: number;
}

interface AnalyticsDashboard {
  overview: {
    totalProjects: number;
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    completionRate: number;
    avgSuccessProbability: number;
  };
  workload: WorkloadAnalysis;
  projectPredictions: ProjectPrediction[];
  riskAlerts: Array<{
    projectId: string;
    projectName: string;
    risk: number;
    factors: string[];
  }>;
  recommendations: string[];
}

function getRiskColor(risk: number) {
  if (risk >= 80) return "text-green-600 bg-green-50";
  if (risk >= 60) return "text-yellow-600 bg-yellow-50";
  if (risk >= 40) return "text-orange-600 bg-orange-50";
  return "text-red-600 bg-red-50";
}

function getBurnoutColor(level: string) {
  switch (level) {
    case 'Low': return "text-green-600 bg-green-50";
    case 'Medium': return "text-yellow-600 bg-yellow-50";
    case 'High': return "text-orange-600 bg-orange-50";
    case 'Critical': return "text-red-600 bg-red-50";
    default: return "text-gray-600 bg-gray-50";
  }
}

export default function Analytics() {
  const [activeTab, setActiveTab] = useState("overview");

  const { data: analytics, isLoading } = useQuery<AnalyticsDashboard>({
    queryKey: ["/api/analytics/dashboard"],
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  const { data: resourceOptimization, isLoading: resourceLoading } = useQuery<any>({
    queryKey: ["/api/analytics/resource-optimization"],
    refetchInterval: 600000, // Refresh every 10 minutes
  });

  if (isLoading) {
    return (
      <div className="p-4 lg:p-8 pb-20 lg:pb-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-500">Analyzing your data with AI...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="p-4 lg:p-8 pb-20 lg:pb-8">
        <div className="text-center py-8">
          <AlertTriangle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Analytics Unavailable</h3>
          <p className="text-gray-500">Unable to load analytics data. Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 pb-20 lg:pb-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Brain className="h-8 w-8 text-purple-600" />
              AI Analytics Dashboard
            </h1>
            <p className="text-gray-500 mt-2">
              Predictive insights powered by artificial intelligence
            </p>
          </div>
          <Badge variant="secondary" className="bg-purple-100 text-purple-800">
            <Activity className="h-4 w-4 mr-1" />
            Real-time Analysis
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="projects">Project Health</TabsTrigger>
          <TabsTrigger value="workload">Team Workload</TabsTrigger>
          <TabsTrigger value="predictions">Predictions</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                <Target className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {analytics.overview.avgSuccessProbability}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Average project success probability
                </p>
                <Progress value={analytics.overview.avgSuccessProbability} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {analytics.overview.completionRate}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {analytics.overview.completedTasks} of {analytics.overview.totalTasks} tasks
                </p>
                <Progress value={analytics.overview.completionRate} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Burnout Risk</CardTitle>
                <Shield className={`h-4 w-4 ${
                  analytics.workload.burnoutRisk === 'Low' ? 'text-green-600' :
                  analytics.workload.burnoutRisk === 'Medium' ? 'text-yellow-600' :
                  analytics.workload.burnoutRisk === 'High' ? 'text-orange-600' : 'text-red-600'
                }`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${
                  analytics.workload.burnoutRisk === 'Low' ? 'text-green-600' :
                  analytics.workload.burnoutRisk === 'Medium' ? 'text-yellow-600' :
                  analytics.workload.burnoutRisk === 'High' ? 'text-orange-600' : 'text-red-600'
                }`}>
                  {analytics.workload.burnoutRisk}
                </div>
                <p className="text-xs text-muted-foreground">
                  {analytics.workload.weeklyHours}h weekly workload
                </p>
                <Progress value={analytics.workload.workloadScore} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overdue Tasks</CardTitle>
                <AlertCircle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {analytics.overview.overdueTasks}
                </div>
                <p className="text-xs text-muted-foreground">
                  Need immediate attention
                </p>
                {analytics.overview.overdueTasks > 0 && (
                  <Badge variant="destructive" className="mt-2">Urgent</Badge>
                )}
              </CardContent>
            </Card>
          </div>

          {/* AI Recommendations */}
          {analytics.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-600" />
                  AI Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.recommendations.map((recommendation, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400"
                    >
                      <Brain className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-blue-800">{recommendation}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Risk Alerts */}
          {analytics.riskAlerts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  Risk Alerts ({analytics.riskAlerts.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.riskAlerts.map((alert, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <h4 className="font-medium text-red-900">{alert.projectName}</h4>
                          <Badge variant="destructive">
                            {alert.risk}% Success Rate
                          </Badge>
                        </div>
                        <ul className="mt-2 space-y-1">
                          {alert.factors.map((factor, factorIndex) => (
                            <li key={factorIndex} className="text-sm text-red-700 flex items-center gap-2">
                              <XCircle className="h-3 w-3" />
                              {factor}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <Button variant="outline" size="sm" className="ml-4">
                        View Project
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Project Health Tab */}
        <TabsContent value="projects" className="space-y-6">
          <div className="grid gap-6">
            {analytics.projectPredictions.map((prediction, index) => (
              <Card key={prediction.projectId}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Project Analysis #{index + 1}
                    </CardTitle>
                    <Badge className={getRiskColor(prediction.successProbability)}>
                      {prediction.successProbability}% Success Rate
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {prediction.successProbability}%
                      </div>
                      <div className="text-sm text-muted-foreground">Success Probability</div>
                      <Progress value={prediction.successProbability} className="mt-2" />
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {prediction.timelineConfidence}%
                      </div>
                      <div className="text-sm text-muted-foreground">Timeline Confidence</div>
                      <Progress value={prediction.timelineConfidence} className="mt-2" />
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {prediction.resourceUtilization}%
                      </div>
                      <div className="text-sm text-muted-foreground">Resource Utilization</div>
                      <Progress value={prediction.resourceUtilization} className="mt-2" />
                    </div>
                  </div>

                  {/* Completion Prediction */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-4 w-4 text-gray-600" />
                      <span className="font-medium">Predicted Completion</span>
                    </div>
                    <p className="text-lg font-semibold text-gray-900">
                      {new Date(prediction.completionPrediction).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>

                  {/* Risk Factors */}
                  {prediction.riskFactors.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                        Risk Factors
                      </h4>
                      <div className="space-y-2">
                        {prediction.riskFactors.map((factor, factorIndex) => (
                          <div
                            key={factorIndex}
                            className="flex items-center gap-2 p-2 bg-orange-50 rounded text-orange-800 text-sm"
                          >
                            <AlertCircle className="h-3 w-3" />
                            {factor}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {prediction.recommendations.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Brain className="h-4 w-4 text-blue-600" />
                        AI Recommendations
                      </h4>
                      <div className="space-y-2">
                        {prediction.recommendations.map((recommendation, recIndex) => (
                          <div
                            key={recIndex}
                            className="flex items-start gap-2 p-2 bg-blue-50 rounded text-blue-800 text-sm"
                          >
                            <CheckCircle2 className="h-3 w-3 mt-0.5" />
                            {recommendation}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Critical Path */}
                  {prediction.criticalPath.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Target className="h-4 w-4 text-purple-600" />
                        Critical Path
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {prediction.criticalPath.map((item, pathIndex) => (
                          <Badge key={pathIndex} variant="outline" className="bg-purple-50 text-purple-800">
                            {item}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Team Workload Tab */}
        <TabsContent value="workload" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Workload Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Workload Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Burnout Risk Level</span>
                  <Badge className={getBurnoutColor(analytics.workload.burnoutRisk)}>
                    {analytics.workload.burnoutRisk}
                  </Badge>
                </div>
                
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm">Current Workload</span>
                    <span className="text-sm font-medium">{analytics.workload.workloadScore}%</span>
                  </div>
                  <Progress value={analytics.workload.workloadScore} className="mb-1" />
                  <p className="text-xs text-muted-foreground">
                    Optimal capacity: {analytics.workload.optimalCapacity}%
                  </p>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm">Weekly Hours</span>
                    <span className="text-sm font-medium">{analytics.workload.weeklyHours}h</span>
                  </div>
                  <Progress value={Math.min(100, (analytics.workload.weeklyHours / 60) * 100)} className="mb-1" />
                  <p className="text-xs text-muted-foreground">
                    Recommended: 40-45 hours per week
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Task Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Task Priority Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(analytics.workload.taskDistribution).map(([priority, count]) => (
                    <div key={priority} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${
                          priority === 'urgent' ? 'bg-red-500' :
                          priority === 'high' ? 'bg-orange-500' :
                          priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                        }`} />
                        <span className="capitalize text-sm">{priority} Priority</span>
                      </div>
                      <Badge variant="secondary">{count} tasks</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Workload Recommendations */}
          {analytics.workload.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-blue-600" />
                  Workload Optimization Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.workload.recommendations.map((recommendation, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg"
                    >
                      <Zap className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-blue-800">{recommendation}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Resource Optimization */}
          {!resourceLoading && resourceOptimization && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-green-600" />
                  Team Efficiency: {resourceOptimization.teamEfficiencyScore}%
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Progress value={resourceOptimization.teamEfficiencyScore} className="mb-4" />
                
                {resourceOptimization.redistributionSuggestions.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Redistribution Suggestions:</h4>
                    {resourceOptimization.redistributionSuggestions.map((suggestion: any, index: number) => (
                      <div key={index} className="p-2 bg-green-50 rounded text-green-800 text-sm">
                        {suggestion.reasoning}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Predictions Tab */}
        <TabsContent value="predictions" className="space-y-6">
          <div className="text-center py-8">
            <Brain className="mx-auto h-16 w-16 text-purple-600 mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 mb-4">AI Predictive Analytics</h3>
            <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
              Our advanced AI models analyze your project data to provide accurate predictions
              about project success rates, completion timelines, and potential risks.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <div className="text-center">
                <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="h-8 w-8 text-green-600" />
                </div>
                <h4 className="font-semibold mb-2">Success Prediction</h4>
                <p className="text-sm text-gray-600">
                  AI analyzes team performance, task complexity, and historical data to predict project outcomes.
                </p>
              </div>
              
              <div className="text-center">
                <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Clock className="h-8 w-8 text-blue-600" />
                </div>
                <h4 className="font-semibold mb-2">Timeline Forecasting</h4>
                <p className="text-sm text-gray-600">
                  Intelligent estimation of completion dates based on current progress and team velocity.
                </p>
              </div>
              
              <div className="text-center">
                <div className="bg-orange-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                  <Shield className="h-8 w-8 text-orange-600" />
                </div>
                <h4 className="font-semibold mb-2">Risk Assessment</h4>
                <p className="text-sm text-gray-600">
                  Early detection of potential issues and proactive recommendations to prevent problems.
                </p>
              </div>
            </div>

            <div className="mt-8 p-6 bg-purple-50 rounded-lg border border-purple-200">
              <p className="text-purple-800 text-sm">
                💡 <strong>All predictions are updated in real-time</strong> as your team makes progress.
                The more data available, the more accurate the predictions become.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}