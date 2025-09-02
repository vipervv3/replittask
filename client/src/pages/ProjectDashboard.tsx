import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft,
  Calendar,
  Users,
  Target,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  MoreHorizontal,
  Edit,
  Share
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";

interface Task {
  id: string;
  title: string;
  status: 'todo' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  createdAt: string;
  dueDate: string;
  assignee: string;
  progress: number;
}

function CircularProgressChart({ value, size = 160, label }: { value: number; size?: number; label: string }) {
  const radius = (size - 16) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth="8"
          fill="transparent"
          className="text-gray-200"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth="8"
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          className="text-green-500 transition-all duration-300"
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-gray-900">{value}%</span>
        <span className="text-sm text-gray-500 mt-1">{label}</span>
      </div>
    </div>
  );
}

function SmallCircularProgress({ value, size = 80, color = "text-blue-500" }: { value: number; size?: number; color?: string }) {
  const radius = (size - 8) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
          fill="transparent"
          className="text-gray-200"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          className={color}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold">{value}%</span>
      </div>
    </div>
  );
}

function PieChart({ data }: { data: Array<{ label: string; value: number; color: string }> }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let currentAngle = 0;
  
  const paths = data.map((item) => {
    const percentage = (item.value / total) * 100;
    const angle = (item.value / total) * 360;
    const startAngle = currentAngle;
    currentAngle += angle;
    
    const x1 = Math.cos((startAngle * Math.PI) / 180) * 40;
    const y1 = Math.sin((startAngle * Math.PI) / 180) * 40;
    const x2 = Math.cos(((startAngle + angle) * Math.PI) / 180) * 40;
    const y2 = Math.sin(((startAngle + angle) * Math.PI) / 180) * 40;
    
    const largeArcFlag = angle > 180 ? 1 : 0;
    
    const pathData = [
      `M 50 50`,
      `L ${50 + x1} ${50 + y1}`,
      `A 40 40 0 ${largeArcFlag} 1 ${50 + x2} ${50 + y2}`,
      `Z`
    ].join(' ');
    
    return {
      ...item,
      pathData,
      percentage
    };
  });

  return (
    <div className="flex items-center gap-4">
      <svg width="100" height="100" viewBox="0 0 100 100">
        {paths.map((path, index) => (
          <path
            key={index}
            d={path.pathData}
            fill={path.color}
            stroke="white"
            strokeWidth="1"
          />
        ))}
      </svg>
      <div className="space-y-2">
        {paths.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: item.color }}></div>
            <span className="text-sm text-gray-600">{item.label}</span>
            <span className="text-sm font-medium">({item.percentage.toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case 'completed': return 'bg-green-500';
    case 'in_progress': return 'bg-blue-500';
    case 'todo': return 'bg-gray-400';
    default: return 'bg-gray-400';
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
    case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'low': return 'bg-green-100 text-green-800 border-green-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

export default function ProjectDashboard() {
  const [match, params] = useRoute("/projects/:id/dashboard");
  const projectId = params?.id;

  const { data: project, isLoading: projectLoading } = useQuery<any>({
    queryKey: ["/api/projects", projectId],
    enabled: !!projectId,
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/projects", projectId, "tasks"],
    enabled: !!projectId,
  });

  const isLoading = projectLoading || tasksLoading;

  if (isLoading) {
    return (
      <div className="p-4 lg:p-8 pb-20 lg:pb-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-500">Loading project dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-4 lg:p-8 pb-20 lg:pb-8">
        <div className="text-center py-8">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Project not found</h3>
          <p className="text-gray-500">The requested project could not be found.</p>
          <Link href="/reports">
            <Button className="mt-4">Back to Reports</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Calculate metrics
  const completedTasks = tasks.filter((t: Task) => t.status === 'completed').length;
  const totalTasks = tasks.length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  
  // Task priorities distribution
  const priorityData = {
    urgent: tasks.filter((t: Task) => t.priority === 'urgent').length,
    high: tasks.filter((t: Task) => t.priority === 'high').length,
    medium: tasks.filter((t: Task) => t.priority === 'medium').length,
    low: tasks.filter((t: Task) => t.priority === 'low').length,
  };

  // Task status distribution for pie chart
  const statusData = [
    { label: 'Completed', value: tasks.filter((t: Task) => t.status === 'completed').length, color: '#10b981' },
    { label: 'In Progress', value: tasks.filter((t: Task) => t.status === 'in_progress').length, color: '#3b82f6' },
    { label: 'Todo', value: tasks.filter((t: Task) => t.status === 'todo').length, color: '#6b7280' },
  ].filter(item => item.value > 0);

  // Calculate milestone progress based on overdue vs completed tasks
  const overdueTasks = tasks.filter((t: Task) => 
    t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed'
  ).length;
  const milestoneProgress = totalTasks > 0 
    ? Math.max(0, Math.round(((completedTasks - overdueTasks) / totalTasks) * 100))
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        {/* Left Sidebar - Project Details */}
        <div className="w-80 bg-white border-r border-gray-200 p-6 space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <Link href="/reports">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-xl font-semibold">Project Detail</h1>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-500 mb-1 block">Project Name</label>
              <p className="font-medium text-gray-900">{project.name}</p>
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-1 block">Project Status</label>
              <Badge className="bg-green-100 text-green-800">
                {completionRate >= 100 ? 'Completed' : completionRate >= 50 ? 'In Progress' : 'Planning'}
              </Badge>
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-1 block">Start Date</label>
              <p className="text-gray-900">
                {format(new Date(project.createdAt), 'dd MMM yyyy')}
              </p>
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-1 block">Due Date</label>
              <p className="text-gray-900">
                {project.dueDate ? format(new Date(project.dueDate), 'dd MMM yyyy') : 'Not set'}
              </p>
            </div>

            <div>
              <label className="text-sm text-gray-500 mb-1 block">Team Members</label>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-400" />
                <span className="text-gray-900">5</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1">
                <Edit className="h-3 w-3 mr-1" />
                Edit
              </Button>
              <Button variant="outline" size="sm" className="flex-1">
                <Share className="h-3 w-3 mr-1" />
                Share
              </Button>
            </div>
          </div>
        </div>

        {/* Main Dashboard Content */}
        <div className="flex-1 p-8">
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Top Row - Progress Charts */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Main Progress Chart */}
                <Card>
                  <CardContent className="pt-6 text-center">
                    <CircularProgressChart value={completionRate} label="Overall Progress" />
                  </CardContent>
                </Card>

                {/* Milestone Progress */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium text-gray-600">Milestone Progress</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center">
                    <SmallCircularProgress value={milestoneProgress} color="text-blue-500" />
                    <p className="text-sm text-gray-500 mt-2">Current Milestone</p>
                  </CardContent>
                </Card>
              </div>

              {/* Middle Row - Task Analytics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Task Priority */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Task Priority</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {Object.entries(priorityData).map(([priority, count]) => (
                      <div key={priority} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="capitalize">{priority}</span>
                          <span>{count}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${
                              priority === 'urgent' ? 'bg-red-500' :
                              priority === 'high' ? 'bg-orange-500' :
                              priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${totalTasks > 0 ? (count / totalTasks) * 100 : 0}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Task Status */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Task Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {statusData.length > 0 ? (
                      <PieChart data={statusData} />
                    ) : (
                      <div className="text-center text-gray-500 py-8">
                        <p>No tasks yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Team Estimation */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Team Estimation</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {['Project Owner', 'Team Member 1', 'Team Member 2'].map((member, index) => {
                        const workload = index === 0 ? completionRate : Math.max(0, completionRate - (index * 20));
                        return (
                          <div key={member} className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">{member}</span>
                            <div className="w-16 bg-gray-200 rounded-full h-2">
                              <div 
                                className="h-2 bg-purple-500 rounded-full"
                                style={{ width: `${workload}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Bottom Section - Task Details Table */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Tasks</CardTitle>
                  <div className="text-sm text-gray-500">
                    {completedTasks} of {totalTasks} completed
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="border-b bg-gray-50">
                        <tr>
                          <th className="text-left p-4 font-medium text-gray-900 text-sm">Task</th>
                          <th className="text-left p-4 font-medium text-gray-900 text-sm">Start Date</th>
                          <th className="text-left p-4 font-medium text-gray-900 text-sm">Due Date</th>
                          <th className="text-left p-4 font-medium text-gray-900 text-sm">Status</th>
                          <th className="text-left p-4 font-medium text-gray-900 text-sm">Priority</th>
                          <th className="text-left p-4 font-medium text-gray-900 text-sm">Assignee</th>
                          <th className="text-left p-4 font-medium text-gray-900 text-sm">Progress</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tasks.map((task: Task) => (
                          <tr key={task.id} className="border-b hover:bg-gray-50">
                            <td className="p-4">
                              <div className="font-medium text-gray-900">{task.title}</div>
                            </td>
                            <td className="p-4 text-sm text-gray-600">
                              {task.createdAt ? format(new Date(task.createdAt), 'MMM dd') : 'N/A'}
                            </td>
                            <td className="p-4 text-sm text-gray-600">
                              {task.dueDate ? format(new Date(task.dueDate), 'MMM dd') : 'N/A'}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${getStatusColor(task.status)}`}></div>
                                <span className="text-sm capitalize">{task.status.replace('_', ' ')}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <Badge variant="outline" className={`text-xs ${getPriorityColor(task.priority)}`}>
                                {task.priority}
                              </Badge>
                            </td>
                            <td className="p-4 text-sm text-gray-600">
                              {project.ownerId ? 'Project Owner' : 'Unassigned'}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-200 rounded-full h-2">
                                  <div 
                                    className="h-2 bg-green-500 rounded-full"
                                    style={{ width: `${task.status === 'completed' ? 100 : task.status === 'in_progress' ? 60 : 0}%` }}
                                  ></div>
                                </div>
                                <span className="text-xs text-gray-500 w-8">
                                  {task.status === 'completed' ? 100 : task.status === 'in_progress' ? 60 : 0}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {tasks.length === 0 && (
                    <div className="text-center py-12">
                      <CheckCircle2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks yet</h3>
                      <p className="text-gray-500">Create your first task to get started.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}