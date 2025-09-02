import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { 
  Folder, 
  Clock, 
  CheckCircle, 
  Users, 
  Mic, 
  BarChart3,
  User,
  Plus,
  Video,
  Lightbulb,
  Calendar,
  Mail,
  UserPlus,
  X,
  Check
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import VoiceRecordingModal from "@/components/modals/VoiceRecordingModal";

interface DashboardStats {
  totalProjects: number;
  activeTasks: number;
  completedTasks: number;
  teamMembers: number;
}

interface Project {
  id: string;
  name: string;
  progress: number;
  status: string;
}

interface RecentActivity {
  id: string;
  type: string;
  user: string;
  action: string;
  target: string | null;
  time: Date;
  createdAt: Date;
}

interface TodaysMeeting {
  id: string;
  title: string;
  description?: string;
  scheduledAt: string;
  duration: number;
  project?: { name: string };
  creator: { name: string };
}

interface PendingInvitation {
  id: string;
  project: {
    id: string;
    name: string;
  };
  inviter: {
    name: string;
  };
  role: string;
  expiresAt: string;
}

export default function Dashboard() {
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const { user } = useAuth();

  // Use React Query for better caching and performance
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    enabled: !!user,
    staleTime: 1000 * 60 * 2, // 2 minutes cache
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });

  const { data: recentActivity = [] } = useQuery<RecentActivity[]>({
    queryKey: ["/api/dashboard/activity?limit=5"],
    enabled: !!user,
    staleTime: 1000 * 60, // 1 minute cache
  });

  const { data: todaysMeetings = [] } = useQuery<TodaysMeeting[]>({
    queryKey: ["/api/dashboard/todays-meetings"],
    enabled: !!user,
    staleTime: 1000 * 60 * 10, // 10 minutes cache
  });

  const { data: pendingInvitations = [], refetch: refetchInvitations } = useQuery<PendingInvitation[]>({
    queryKey: ["/api/my-invitations"],
    enabled: !!user,
    staleTime: 1000 * 30, // 30 seconds cache
  });

  const formatActivityTime = (dateInput: string | Date) => {
    const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    return date.toLocaleDateString();
  };

  const formatMeetingTime = (dateString: string, duration: number = 60) => {
    const date = new Date(dateString);
    const endDate = new Date(date.getTime() + duration * 60 * 1000);
    const timeFormat = { hour: 'numeric', minute: '2-digit', hour12: true } as const;
    return `${date.toLocaleTimeString([], timeFormat)} - ${endDate.toLocaleTimeString([], timeFormat)}`;
  };

  const getMeetingColor = (index: number) => {
    const colors = ['blue', 'green', 'purple', 'orange', 'red'];
    return colors[index % colors.length];
  };

  const activeProjects = projects?.slice(0, 3) || [];

  const queryClient = useQueryClient();

  const handleAcceptInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`/api/invitations/${invitationId}/accept`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        const result = await response.json();
        // Refresh all relevant queries
        queryClient.invalidateQueries({ queryKey: ["/api/my-invitations"] });
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
        alert(`Successfully joined ${result.projectName}!`);
      } else {
        const error = await response.json();
        alert(`Failed to accept invitation: ${error.message}`);
      }
    } catch (error) {
      console.error('Error accepting invitation:', error);
      alert('Failed to accept invitation. Please try again.');
    }
  };

  const handleDeclineInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`/api/invitations/${invitationId}/decline`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        // Refresh invitations
        queryClient.invalidateQueries({ queryKey: ["/api/my-invitations"] });
        alert('Invitation declined.');
      } else {
        const error = await response.json();
        alert(`Failed to decline invitation: ${error.message}`);
      }
    } catch (error) {
      console.error('Error declining invitation:', error);
      alert('Failed to decline invitation. Please try again.');
    }
  };

  return (
    <div className="p-4 lg:p-8 pb-20 lg:pb-8">
      {/* Mobile Header */}
      <header className="lg:hidden bg-white border-b border-gray-200 -mx-4 -mt-4 px-4 py-3 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-lg font-bold text-gray-900">AI ProjectHub</h1>
          </div>
        </div>
      </header>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {user?.name || 'there'}! 👋
        </h1>
        <p className="text-gray-600">
          Here's what's happening with your projects today.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Link href="/projects">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Folder className="w-5 h-5 text-primary" />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {statsLoading ? "..." : stats?.totalProjects || 0}
              </div>
              <p className="text-sm text-gray-600">Total Projects</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/tasks">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-orange-600" />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {statsLoading ? "..." : stats?.activeTasks || 0}
              </div>
              <p className="text-sm text-gray-600">Active Tasks</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/tasks">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {statsLoading ? "..." : stats?.completedTasks || 0}
              </div>
              <p className="text-sm text-gray-600">Completed Tasks</p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/team">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {statsLoading ? "..." : stats?.teamMembers || 0}
              </div>
              <p className="text-sm text-gray-600">Team Members</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <Card className="mb-8 border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <Mail className="w-5 h-5 mr-2 text-blue-600" />
                Pending Invitations
              </div>
              <div className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                {pendingInvitations.length}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingInvitations.map((invitation) => (
                <div 
                  key={invitation.id} 
                  className="bg-white border border-blue-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <UserPlus className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">
                        {invitation.project.name}
                      </h4>
                      <p className="text-sm text-gray-600">
                        Invited by <strong>{invitation.inviter.name}</strong> as <strong>{invitation.role}</strong>
                      </p>
                      <p className="text-xs text-gray-500">
                        Expires: {new Date(invitation.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 sm:space-x-2 sm:gap-0">
                    <Button
                      size="sm"
                      onClick={() => handleAcceptInvitation(invitation.id)}
                      className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto"
                    >
                      <Check className="w-4 h-4 mr-1" />
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeclineInvitation(invitation.id)}
                      className="border-red-300 text-red-600 hover:bg-red-50 w-full sm:w-auto"
                    >
                      <X className="w-4 h-4 mr-1" />
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Quick Actions */}
      <Card className="mb-8 bg-gradient-to-r from-secondary to-primary text-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">AI Assistant</h2>
            <div className="w-8 h-8 opacity-80">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1L13.5 2.5L16.5 5.5H7.5L10.5 2.5L9 1L3 7V9H21ZM12.5 7V8.5C12.5 9.6 11.6 10.5 10.5 10.5S8.5 9.6 8.5 8.5V7H12.5Z" />
              </svg>
            </div>
          </div>
          <p className="mb-4 opacity-90">
            Ready to help you manage your projects more efficiently
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="secondary"
              className="bg-white/20 hover:bg-white/30 border-0 text-white"
              onClick={() => setIsVoiceModalOpen(true)}
            >
              <Mic className="w-4 h-4 mr-2" />
              Start Voice Recording
            </Button>
            <Link href="/ai-insights">
              <Button
                variant="secondary"
                className="bg-white/20 hover:bg-white/30 border-0 text-white"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                View AI Insights
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity & Projects Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 mb-8">
        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
              <Link href="/tasks">
                <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
                  View all
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.length > 0 ? (
                  recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start space-x-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        activity.type === 'completed' || activity.type === 'updated' ? 'bg-green-100' :
                        activity.type === 'created' ? 'bg-blue-100' : 'bg-purple-100'
                      }`}>
                        {(activity.type === 'completed' || activity.type === 'updated') && <CheckCircle className="w-4 h-4 text-green-600" />}
                        {activity.type === 'created' && <Plus className="w-4 h-4 text-blue-600" />}
                        {activity.type === 'ai' && <Mic className="w-4 h-4 text-purple-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">
                          <span className="font-medium">{activity.user}</span> {activity.action}
                          {activity.target && (
                            <span className="font-medium text-primary"> "{activity.target}"</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">
                          {activity.time ? formatActivityTime(activity.time) : 'Unknown time'}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Clock className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-lg font-medium mb-2">No recent activity</p>
                    <p className="text-sm">
                      Your recent project and task activity will appear here.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Projects */}
        <div>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold">Active Projects</CardTitle>
              <Link href="/projects">
                <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
                  View all
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activeProjects.map((project) => (
                  <Link key={project.id} href={`/projects/${project.id}`}>
                    <div className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 mb-2">{project.name}</p>
                        <div className="flex items-center">
                          <Progress value={(project as any).actualProgress || 0} className="flex-1 mr-2" />
                          <span className="text-xs text-gray-500">{(project as any).actualProgress || 0}%</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
                
                {activeProjects.length === 0 && (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500">No active projects</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Upcoming Meetings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-semibold">Today's Schedule</CardTitle>
          <Link href="/calendar">
            <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">
              View calendar
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {todaysMeetings.length > 0 ? (
              todaysMeetings.map((meeting, index) => (
                <div key={meeting.id} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                  <div className={`w-3 h-3 rounded-full bg-${getMeetingColor(index)}-500`}></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{meeting.title}</p>
                    <p className="text-xs text-gray-500">
                      {formatMeetingTime(meeting.scheduledAt, meeting.duration)}
                    </p>
                    {meeting.project && (
                      <p className="text-xs text-gray-400">
                        Project: {meeting.project.name}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">
                    {meeting.creator.name}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium mb-2">No meetings today</p>
                <p className="text-sm">
                  Your scheduled meetings for today will appear here.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <VoiceRecordingModal 
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
      />
    </div>
  );
}
