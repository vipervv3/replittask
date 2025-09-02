import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import CreateProjectModal from "@/components/modals/CreateProjectModal";
// Removed dropdown menu import - using individual buttons now
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { 
  Users, 
  Calendar, 
  Plus,
  Lock,
  Crown,
  UserCheck,
  // MoreVertical, // Removed - using individual buttons now
  Edit,
  Trash2,
  Eye,
  CalendarIcon,
  Loader2,
  FileText
} from "lucide-react";

export default function UserProjects() {
  const { user, isAuthenticated } = useAuth();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [isMeetingPrepModalOpen, setIsMeetingPrepModalOpen] = useState(false);
  const [meetingPreparation, setMeetingPreparation] = useState<string | null>(null);
  const [isGeneratingPrep, setIsGeneratingPrep] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    status: "active",
    dueDate: undefined as Date | undefined
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: projects, isLoading } = useQuery({
    queryKey: ["/api/projects"],
    enabled: isAuthenticated
  });

  // Separate owned and collaborated projects
  const ownedProjects = (projects as any[])?.filter((p: any) => p.isOwner) || [];
  const collaboratedProjects = (projects as any[])?.filter((p: any) => !p.isOwner) || [];

  const updateProjectMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await apiRequest("PUT", `/api/projects/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Project Updated",
        description: "Your project has been updated successfully.",
      });
      setIsEditModalOpen(false);
      setSelectedProject(null);
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update the project. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/projects/${id}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Project Deleted",
        description: "The project has been deleted successfully.",
      });
      setIsDeleteDialogOpen(false);
      setSelectedProject(null);
    },
    onError: () => {
      toast({
        title: "Delete Failed",
        description: "Failed to delete the project. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (project: any) => {
    console.log('=== EDIT FUNCTION CALLED ===');
    console.log('Project ID:', project.id);
    console.log('Current modal state before:', isEditModalOpen);
    
    // Prevent any possible interference
    event?.preventDefault?.();
    event?.stopPropagation?.();
    
    setSelectedProject(project);
    setEditForm({
      name: project.name,
      description: project.description || "",
      status: project.status,
      dueDate: project.dueDate ? new Date(project.dueDate) : undefined
    });
    
    // Force the modal to stay open
    setIsEditModalOpen(true);
    
    // Double-check the modal opens
    setTimeout(() => {
      console.log('Modal state after timeout:', isEditModalOpen);
      if (!isEditModalOpen) {
        console.log('MODAL CLOSED UNEXPECTEDLY - REOPENING');
        setIsEditModalOpen(true);
      }
    }, 50);
    
    console.log('=== END EDIT FUNCTION ===');
  };

  const handleDelete = (project: any) => {
    setSelectedProject(project);
    setIsDeleteDialogOpen(true);
  };

  const handleView = (projectId: string) => {
    // Use timeout to ensure any pending modal state updates complete first
    setTimeout(() => {
      window.location.href = `/projects/${projectId}`;
    }, 50);
  };

  const submitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    updateProjectMutation.mutate({
      id: selectedProject.id,
      data: {
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        status: editForm.status,
        dueDate: editForm.dueDate ? editForm.dueDate.toISOString() : null,
      },
    });
  };

  const confirmDelete = () => {
    if (!selectedProject) return;
    deleteProjectMutation.mutate(selectedProject.id);
  };

  const inviteMemberMutation = useMutation({
    mutationFn: async ({ projectId, email, role }: { projectId: string; email: string; role: string }) => {
      const response = await apiRequest("POST", `/api/projects/${projectId}/invite`, { email, role });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Invitation Sent",
        description: "The user has been invited to your project.",
      });
      setIsInviteModalOpen(false);
      setInviteEmail("");
      setInviteRole("member");
      setSelectedProject(null);
    },
    onError: (error: any) => {
      toast({
        title: "Invitation Failed",
        description: error.message || "Failed to invite user. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleInviteMembers = (project: any) => {
    setSelectedProject(project);
    setInviteEmail("");
    setInviteRole("member");
    setIsInviteModalOpen(true);
  };

  const submitInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !inviteEmail.trim()) return;

    inviteMemberMutation.mutate({
      projectId: selectedProject.id,
      email: inviteEmail.trim(),
      role: inviteRole,
    });
  };

  // Generate AI meeting preparation for a project
  const generateMeetingPrep = async (project: any) => {
    setSelectedProject(project);
    setIsMeetingPrepModalOpen(true);
    setIsGeneratingPrep(true);
    setMeetingPreparation(null);
    
    try {
      const response = await apiRequest("POST", `/api/projects/${project.id}/meeting-preparation`);
      const result = await response.json();
      setMeetingPreparation(result.preparation);
      toast({
        title: "Meeting prep generated!",
        description: "AI has analyzed the project and created talking points",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to generate meeting preparation",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPrep(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-8 text-center">
            <Lock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Authentication Required
            </h2>
            <p className="text-gray-600 mb-4">
              Please log in to see your projects and collaborations
            </p>
            <Button onClick={() => window.location.href = '/login'}>
              Log In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const projectsArray = Array.isArray(projects) ? projects : [];

  return (
    <div className="p-4 md:p-6 space-y-6 md:space-y-8 pb-20 md:pb-8">
      {/* User Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome, {user?.name}!
          </h1>
          <p className="text-gray-600">
            Your personal projects and collaborations
          </p>
        </div>
        <Button 
          className="bg-blue-600 hover:bg-blue-700"
          onClick={() => setIsCreateModalOpen(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          New Project
        </Button>
      </div>

      {/* Owned Projects */}
      <div>
        <div className="flex items-center gap-2 mb-6">
          <Crown className="h-5 w-5 text-yellow-600" />
          <h2 className="text-xl font-semibold text-gray-900">My Projects</h2>
          <Badge variant="secondary" className="ml-2">
            {ownedProjects.length} owned
          </Badge>
        </div>
        
        {ownedProjects.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Crown className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No projects yet
              </h3>
              <p className="text-gray-600 mb-4">
                Create your first project to get started
              </p>
              <Button onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Project
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {ownedProjects.map((project: any) => (
              <Card 
                key={project.id} 
                className="hover:border-primary/40 transition-colors border-l-4 border-l-primary/20"
                onClick={(e) => {
                  // Only navigate if clicking on the card content area, not buttons
                  if (e.target === e.currentTarget || 
                      (e.target as HTMLElement).closest('.card-content-area')) {
                    // Don't navigate here anymore, let buttons handle their own actions
                  }
                }}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {project.name}
                        <Badge variant="default" className="text-xs">
                          Owner
                        </Badge>
                      </CardTitle>
                      <CardDescription>{project.description}</CardDescription>
                    </div>
                    <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                      {project.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="card-content-area">
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {project.memberCount || 1} member{(project.memberCount || 1) !== 1 ? 's' : ''}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {new Date(project.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  
                  {project.dueDate && (
                    <div className="flex items-center gap-1 text-sm text-gray-600 mb-3">
                      <CalendarIcon className="h-4 w-4" />
                      Due: {new Date(project.dueDate).toLocaleDateString()}
                    </div>
                  )}
                  
                  <div className="mb-4">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${(project as any).actualProgress || 0}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {(project as any).actualProgress || 0}% complete
                    </p>
                  </div>
                  
                  {/* Responsive button layout */}
                  <div className="space-y-2">
                    {/* Primary action button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleView(project.id);
                      }}
                      className="w-full"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Project
                    </Button>
                    
                    {/* Secondary actions in grid */}
                    <div className="grid grid-cols-4 gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          generateMeetingPrep(project);
                        }}
                        className="p-2 h-8 w-full text-blue-600 hover:text-blue-700 hover:border-blue-300"
                        title="Meeting Prep"
                      >
                        <FileText className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleEdit(project);
                        }}
                        className="p-2 h-8 w-full"
                        title="Edit Project"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleInviteMembers(project);
                        }}
                        className="p-2 h-8 w-full"
                        title="Invite Members"
                      >
                        <UserCheck className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDelete(project);
                        }}
                        className="p-2 h-8 w-full text-red-600 hover:text-red-700"
                        title="Delete Project"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Collaborated Projects */}
      <div>
        <div className="flex items-center gap-2 mb-6">
          <UserCheck className="h-5 w-5 text-orange-600" />
          <h2 className="text-xl font-semibold text-gray-900">Collaborated Projects</h2>
          <Badge variant="outline" className="ml-2">
            {collaboratedProjects.length} collaborated
          </Badge>
        </div>
        
        {collaboratedProjects.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <UserCheck className="h-12 w-12 text-green-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No collaborations yet
              </h3>
              <p className="text-gray-600 mb-4">
                You haven't been invited to any projects yet
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {collaboratedProjects.map((project: any) => (
              <Card key={project.id} className="hover:border-orange-200 transition-colors border-l-4 border-l-orange-200">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {project.name}
                        <Badge variant="outline" className="text-xs">
                          Member
                        </Badge>
                      </CardTitle>
                      <CardDescription>{project.description}</CardDescription>
                    </div>
                    <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                      {project.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {project.memberCount || 1} member{(project.memberCount || 1) !== 1 ? 's' : ''}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {new Date(project.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  
                  {project.dueDate && (
                    <div className="flex items-center gap-1 text-sm text-gray-600 mb-3">
                      <CalendarIcon className="h-4 w-4" />
                      Due: {new Date(project.dueDate).toLocaleDateString()}
                    </div>
                  )}
                  
                  <div className="mb-4">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-orange-600 h-2 rounded-full" 
                        style={{ width: `${(project as any).actualProgress || 0}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {(project as any).actualProgress || 0}% complete
                    </p>
                  </div>
                  
                  {/* Responsive button layout for collaborated projects */}
                  <div className="space-y-2">
                    {/* Primary action button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleView(project.id);
                      }}
                      className="w-full"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Project
                    </Button>
                    
                    {/* Secondary action - meeting prep */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        generateMeetingPrep(project);
                      }}
                      className="w-full text-blue-600 hover:text-blue-700 hover:border-blue-300"
                      title="Meeting Prep"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Generate Meeting Prep
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Privacy Notice */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">
                Privacy & Access Control
              </h3>
              <p className="text-blue-800 text-sm">
                You can only see projects you own or projects where you've been added as a collaborator. 
                Each user's projects are completely private and isolated from other users.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Project Modal */}
      <CreateProjectModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
      />

      {/* Edit Project Modal */}
      <Dialog 
        open={isEditModalOpen} 
        onOpenChange={(open) => {
          console.log('Dialog onOpenChange called:', open);
          setIsEditModalOpen(open);
        }}
      >
        <DialogContent 
          className="sm:max-w-md"
          onPointerDownOutside={(e) => {
            console.log('Pointer down outside dialog');
            e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            console.log('Escape key pressed');
            e.preventDefault();
          }}
          aria-describedby="edit-project-description"
        >
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <div id="edit-project-description" className="sr-only">
              Edit the details of your project including name, description, status and due date.
            </div>
          </DialogHeader>
          
          <form onSubmit={submitEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Project Name *</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Enter project name..."
                disabled={updateProjectMutation.isPending}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Describe your project goals and objectives..."
                rows={3}
                disabled={updateProjectMutation.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select 
                value={editForm.status} 
                onValueChange={(value) => setEditForm({ ...editForm, status: value })}
                disabled={updateProjectMutation.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select project status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="on-hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Due Date (Optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !editForm.dueDate && "text-muted-foreground"
                    )}
                    disabled={updateProjectMutation.isPending}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editForm.dueDate ? format(editForm.dueDate, "PPP") : "Select due date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={editForm.dueDate}
                    onSelect={(date) => setEditForm({ ...editForm, dueDate: date })}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsEditModalOpen(false)}
                disabled={updateProjectMutation.isPending}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateProjectMutation.isPending || !editForm.name.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {updateProjectMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update Project"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md" aria-describedby="delete-project-description">
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <div id="delete-project-description" className="sr-only">
              Confirm deletion of the selected project. This action cannot be undone.
            </div>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Are you sure you want to delete "<strong>{selectedProject?.name}</strong>"? 
              This action cannot be undone and will permanently remove all project data, tasks, and meetings.
            </p>
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsDeleteDialogOpen(false)}
                disabled={deleteProjectMutation.isPending}
              >
                Cancel
              </Button>
              <Button 
                onClick={confirmDelete}
                disabled={deleteProjectMutation.isPending}
                variant="destructive"
              >
                {deleteProjectMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete Project"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invite Member Modal */}
      <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
        <DialogContent className="sm:max-w-md" aria-describedby="invite-member-description">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <div id="invite-member-description" className="sr-only">
              Invite a new team member to collaborate on this project by entering their email address.
            </div>
          </DialogHeader>
          
          <form onSubmit={submitInvite} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email Address *</Label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                disabled={inviteMemberMutation.isPending}
                required
                data-testid="input-invite-email-projects"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger data-testid="select-invite-role-projects">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsInviteModalOpen(false)}
                disabled={inviteMemberMutation.isPending}
                data-testid="button-cancel-invite-projects"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={inviteMemberMutation.isPending || !inviteEmail.trim()}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="button-send-invite-projects"
              >
                {inviteMemberMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Invitation"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Meeting Preparation Modal */}
      <Dialog open={isMeetingPrepModalOpen} onOpenChange={setIsMeetingPrepModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Meeting Preparation: {selectedProject?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {isGeneratingPrep ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Generating AI meeting preparation...</p>
                </div>
              </div>
            ) : meetingPreparation ? (
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap text-gray-800 leading-relaxed">
                  {meetingPreparation}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No meeting preparation available</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}