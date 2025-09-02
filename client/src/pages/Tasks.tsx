import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Filter, CheckCircle, Clock, AlertCircle, User, Edit3, Trash2, MoreHorizontal, Eye } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTaskSchema } from "@shared/schema";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Create a form schema that keeps dueDate as string for form inputs
const taskFormSchema = insertTaskSchema.extend({
  dueDate: z.string().optional(),
});

type TaskFormData = z.infer<typeof taskFormSchema>;

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  projectId: string;
  dueDate?: string;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
}

export default function Tasks() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tasks, isLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: TaskFormData) => {
      const response = await apiRequest("POST", "/api/tasks", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setIsCreateModalOpen(false);
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
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<TaskFormData> }) => {
      const response = await apiRequest("PUT", `/api/tasks/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setIsEditModalOpen(false);
      setSelectedTask(null);
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
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/tasks/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
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

  const form = useForm<TaskFormData>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      status: "todo",
      priority: "medium",
      projectId: "",
      dueDate: "",
    },
  });

  const onSubmit = (data: TaskFormData) => {
    // Convert form data to the format expected by the API
    const processedData = {
      ...data,
      dueDate: data.dueDate && data.dueDate.trim() ? data.dueDate : undefined,
    };
    
    if (selectedTask) {
      updateTaskMutation.mutate({ id: selectedTask.id, updates: processedData });
    } else {
      createTaskMutation.mutate(processedData);
    }
  };

  const openEditModal = (task: Task) => {
    setSelectedTask(task);
    form.reset({
      title: task.title,
      description: task.description || "",
      status: task.status,
      priority: task.priority,
      projectId: task.projectId,
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : "",
    });
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedTask(null);
    form.reset({
      title: "",
      description: "",
      status: "todo",
      priority: "medium",
      projectId: "",
      dueDate: "",
    });
  };

  const toggleTaskComplete = (task: Task) => {
    const newStatus = task.status === 'completed' ? 'todo' : 'completed';
    updateTaskMutation.mutate({
      id: task.id,
      updates: { status: newStatus },
    });
  };

  // Automated Task Prioritization Function
  const getAutomaticPriority = (task: Task) => {
    const now = new Date();
    const dueDate = task.dueDate ? new Date(task.dueDate) : null;
    
    if (!dueDate) return task.priority;
    
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    // Overdue tasks become urgent
    if (daysUntilDue < 0) return 'urgent';
    
    // Tasks due within 1 day become high priority
    if (daysUntilDue <= 1) return 'high';
    
    // Tasks due within 3 days become medium priority if they're currently low
    if (daysUntilDue <= 3 && task.priority === 'low') return 'medium';
    
    return task.priority;
  };

  // Sort tasks by priority and due date
  const sortTasksByPriority = (taskList: Task[]) => {
    const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
    
    return taskList.sort((a, b) => {
      // First sort by automatic priority
      const aPriority = getAutomaticPriority(a);
      const bPriority = getAutomaticPriority(b);
      const priorityDiff = (priorityOrder[bPriority as keyof typeof priorityOrder] || 0) - 
                          (priorityOrder[aPriority as keyof typeof priorityOrder] || 0);
      
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then sort by due date (closest first)
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;
      
      // Finally sort by creation date (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-800";
      case "high":
        return "bg-orange-100 text-orange-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "in_progress":
        return <Clock className="w-4 h-4 text-blue-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  // Filter and sort tasks based on status, priority, and project with automated prioritization
  const filteredTasks = tasks?.filter(task => {
    const automaticPriority = getAutomaticPriority(task);
    const statusMatch = statusFilter === "all" || task.status === statusFilter;
    const priorityMatch = priorityFilter === "all" || automaticPriority === priorityFilter;
    const projectMatch = projectFilter === "all" || task.projectId === projectFilter;
    return statusMatch && priorityMatch && projectMatch;
  }) || [];
  
  // Helper function to get project name
  const getProjectName = (projectId: string) => {
    const project = projects?.find(p => p.id === projectId);
    return project?.name || "Unknown Project";
  };

  const sortedFilteredTasks = sortTasksByPriority(filteredTasks);

  const tasksByStatus = {
    todo: sortedFilteredTasks.filter(t => t.status === 'todo'),
    in_progress: sortedFilteredTasks.filter(t => t.status === 'in_progress'),
    completed: sortedFilteredTasks.filter(t => t.status === 'completed'),
  };

  if (isLoading) {
    return (
      <div className="p-4 lg:p-8 pb-20 lg:pb-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-500">Loading tasks...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 pb-20 lg:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2 sm:mb-0">
            Tasks
          </h1>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <AlertCircle className="w-4 h-4" />
            <span>Smart prioritization active - overdue and urgent tasks auto-promoted</span>
          </div>
        </div>
        
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />
              New Task
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
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
                          value={field.value || ""}
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
                    onClick={() => setIsCreateModalOpen(false)}
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

        {/* Edit Task Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={(open) => {
          if (!open) closeEditModal();
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Task</DialogTitle>
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
                  name="projectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
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
                    control={form.control}
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

                <div className="flex flex-col sm:flex-row justify-end gap-2 sm:space-x-2 sm:gap-0 pt-4">
                  <Button type="button" variant="outline" onClick={closeEditModal} className="w-full sm:w-auto">
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updateTaskMutation.isPending}
                    className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
                  >
                    {updateTaskMutation.isPending ? "Updating..." : "Update Task"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="todo">To Do</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="urgent">🚨 Urgent</SelectItem>
            <SelectItem value="high">🔥 High</SelectItem>
            <SelectItem value="medium">⚡ Medium</SelectItem>
            <SelectItem value="low">🟢 Low</SelectItem>
          </SelectContent>
        </Select>

        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
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

        {/* Task Summary */}
        <div className="flex items-center space-x-4 text-sm text-gray-600 ml-auto">
          <span>{sortedFilteredTasks.length} tasks shown</span>
          <span>•</span>
          <span>{sortedFilteredTasks.filter(t => getAutomaticPriority(t) !== t.priority).length} auto-prioritized</span>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* To Do */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-sm font-medium text-gray-600">
              <AlertCircle className="w-4 h-4 mr-2" />
              To Do ({tasksByStatus.todo.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tasksByStatus.todo.map((task) => (
              <div
                key={task.id}
                className="p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start space-x-3">
                  <Checkbox
                    checked={false}
                    onCheckedChange={() => toggleTaskComplete(task)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 mb-1">{task.title}</p>
                    <p className="text-xs text-blue-600 font-medium mb-1">{getProjectName(task.projectId)}</p>
                    {task.description && (
                      <p className="text-xs text-gray-500 mb-2">{task.description}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <Badge className={getPriorityColor(getAutomaticPriority(task))} variant="secondary">
                        {getAutomaticPriority(task)}
                        {getAutomaticPriority(task) !== task.priority && (
                          <span className="ml-1 text-xs opacity-75">(auto)</span>
                        )}
                      </Badge>
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                          <User className="w-3 h-3 text-gray-400" />
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => {
                                setSelectedTask(task);
                                setIsDetailsModalOpen(true);
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditModal(task)}>
                              <Edit3 className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => deleteTaskMutation.mutate(task.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    {task.dueDate && (
                      <div className="mt-2 flex items-center text-xs text-gray-500">
                        <Clock className="w-3 h-3 mr-1" />
                        Due {new Date(task.dueDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {tasksByStatus.todo.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">No tasks</p>
            )}
          </CardContent>
        </Card>

        {/* In Progress */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-sm font-medium text-blue-600">
              <Clock className="w-4 h-4 mr-2" />
              In Progress ({tasksByStatus.in_progress.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tasksByStatus.in_progress.map((task) => (
              <div
                key={task.id}
                className="p-3 bg-blue-50 border border-blue-200 rounded-lg hover:border-blue-300 transition-colors"
              >
                <div className="flex items-start space-x-3">
                  <Checkbox
                    checked={false}
                    onCheckedChange={() => toggleTaskComplete(task)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 mb-1">{task.title}</p>
                    <p className="text-xs text-blue-600 font-medium mb-1">{getProjectName(task.projectId)}</p>
                    {task.description && (
                      <p className="text-xs text-gray-500 mb-2">{task.description}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <Badge className={getPriorityColor(getAutomaticPriority(task))} variant="secondary">
                        {getAutomaticPriority(task)}
                        {getAutomaticPriority(task) !== task.priority && (
                          <span className="ml-1 text-xs opacity-75">(auto)</span>
                        )}
                      </Badge>
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 bg-blue-200 rounded-full flex items-center justify-center">
                          <User className="w-3 h-3 text-blue-600" />
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => {
                                setSelectedTask(task);
                                setIsDetailsModalOpen(true);
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditModal(task)}>
                              <Edit3 className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => deleteTaskMutation.mutate(task.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    {task.dueDate && (
                      <div className="mt-2 flex items-center text-xs text-gray-500">
                        <Clock className="w-3 h-3 mr-1" />
                        Due {new Date(task.dueDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {tasksByStatus.in_progress.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">No tasks</p>
            )}
          </CardContent>
        </Card>

        {/* Completed */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center text-sm font-medium text-green-600">
              <CheckCircle className="w-4 h-4 mr-2" />
              Completed ({tasksByStatus.completed.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tasksByStatus.completed.map((task) => (
              <div
                key={task.id}
                className="p-3 bg-green-50 border border-green-200 rounded-lg hover:border-green-300 transition-colors"
              >
                <div className="flex items-start space-x-3">
                  <Checkbox
                    checked={true}
                    onCheckedChange={() => toggleTaskComplete(task)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 line-through mb-1">{task.title}</p>
                    <p className="text-xs text-blue-600 font-medium mb-1 line-through">{getProjectName(task.projectId)}</p>
                    {task.description && (
                      <p className="text-xs text-gray-500 mb-2">{task.description}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <Badge className={getPriorityColor(getAutomaticPriority(task))} variant="secondary">
                        {getAutomaticPriority(task)}
                        {getAutomaticPriority(task) !== task.priority && (
                          <span className="ml-1 text-xs opacity-75">(auto)</span>
                        )}
                      </Badge>
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 bg-green-200 rounded-full flex items-center justify-center">
                          <User className="w-3 h-3 text-green-600" />
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => {
                                setSelectedTask(task);
                                setIsDetailsModalOpen(true);
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditModal(task)}>
                              <Edit3 className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => deleteTaskMutation.mutate(task.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    {task.dueDate && (
                      <div className="mt-2 flex items-center text-xs text-gray-500">
                        <Clock className="w-3 h-3 mr-1" />
                        Due {new Date(task.dueDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {tasksByStatus.completed.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">No tasks</p>
            )}
          </CardContent>
        </Card>
      </div>

      {filteredTasks.length === 0 && tasks && tasks.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks yet</h3>
          <p className="text-gray-500 mb-6">Get started by creating your first task.</p>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Task
          </Button>
        </div>
      )}

      {/* Task Details Modal */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="sm:max-w-lg max-w-[95vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <span>Task Details</span>
              {selectedTask && (
                <Badge className={getPriorityColor(getAutomaticPriority(selectedTask))} variant="secondary">
                  {getAutomaticPriority(selectedTask)}
                  {getAutomaticPriority(selectedTask) !== selectedTask.priority && (
                    <span className="ml-1 text-xs opacity-75">(auto-prioritized)</span>
                  )}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {selectedTask && (
            <div className="space-y-4">
              {/* Task Title */}
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">
                  {selectedTask.title}
                </h3>
              </div>

              {/* Task Description */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Description</h4>
                <div className="bg-gray-50 border rounded-lg p-3">
                  <p className="text-sm text-gray-900 leading-relaxed">
                    {selectedTask.description || "No description provided"}
                  </p>
                </div>
              </div>

              {/* Task Metadata */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Status</h4>
                  <Badge 
                    variant="secondary"
                    className={
                      selectedTask.status === 'completed' 
                        ? 'bg-green-100 text-green-800' 
                        : selectedTask.status === 'in_progress'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }
                  >
                    {selectedTask.status === 'todo' ? 'To Do' : 
                     selectedTask.status === 'in_progress' ? 'In Progress' : 
                     'Completed'}
                  </Badge>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Priority</h4>
                  <Badge className={getPriorityColor(selectedTask.priority)} variant="secondary">
                    {selectedTask.priority}
                  </Badge>
                  {getAutomaticPriority(selectedTask) !== selectedTask.priority && (
                    <p className="text-xs text-amber-600 mt-1">
                      Auto: {getAutomaticPriority(selectedTask)}
                    </p>
                  )}
                </div>
              </div>

              {/* Due Date and Project */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Due Date</h4>
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-900">
                      {selectedTask.dueDate ? 
                        new Date(selectedTask.dueDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric'
                        }) : 
                        'No due date'
                      }
                    </span>
                  </div>
                  {selectedTask.dueDate && (
                    <p className="text-xs text-gray-500 mt-1">
                      {(() => {
                        const days = Math.ceil((new Date(selectedTask.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                        if (days < 0) return `${Math.abs(days)}d overdue`;
                        if (days === 0) return 'Due today';
                        if (days === 1) return 'Due tomorrow';
                        return `${days}d remaining`;
                      })()}
                    </p>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Project</h4>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-sm text-gray-900 truncate">
                      {projects?.find(p => p.id === selectedTask.projectId)?.name || 'Unknown'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Creation Date */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-1">Created</h4>
                <p className="text-sm text-gray-600">
                  {new Date(selectedTask.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })}
                </p>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 pt-3 border-t">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsDetailsModalOpen(false)}
                >
                  Close
                </Button>
                <Button 
                  size="sm"
                  onClick={() => {
                    setIsDetailsModalOpen(false);
                    openEditModal(selectedTask);
                  }}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
