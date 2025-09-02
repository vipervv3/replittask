import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Users, Calendar, User, Edit, Trash2, FileText } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertProjectSchema } from "@shared/schema";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type ProjectFormData = {
  name: string;
  description?: string;
  status: string;
  progress: number;
  dueDate?: string;
};

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  progress: number;
  dueDate?: string;
  createdAt: string;
  memberCount?: number;
  myTasks?: number;
  totalTasks?: number;
  isOwner?: boolean;
}

export default function Projects() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isMeetingPrepModalOpen, setIsMeetingPrepModalOpen] = useState(false);
  const [meetingPreparation, setMeetingPreparation] = useState<string | null>(null);
  const [isGeneratingPrep, setIsGeneratingPrep] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const createProjectMutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      const response = await apiRequest("POST", "/api/projects", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setIsCreateModalOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Project created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create project",
        variant: "destructive",
      });
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      const response = await apiRequest("PUT", `/api/projects/${selectedProject?.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setIsEditModalOpen(false);
      setSelectedProject(null);
      editForm.reset();
      toast({
        title: "Success",
        description: "Project updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update project",
        variant: "destructive",
      });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const response = await apiRequest("DELETE", `/api/projects/${projectId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setIsDeleteModalOpen(false);
      setSelectedProject(null);
      toast({
        title: "Success",
        description: "Project deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete project",
        variant: "destructive",
      });
    },
  });

  const projectFormSchema = z.object({
    name: z.string().min(1, "Project name is required"),
    description: z.string().optional(),
    status: z.string().default("active"),
    progress: z.number().min(0).max(100).default(0),
    dueDate: z.string().optional(),
  });

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: "",
      description: "",
      status: "active",
      progress: 0,
      dueDate: "",
    },
  });

  const editForm = useForm<ProjectFormData>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: "",
      description: "",
      status: "active",
      progress: 0,
      dueDate: "",
    },
  });

  const onSubmit = (data: ProjectFormData) => {
    createProjectMutation.mutate(data);
  };

  const onEditSubmit = (data: ProjectFormData) => {
    updateProjectMutation.mutate(data);
  };

  const handleEdit = (project: Project) => {
    setSelectedProject(project);
    editForm.reset({
      name: project.name,
      description: project.description || "",
      status: project.status,
      progress: project.progress,
      dueDate: project.dueDate ? project.dueDate.split('T')[0] : "",
    });
    setIsEditModalOpen(true);
  };

  const handleDelete = (project: Project) => {
    setSelectedProject(project);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (selectedProject) {
      deleteProjectMutation.mutate(selectedProject.id);
    }
  };

  // Generate AI meeting preparation for a project
  const generateMeetingPrep = async (project: Project) => {
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

  if (isLoading) {
    return (
      <div className="p-4 lg:p-8 pb-20 lg:pb-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-500">Loading projects...</p>
          </div>
        </div>
      </div>
    );
  }

  const ownedProjects = projects?.filter(p => p.isOwner) || [];
  const collaboratedProjects = projects?.filter(p => !p.isOwner) || [];

  const ProjectCard = ({ project, isOwned }: { project: Project; isOwned: boolean }): JSX.Element => (
    <Card 
      key={project.id} 
      className={`hover:border-${isOwned ? 'primary' : 'orange-200'} transition-colors cursor-pointer border-l-4 ${isOwned ? 'border-l-primary/20' : 'border-l-orange-200'}`}
      onClick={() => (window as any).location.href = `/projects/${project.id}`}
    >
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4">
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
              <CardTitle className="text-lg font-semibold text-gray-900">
                {project.name}
              </CardTitle>
              <Badge variant={isOwned ? "default" : "outline"} className="text-xs self-start sm:self-center">
                {isOwned ? "Owner" : "Member"}
              </Badge>
            </div>
            {project.description && (
              <p className="text-sm text-gray-600">{project.description}</p>
            )}
          </div>
          <div className="flex gap-1 mt-2 sm:mt-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                generateMeetingPrep(project);
              }}
              className="p-2 h-auto min-h-[32px] min-w-[32px] text-blue-600 hover:text-blue-700 touch-manipulation"
              title="Meeting Prep"
            >
              <FileText className="w-4 h-4" />
            </Button>
            {isOwned && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleEdit(project);
                  }}
                  className="p-2 h-auto min-h-[32px] min-w-[32px] touch-manipulation"
                  title="Edit Project"
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDelete(project);
                  }}
                  className="p-2 h-auto min-h-[32px] min-w-[32px] text-red-600 hover:text-red-700 touch-manipulation"
                  title="Delete Project"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </div>
        
        {/* Team member count */}
        <div className="flex items-center mb-4">
          <div className="flex -space-x-2">
            <div className={`w-8 h-8 ${isOwned ? 'bg-primary' : 'bg-orange-500'} rounded-full flex items-center justify-center text-white text-xs font-medium`}>
              <User className="w-4 h-4" />
            </div>
            {(project.memberCount || 0) > 1 && (
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                +{(project.memberCount || 1) - 1}
              </div>
            )}
          </div>
          <span className="ml-3 text-sm text-gray-600">
            {project.memberCount || 1} member{(project.memberCount || 1) !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Progress */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Progress</span>
            <span className="text-sm text-gray-600">{project.progress || 0}%</span>
          </div>
          <Progress value={project.progress || 0} className="h-2" />
        </div>

        {/* Tasks */}
        {(project.totalTasks || 0) > 0 && (
          <div className="flex items-center justify-between text-sm text-gray-600 mb-4">
            <span>Tasks: {project.totalTasks || 0}</span>
            <span>My Tasks: {project.myTasks || 0}</span>
          </div>
        )}

        {/* Status and Due Date */}
        <div className="flex items-center justify-between">
          <Badge variant={project.status === 'completed' ? 'default' : project.status === 'active' ? 'secondary' : 'outline'}>
            {project.status}
          </Badge>
          {project.dueDate && (
            <div className="flex items-center text-xs text-gray-500">
              <Calendar className="w-3 h-3 mr-1" />
              {new Date(project.dueDate).toLocaleDateString()}
            </div>
          )}
        </div>
      </CardHeader>
    </Card>
  );

  return (
    <div className="p-4 lg:p-8 pb-20 lg:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-4 sm:mb-0">
          Projects
        </h1>
        
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md" aria-describedby="create-project-description">
            <DialogHeader>
              <DialogTitle>Create New Project</DialogTitle>
              <div id="create-project-description" className="sr-only">
                Create a new project by providing a name, description, and due date
              </div>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter project name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Enter project description" 
                          {...field} 
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date</FormLabel>
                      <FormControl>
                        <Input 
                          type="date"
                          {...field} 
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex flex-col sm:flex-row gap-3 sm:space-x-3 sm:gap-0 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createProjectMutation.isPending}
                    className="flex-1"
                  >
                    {createProjectMutation.isPending ? "Creating..." : "Create Project"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Project Cards Grid */}
      {projects && projects.length > 0 ? (
        <div className="space-y-8">
          {/* Owned Projects Section */}
          {ownedProjects.length > 0 && (
            <div>
              <div className="flex items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">My Projects</h2>
                <Badge variant="secondary" className="ml-3">
                  {ownedProjects.length} owned
                </Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {ownedProjects.map((project) => (
                  <ProjectCard key={project.id} project={project} isOwned={true} />
                ))}
              </div>
            </div>
          )}

          {/* Collaborated Projects Section */}
          {collaboratedProjects.length > 0 && (
            <div>
              <div className="flex items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Collaborated Projects</h2>
                <Badge variant="outline" className="ml-3">
                  {collaboratedProjects.length} collaborated
                </Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {collaboratedProjects.map((project) => (
                  <ProjectCard key={project.id} project={project} isOwned={false} />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No projects found.</p>
          <Button 
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-primary hover:bg-primary/90"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Project
          </Button>
        </div>
      )}

      {/* Edit Project Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter project name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter project description" 
                        {...field} 
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due Date</FormLabel>
                    <FormControl>
                      <Input 
                        type="date"
                        {...field} 
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-col sm:flex-row gap-3 sm:space-x-3 sm:gap-0 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateProjectMutation.isPending}
                  className="flex-1"
                >
                  {updateProjectMutation.isPending ? "Updating..." : "Update Project"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <AlertDialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedProject?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteProjectMutation.isPending}
            >
              {deleteProjectMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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