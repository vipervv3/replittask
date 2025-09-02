import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Plus, 
  Users, 
  Mail, 
  MoreHorizontal, 
  UserPlus,
  Crown,
  Shield,
  User,
  Search,
  Filter,
  Trash2,
  Settings,
  ExternalLink
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProjectMemberSchema } from "@shared/schema";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type MemberFormData = z.infer<typeof insertProjectMemberSchema>;

interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    role: string;
  };
}

interface Project {
  id: string;
  name: string;
}

export default function Team() {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Fetch real project members from all user's projects
  const { data: projectMembers, isLoading: membersLoading } = useQuery<ProjectMember[]>({
    queryKey: ["/api/project-members"],
  });

  const addMemberMutation = useMutation({
    mutationFn: async (data: { email: string; projectId: string; role: string }) => {
      const response = await apiRequest("POST", `/api/projects/${data.projectId}/invite`, {
        email: data.email,
        role: data.role,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-members"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setIsInviteModalOpen(false);
      form.reset();
      toast({
        title: "Invitation Sent",
        description: "Invitation email sent successfully. They'll receive an email to accept and join the project.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to invite team member",
        variant: "destructive",
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async ({ projectId, userId }: { projectId: string; userId: string }) => {
      const response = await apiRequest("DELETE", `/api/projects/${projectId}/members/${userId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-members"] });
      toast({
        title: "Success",
        description: "Team member removed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to remove team member",
        variant: "destructive",
      });
    },
  });

  const handleContactMember = (email: string, name: string) => {
    const subject = encodeURIComponent(`Project Collaboration`);
    const body = encodeURIComponent(`Hi ${name},\n\nI wanted to reach out regarding our project collaboration.\n\nBest regards`);
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
  };

  const handleRemoveMember = (member: ProjectMember, projectName: string) => {
    if (confirm(`Are you sure you want to remove ${member.user?.name || member.user?.email} from ${projectName}?`)) {
      removeMemberMutation.mutate({ 
        projectId: member.projectId, 
        userId: member.userId 
      });
    }
  };

  const form = useForm<{ email: string; projectId: string; role: string }>({
    resolver: zodResolver(z.object({
      email: z.string().email("Invalid email address"),
      projectId: z.string().min(1, "Please select a project"),
      role: z.string().min(1, "Please select a role"),
    })),
    defaultValues: {
      email: "",
      projectId: "",
      role: "collaborator",
    },
  });

  const onSubmit = (data: { email: string; projectId: string; role: string }) => {
    addMemberMutation.mutate(data);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner":
        return <Crown className="w-4 h-4 text-yellow-600" />;
      case "admin":
        return <Shield className="w-4 h-4 text-blue-600" />;
      case "collaborator":
        return <Users className="w-4 h-4 text-green-600" />;
      default:
        return <User className="w-4 h-4 text-gray-600" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "owner":
        return "bg-yellow-100 text-yellow-800";
      case "admin":
        return "bg-blue-100 text-blue-800";
      case "collaborator":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const filteredMembers = (projectMembers || []).filter(member => {
    const matchesSearch = member.user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.user?.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || member.role === roleFilter;
    const matchesProject = selectedProject === "all" || !selectedProject || member.projectId === selectedProject;
    
    return matchesSearch && matchesRole && matchesProject;
  });

  const teamStats = {
    totalMembers: projectMembers?.length || 0,
    owners: projectMembers?.filter(m => m.role === "owner").length || 0,
    admins: projectMembers?.filter(m => m.role === "admin").length || 0,
    collaborators: projectMembers?.filter(m => m.role === "collaborator").length || 0,
    members: projectMembers?.filter(m => m.role === "member").length || 0,
  };

  return (
    <div className="p-4 lg:p-8 pb-20 lg:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-4 sm:mb-0">
          Team
        </h1>
        
        <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <UserPlus className="w-4 h-4 mr-2" />
              Invite Member
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter email address" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="projectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a project" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {projects?.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="collaborator">Collaborator</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="owner">Owner</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex space-x-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsInviteModalOpen(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={addMemberMutation.isPending}
                    className="flex-1"
                  >
                    {addMemberMutation.isPending ? "Sending..." : "Send Invitation"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Team Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{teamStats.totalMembers}</div>
            <p className="text-sm text-gray-600">Total Members</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Crown className="w-5 h-5 text-yellow-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{teamStats.owners}</div>
            <p className="text-sm text-gray-600">Owners</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{teamStats.admins}</div>
            <p className="text-sm text-gray-600">Admins</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{teamStats.collaborators}</div>
            <p className="text-sm text-gray-600">Collaborators</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search team members..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2">
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects?.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="owner">Owner</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="collaborator">Collaborator</SelectItem>
              <SelectItem value="member">Member</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Team Members */}
      {membersLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="flex items-start space-x-3 mb-4">
                  <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredMembers.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredMembers.map((member) => (
            <Card key={member.id} className="hover:border-gray-300 transition-colors">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center">
                      {member.user.avatar ? (
                        <img 
                          src={member.user.avatar} 
                          alt={member.user.name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <User className="w-6 h-6 text-gray-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{member.user?.name || 'Unknown User'}</h3>
                      <p className="text-sm text-gray-600 truncate">{projects?.find(p => p.id === member.projectId)?.name || 'Unknown Project'}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="p-1 h-auto">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => handleContactMember(member.user?.email || '', member.user?.name || 'Team Member')}>
                        <Mail className="w-4 h-4 mr-2" />
                        Send Email
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => handleRemoveMember(member, projects?.find(p => p.id === member.projectId)?.name || 'Unknown Project')}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove from Project
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center text-sm text-gray-600">
                    <Mail className="w-4 h-4 mr-2" />
                    <span className="truncate">{member.user?.email || 'No email'}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Badge className={getRoleColor(member.role)} variant="secondary">
                      <span className="flex items-center">
                        {getRoleIcon(member.role)}
                        <span className="ml-1 capitalize">{member.role}</span>
                      </span>
                    </Badge>
                    <span className="text-xs text-gray-500">
                      Joined {new Date(member.joinedAt).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    Project: {projects?.find(p => p.id === member.projectId)?.name || 'Unknown Project'}
                  </div>
                </div>

                <div className="flex space-x-2 mt-4">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => handleContactMember(member.user?.email || '', member.user?.name || 'Team Member')}
                  >
                    <Mail className="w-3 h-3 mr-1" />
                    Contact
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline">
                        <MoreHorizontal className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem>
                        <Settings className="w-4 h-4 mr-2" />
                        Change Role
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <ExternalLink className="w-4 h-4 mr-2" />
                        View Profile
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => handleRemoveMember(member, projects?.find(p => p.id === member.projectId)?.name || 'Unknown Project')}
                        className="text-red-600 focus:text-red-600"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove from Project
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || roleFilter !== "all" || selectedProject ? "No members found" : "No team members"}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchTerm || roleFilter !== "all" || selectedProject 
                ? "Try adjusting your search or filters."
                : "Invite your first team member to get started."
              }
            </p>
            {(!searchTerm && roleFilter === "all" && !selectedProject) && (
              <Button onClick={() => setIsInviteModalOpen(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                Invite Member
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
