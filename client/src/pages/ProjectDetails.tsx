import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ArrowLeft, Calendar, Users, CheckCircle, Clock, AlertCircle, Plus, MoreVertical, Edit, Trash2, CalendarIcon, Eye, UserPlus, FileText, Lightbulb, MessageSquare } from "lucide-react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTaskSchema } from "@shared/schema";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import ProjectMembers from "@/components/ProjectMembers";
import { Label } from "@/components/ui/label";

interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  progress: number;
  ownerId: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  projectId: string;
  dueDate?: string;
  createdAt: string;
  assigneeId?: string;
}

type TaskFormData = z.infer<typeof insertTaskSchema>;

export default function ProjectDetails() {
  const { id } = useParams<{ id: string }>();
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [isEditTaskModalOpen, setIsEditTaskModalOpen] = useState(false);
  const [isViewTaskModalOpen, setIsViewTaskModalOpen] = useState(false);
  const [isDeleteTaskModalOpen, setIsDeleteTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [selectedTasksForBatch, setSelectedTasksForBatch] = useState<Set<string>>(new Set());
  const [isBatchDeleteModalOpen, setIsBatchDeleteModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [isMeetingPrepModalOpen, setIsMeetingPrepModalOpen] = useState(false);
  const [meetingPreparation, setMeetingPreparation] = useState<string | null>(null);
  const [isGeneratingPrep, setIsGeneratingPrep] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Generate AI meeting preparation for this project
  const generateMeetingPrep = async () => {
    if (!project?.id) return;
    
    setIsGeneratingPrep(true);
    try {
      const response = await apiRequest("POST", `/api/projects/${project.id}/meeting-preparation`);
      const result = await response.json();
      setMeetingPreparation(result.preparation);
      toast({
        title: "Meeting prep generated!",
        description: "AI has analyzed your project and created talking points",
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

  // Auto-generate prep when modal opens
  const handleOpenMeetingPrep = () => {
    setIsMeetingPrepModalOpen(true);
    if (!meetingPreparation) {
      generateMeetingPrep();
    }
  };

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: [`/api/projects/${id}`],
  });

  const { data: tasks } = useQuery<Task[]>({
    queryKey: [`/api/projects/${id}/tasks`],
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: TaskFormData) => {
      const response = await apiRequest("POST", "/api/tasks", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${id}/tasks`] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setIsCreateTaskModalOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Task created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create task",
        variant: "destructive",
      });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<TaskFormData> }) => {
      const response = await apiRequest("PUT", `/api/tasks/${data.id}`, data.updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${id}/tasks`] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setIsEditTaskModalOpen(false);
      setSelectedTask(null);
      editForm.reset();
      toast({
        title: "Success",
        description: "Task updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive",
      });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await apiRequest("DELETE", `/api/tasks/${taskId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${id}/tasks`] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setIsDeleteTaskModalOpen(false);
      setSelectedTask(null);
      toast({
        title: "Success",
        description: "Task deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "destructive",
      });
    },
  });

  const batchDeleteTasksMutation = useMutation({
    mutationFn: async (taskIds: string[]) => {
      const response = await apiRequest("POST", "/api/tasks/batch-delete", { taskIds });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${id}/tasks`] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setSelectedTasksForBatch(new Set());
      setIsBatchDeleteModalOpen(false);
      toast({
        title: "Success",
        description: `${data.deletedCount || selectedTasksForBatch.size} tasks deleted successfully`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete selected tasks",
        variant: "destructive",
      });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/projects/${id}/invite`, {
        email: inviteEmail,
        role: inviteRole,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${id}/members`] });
      toast({
        title: "Success",
        description: "Invitation sent successfully.",
      });
      setIsInviteModalOpen(false);
      setInviteEmail("");
      setInviteRole("member");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation.",
        variant: "destructive",
      });
    },
  });

  const handleInvite = () => {
    if (!inviteEmail.trim()) return;
    inviteMutation.mutate();
  };

  const form = useForm<TaskFormData>({
    resolver: zodResolver(insertTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "todo",
      priority: "medium",
      projectId: id || "",
      dueDate: undefined,
    },
  });

  const editForm = useForm<TaskFormData>({
    resolver: zodResolver(insertTaskSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "todo",
      priority: "medium",
      projectId: id || "",
      dueDate: undefined,
    },
  });

  const onSubmit = (data: TaskFormData) => {
    const processedData = {
      ...data,
      projectId: id!,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
    };
    createTaskMutation.mutate(processedData);
  };

  const onEditSubmit = (data: TaskFormData) => {
    if (!selectedTask) return;
    const processedData = {
      ...data,
      projectId: id!,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
    };
    updateTaskMutation.mutate({ id: selectedTask.id, updates: processedData });
  };

  const handleViewTask = (task: Task) => {
    setSelectedTask(task);
    setIsViewTaskModalOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    editForm.reset({
      title: task.title,
      description: task.description || "",
      status: task.status,
      priority: task.priority,
      projectId: task.projectId,
      dueDate: task.dueDate ? new Date(task.dueDate) : undefined,
    });
    setIsEditTaskModalOpen(true);
  };

  const handleDeleteTask = (task: Task) => {
    setSelectedTask(task);
    setIsDeleteTaskModalOpen(true);
  };

  const confirmDeleteTask = () => {
    if (!selectedTask) return;
    deleteTaskMutation.mutate(selectedTask.id);
  };

  const handleTaskCheckboxChange = (taskId: string, checked: boolean) => {
    setSelectedTasksForBatch(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(taskId);
      } else {
        newSet.delete(taskId);
      }
      return newSet;
    });
  };

  const handleSelectAllTasks = (checked: boolean) => {
    if (checked && tasks) {
      setSelectedTasksForBatch(new Set(tasks.map(task => task.id)));
    } else {
      setSelectedTasksForBatch(new Set());
    }
  };

  const confirmBatchDelete = () => {
    if (selectedTasksForBatch.size === 0) return;
    batchDeleteTasksMutation.mutate(Array.from(selectedTasksForBatch));
  };

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    if (!draggedTask || draggedTask.status === newStatus) return;
    
    updateTaskMutation.mutate({ 
      id: draggedTask.id, 
      updates: { status: newStatus } 
    });
    setDraggedTask(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "completed":
        return "bg-blue-100 text-blue-800";
      case "paused":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-800";
      case "high":
        return "bg-orange-100 text-orange-800";
      case "medium":
        return "bg-blue-100 text-blue-800";
      case "low":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "No deadline";
    return new Date(dateString).toLocaleDateString();
  };

  const taskStats = tasks ? {
    total: tasks.length,
    completed: tasks.filter(task => task.status === 'completed').length,
    inProgress: tasks.filter(task => task.status === 'in_progress').length,
    todo: tasks.filter(task => task.status === 'todo').length,
  } : { total: 0, completed: 0, inProgress: 0, todo: 0 };

  if (isLoading) {
    return (
      <div className="p-4 lg:p-8 pb-20 lg:pb-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-500">Loading project...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-4 lg:p-8 pb-20 lg:pb-8">
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Project not found</h3>
          <p className="text-gray-500 mb-6">The project you're looking for doesn't exist.</p>
          <Link href="/projects">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Projects
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="p-4 lg:p-8 pb-20 lg:pb-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <Link href="/projects">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Projects
              </Button>
            </Link>
          </div>
          
          {/* Project Title and Description */}
          <div className="mb-6">
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
              {project.name}
            </h1>
            {project.description && (
              <p className="text-gray-600 max-w-2xl">{project.description}</p>
            )}
          </div>

          {/* Project Metadata and Actions Row */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <Badge className={getStatusColor(project.status)}>
                {project.status}
              </Badge>
              {project.dueDate && (
                <div className="flex items-center text-sm text-gray-600">
                  <CalendarIcon className="w-4 h-4 mr-1" />
                  Due: {new Date(project.dueDate).toLocaleDateString()}
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              <Dialog open={isCreateTaskModalOpen} onOpenChange={setIsCreateTaskModalOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Task
                  </Button>
                </DialogTrigger>
              </Dialog>
              {project.ownerId === user?.id && (
                <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-blue-600 hover:bg-blue-700">
                      <UserPlus className="w-4 h-4 mr-2" />
                      Invite Member
                    </Button>
                  </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Invite Team Member</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="header-invite-email">Email Address</Label>
                      <Input
                        id="header-invite-email"
                        type="email"
                        placeholder="colleague@company.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        data-testid="input-header-invite-email"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="header-invite-role">Role</Label>
                      <Select value={inviteRole} onValueChange={setInviteRole}>
                        <SelectTrigger data-testid="select-header-invite-role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="outline"
                        onClick={() => setIsInviteModalOpen(false)}
                        data-testid="button-header-cancel-invite"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleInvite}
                        disabled={inviteMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700"
                        data-testid="button-header-send-invite"
                      >
                        {inviteMutation.isPending ? "Sending..." : "Send Invitation"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            </div>
          </div>

          {/* Create Task Modal */}
          <Dialog open={isCreateTaskModalOpen} onOpenChange={setIsCreateTaskModalOpen}>
            <DialogContent className="sm:max-w-md" aria-describedby="create-task-description">
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
                <div id="create-task-description" className="sr-only">
                  Create a new task for this project by providing a title, description, priority, and due date
                </div>
              </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Task Title</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter task title" {...field} />
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
                                placeholder="Enter task description" 
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
                        name="priority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Priority</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="urgent">Urgent</SelectItem>
                              </SelectContent>
                            </Select>
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
                                value={typeof field.value === 'string' ? field.value : field.value?.toISOString().split('T')[0] || ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex space-x-3 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsCreateTaskModalOpen(false)}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={createTaskMutation.isPending}
                          className="flex-1"
                        >
                          {createTaskMutation.isPending ? "Creating..." : "Create Task"}
                        </Button>
                      </div>
                    </form>
                  </Form>
            </DialogContent>
          </Dialog>

          {/* Project Stats */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Progress</p>
                    <p className="text-2xl font-bold text-gray-900">{taskStats.total > 0 ? Math.round((taskStats.completed / taskStats.total) * 100) : 0}%</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
                <Progress value={taskStats.total > 0 ? Math.round((taskStats.completed / taskStats.total) * 100) : 0} className="mt-3" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Tasks</p>
                    <p className="text-2xl font-bold text-gray-900">{taskStats.total}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Due Date</p>
                    <p className="text-sm font-semibold text-gray-900">{formatDate(project.dueDate)}</p>
                  </div>
                  <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Team Members</p>
                    <p className="text-2xl font-bold text-gray-900">{(project as any)?.memberCount || 1}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <Users className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={handleOpenMeetingPrep}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Meeting Prep</p>
                    <p className="text-sm font-semibold text-blue-600">Prepare for meetings</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tasks Overview - Mobile optimized */}
        <div className="space-y-4 md:hidden">
          {/* Mobile: Stack vertically */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-sm font-medium text-gray-600">
                <AlertCircle className="w-4 h-4 mr-2" />
                To Do ({taskStats.todo})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pb-4">
              {tasks?.filter(task => task.status === 'todo').map((task) => (
                <div 
                  key={task.id} 
                  className="p-3 bg-white border border-gray-200 rounded-lg"
                  onClick={() => handleViewTask(task)}
                >
                  <div className="flex items-start justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900 flex-1 pr-2">{task.title}</p>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditTask(task);
                      }}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <Badge className={getPriorityColor(task.priority)} variant="secondary">
                      {task.priority}
                    </Badge>
                    {task.dueDate && (
                      <span className="text-gray-500 flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {taskStats.todo === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No tasks yet</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-sm font-medium text-blue-600">
                <Clock className="w-4 h-4 mr-2" />
                In Progress ({taskStats.inProgress})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pb-4">
              {tasks?.filter(task => task.status === 'in_progress').map((task) => (
                <div 
                  key={task.id} 
                  className="p-3 bg-blue-50 border border-blue-200 rounded-lg"
                  onClick={() => handleViewTask(task)}
                >
                  <div className="flex items-start justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900 flex-1 pr-2">{task.title}</p>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditTask(task);
                      }}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <Badge className={getPriorityColor(task.priority)} variant="secondary">
                      {task.priority}
                    </Badge>
                    {task.dueDate && (
                      <span className="text-gray-500 flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {taskStats.inProgress === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No active tasks</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-sm font-medium text-green-600">
                <CheckCircle className="w-4 h-4 mr-2" />
                Completed ({taskStats.completed})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 px-4 pb-4">
              {tasks?.filter(task => task.status === 'completed').map((task) => (
                <div 
                  key={task.id} 
                  className="p-3 bg-green-50 border border-green-200 rounded-lg"
                  onClick={() => handleViewTask(task)}
                >
                  <div className="flex items-start justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900 flex-1 pr-2">{task.title}</p>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0 flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewTask(task);
                      }}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <Badge className={getPriorityColor(task.priority)} variant="secondary">
                      {task.priority}
                    </Badge>
                    {task.dueDate && (
                      <span className="text-gray-500 flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {taskStats.completed === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No completed tasks</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Batch Operations Toolbar */}
        {tasks && tasks.length > 0 && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={selectedTasksForBatch.size === tasks.length && tasks.length > 0}
                    onChange={(e) => handleSelectAllTasks(e.target.checked)}
                  />
                  <span className="text-sm text-gray-600">
                    Select All ({selectedTasksForBatch.size} of {tasks.length} selected)
                  </span>
                </label>
              </div>
              
              {selectedTasksForBatch.size > 0 && (
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedTasksForBatch(new Set())}
                  >
                    Clear Selection
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setIsBatchDeleteModalOpen(true)}
                    disabled={batchDeleteTasksMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete Selected ({selectedTasksForBatch.size})
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="hidden md:grid lg:grid-cols-3 gap-6">
          {/* To Do Tasks */}
          <Card 
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'todo')}
          >
            <CardHeader>
              <CardTitle className="flex items-center text-sm font-medium text-gray-600">
                <AlertCircle className="w-4 h-4 mr-2" />
                To Do ({taskStats.todo})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 min-h-[200px]">
              {tasks?.filter(task => task.status === 'todo').map((task) => (
                <div 
                  key={task.id} 
                  className="p-3 bg-white border border-gray-200 rounded-lg cursor-move hover:shadow-md transition-shadow"
                  draggable
                  onDragStart={(e) => handleDragStart(e, task)}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-start space-x-2 flex-1">
                      <input
                        type="checkbox"
                        className="mt-0.5 rounded border-gray-300"
                        checked={selectedTasksForBatch.has(task.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleTaskCheckboxChange(task.id, e.target.checked);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <p className="text-sm font-medium text-gray-900 flex-1">{task.title}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewTask(task)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEditTask(task)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDeleteTask(task)}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {task.description && (
                    <p className="text-xs text-gray-500 mb-2">{task.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <Badge className={getPriorityColor(task.priority)} variant="secondary">
                      {task.priority}
                    </Badge>
                    {task.dueDate && (
                      <span className="text-xs text-gray-500 flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        Due {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {taskStats.todo === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">Drop tasks here or create new ones</p>
              )}
            </CardContent>
          </Card>

          {/* In Progress Tasks */}
          <Card 
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'in_progress')}
          >
            <CardHeader>
              <CardTitle className="flex items-center text-sm font-medium text-blue-600">
                <Clock className="w-4 h-4 mr-2" />
                In Progress ({taskStats.inProgress})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 min-h-[200px]">
              {tasks?.filter(task => task.status === 'in_progress').map((task) => (
                <div 
                  key={task.id} 
                  className="p-3 bg-blue-50 border border-blue-200 rounded-lg cursor-move hover:shadow-md transition-shadow"
                  draggable
                  onDragStart={(e) => handleDragStart(e, task)}
                >
                  <div className="flex items-start justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900 flex-1">{task.title}</p>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewTask(task)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEditTask(task)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDeleteTask(task)}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {task.description && (
                    <p className="text-xs text-gray-500 mb-2">{task.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <Badge className={getPriorityColor(task.priority)} variant="secondary">
                      {task.priority}
                    </Badge>
                    {task.dueDate && (
                      <span className="text-xs text-gray-500 flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        Due {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {taskStats.inProgress === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">Drop tasks here</p>
              )}
            </CardContent>
          </Card>

          {/* Completed Tasks */}
          <Card 
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, 'completed')}
          >
            <CardHeader>
              <CardTitle className="flex items-center text-sm font-medium text-green-600">
                <CheckCircle className="w-4 h-4 mr-2" />
                Completed ({taskStats.completed})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 min-h-[200px]">
              {tasks?.filter(task => task.status === 'completed').map((task) => (
                <div 
                  key={task.id} 
                  className="p-3 bg-green-50 border border-green-200 rounded-lg cursor-move hover:shadow-md transition-shadow"
                  draggable
                  onDragStart={(e) => handleDragStart(e, task)}
                >
                  <div className="flex items-start justify-between mb-1">
                    <p className="text-sm font-medium text-gray-900 flex-1">{task.title}</p>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewTask(task)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEditTask(task)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDeleteTask(task)}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  {task.description && (
                    <p className="text-xs text-gray-500 mb-2">{task.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <Badge className={getPriorityColor(task.priority)} variant="secondary">
                      {task.priority}
                    </Badge>
                    {task.dueDate && (
                      <span className="text-xs text-gray-500 flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        Due {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
              {taskStats.completed === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">Drop completed tasks here</p>
              )}
            </CardContent>
          </Card>

          {/* Team Members Section */}
          <div className="lg:col-span-3">
            <ProjectMembers 
              projectId={id || ''} 
              isOwner={project.ownerId === user?.id} 
            />
          </div>
        </div>
      </div>

      {/* View Task Modal */}
      <Dialog open={isViewTaskModalOpen} onOpenChange={setIsViewTaskModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Task Details</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Title</label>
                <p className="text-sm text-gray-900 mt-1">{selectedTask.title}</p>
              </div>
              {selectedTask.description && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Description</label>
                  <p className="text-sm text-gray-900 mt-1">{selectedTask.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Status</label>
                  <p className="text-sm text-gray-900 mt-1 capitalize">{selectedTask.status.replace('_', ' ')}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Priority</label>
                  <Badge className={getPriorityColor(selectedTask.priority)} variant="secondary">
                    {selectedTask.priority}
                  </Badge>
                </div>
              </div>
              {selectedTask.dueDate && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Due Date</label>
                  <p className="text-sm text-gray-900 mt-1">{formatDate(selectedTask.dueDate)}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Task Modal */}
      <Dialog open={isEditTaskModalOpen} onOpenChange={setIsEditTaskModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter task title" {...field} />
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
                        placeholder="Enter task description" 
                        {...field} 
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="todo">To Do</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
                        value={typeof field.value === 'string' ? field.value : field.value?.toISOString().split('T')[0] || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditTaskModalOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateTaskMutation.isPending}
                  className="flex-1"
                >
                  {updateTaskMutation.isPending ? "Updating..." : "Update Task"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Task Modal */}
      <AlertDialog open={isDeleteTaskModalOpen} onOpenChange={setIsDeleteTaskModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedTask?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteTask}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteTaskMutation.isPending}
            >
              {deleteTaskMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch Delete Confirmation Modal */}
      <AlertDialog open={isBatchDeleteModalOpen} onOpenChange={setIsBatchDeleteModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Tasks</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedTasksForBatch.size} selected task{selectedTasksForBatch.size === 1 ? '' : 's'}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBatchDelete}
              disabled={batchDeleteTasksMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {batchDeleteTasksMutation.isPending 
                ? "Deleting..." 
                : `Delete ${selectedTasksForBatch.size} Task${selectedTasksForBatch.size === 1 ? '' : 's'}`
              }
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Meeting Prep Modal */}
      <Dialog open={isMeetingPrepModalOpen} onOpenChange={setIsMeetingPrepModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              🎯 Meeting Preparation - {project.name}
            </DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-300">
              AI-generated talking points and project analysis for your meeting
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 mt-6">
            {isGeneratingPrep ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center space-y-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  <p className="text-gray-600 dark:text-gray-300">Analyzing project data and generating talking points...</p>
                </div>
              </div>
            ) : meetingPreparation ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    AI-Generated Meeting Preparation
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generateMeetingPrep}
                    disabled={isGeneratingPrep}
                    className="flex items-center gap-2"
                    data-testid="button-regenerate-prep"
                  >
                    🔄 Regenerate
                  </Button>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 max-h-[55vh] overflow-y-auto">
                  <div 
                    className="text-sm leading-relaxed text-gray-800 dark:text-gray-200"
                    style={{
                      whiteSpace: 'pre-wrap',
                      lineHeight: '1.6'
                    }}
                    data-testid="ai-preparation-content"
                  >
                    {meetingPreparation}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Generate AI-powered talking points for your meeting
                </p>
                <Button
                  onClick={generateMeetingPrep}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  data-testid="button-generate-prep"
                >
                  🤖 Generate Meeting Prep
                </Button>
              </div>
            )}
          </div>
          
          <div className="flex justify-end space-x-4 mt-8">
            <Button
              variant="outline"
              onClick={() => {
                setIsMeetingPrepModalOpen(false);
                setMeetingPreparation(null); // Reset for next time
              }}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              data-testid="button-close-prep"
            >
              Close
            </Button>
            {meetingPreparation && (
              <Button
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white"
                onClick={() => {
                  // Copy to clipboard
                  navigator.clipboard.writeText(meetingPreparation);
                  toast({
                    title: "Copied to clipboard!",
                    description: "Meeting preparation has been copied for easy sharing.",
                  });
                }}
                data-testid="button-copy-prep"
              >
                📋 Copy to Clipboard
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}