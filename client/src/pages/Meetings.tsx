import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Plus, 
  Calendar, 
  Clock, 
  Users, 
  Mic, 
  Play, 
  Trash2,
  FileText,
  Brain,
  CheckSquare,
  MoreVertical,
  Edit3,
  Eye,
  AlertTriangle,
  Check,
  Target
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertMeetingSchema } from "@shared/schema";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import VoiceRecordingModal from "@/components/modals/VoiceRecordingModal";
import { useVoiceRecording } from "@/contexts/VoiceRecordingContext";
import { recordingStorage, type StoredRecording } from "@/lib/recordingStorage";

type MeetingFormData = z.infer<typeof insertMeetingSchema>;

interface Meeting {
  id: string;
  title: string;
  description?: string;
  projectId?: string;
  scheduledAt: string;
  duration: number;
  recordingUrl?: string;
  transcription?: string;
  aiSummary?: string;
  extractedTasks?: any[];
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
}

export default function Meetings() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isTranscriptModalOpen, setIsTranscriptModalOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [selectedMeetings, setSelectedMeetings] = useState<Set<string>>(new Set());
  const [isSelectAll, setIsSelectAll] = useState(false);
  const [showPendingRecordings, setShowPendingRecordings] = useState(false);
  const [pendingRecordings, setPendingRecordings] = useState<any[]>([]);
  const [showFailedRecordings, setShowFailedRecordings] = useState(false);
  const [failedRecordings, setFailedRecordings] = useState<StoredRecording[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { retryFailedUploads, getPendingRecordings, queueStatus, deleteUnrecoverableFailedRecordings } = useVoiceRecording();

  const { data: meetings, isLoading } = useQuery<Meeting[]>({
    queryKey: ["/api/meetings"],
  });

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const createMeetingMutation = useMutation({
    mutationFn: async (data: MeetingFormData) => {
      const response = await apiRequest("POST", "/api/meetings", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      setIsCreateModalOpen(false);
      toast({
        title: "Success",
        description: "Meeting created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create meeting",
        variant: "destructive",
      });
    },
  });

  const updateMeetingMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<MeetingFormData> }) => {
      const response = await apiRequest("PUT", `/api/meetings/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      setIsEditModalOpen(false);
      setSelectedMeeting(null);
      toast({
        title: "Success",
        description: "Meeting updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update meeting",
        variant: "destructive",
      });
    },
  });

  const deleteMeetingMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/meetings/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      toast({
        title: "Success",
        description: "Meeting deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete meeting",
        variant: "destructive",
      });
    },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: async (meetingIds: string[]) => {
      const response = await apiRequest("DELETE", "/api/meetings/batch", { meetingIds });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      setSelectedMeetings(new Set());
      setIsSelectAll(false);
      toast({
        title: "Success",
        description: `Successfully deleted ${data.deletedCount} meeting(s)`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete selected meetings",
        variant: "destructive",
      });
    },
  });

  // Load pending recordings on mount
  useEffect(() => {
    const loadPendingRecordings = async () => {
      try {
        const pending = await getPendingRecordings();
        setPendingRecordings(pending);
      } catch (error) {
        console.error('Failed to load pending recordings:', error);
      }
    };
    
    loadPendingRecordings();
  }, [getPendingRecordings]);

  const form = useForm<MeetingFormData>({
    resolver: zodResolver(insertMeetingSchema.omit({ createdById: true })),
    defaultValues: {
      title: "",
      description: "",
      scheduledAt: new Date(),
      duration: 60,
    },
  });

  const onSubmit = (data: MeetingFormData) => {
    if (selectedMeeting && isEditModalOpen) {
      updateMeetingMutation.mutate({ id: selectedMeeting.id, updates: data });
    } else {
      createMeetingMutation.mutate(data);
    }
  };

  const openEditModal = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    form.reset({
      title: meeting.title,
      description: meeting.description || "",
      projectId: meeting.projectId || "",
      scheduledAt: new Date(meeting.scheduledAt),
      duration: meeting.duration,
    });
    setIsEditModalOpen(true);
  };

  const openTranscriptModal = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setIsTranscriptModalOpen(true);
  };


  // Batch selection handlers
  const handleSelectMeeting = (meetingId: string, checked: boolean) => {
    const newSelected = new Set(selectedMeetings);
    if (checked) {
      newSelected.add(meetingId);
    } else {
      newSelected.delete(meetingId);
    }
    setSelectedMeetings(newSelected);
    
    // Update select all state
    if (meetings) {
      setIsSelectAll(newSelected.size === meetings.length);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked && meetings) {
      setSelectedMeetings(new Set(meetings.map(m => m.id)));
      setIsSelectAll(true);
    } else {
      setSelectedMeetings(new Set());
      setIsSelectAll(false);
    }
  };

  const handleBatchDelete = () => {
    if (selectedMeetings.size === 0) return;
    batchDeleteMutation.mutate(Array.from(selectedMeetings));
  };

  // Failed recordings management
  const loadFailedRecordings = async () => {
    try {
      const failed = await recordingStorage.getRecordingsByStatus('failed');
      const unrecoverable = await recordingStorage.getUnrecoverableFailedRecordings();
      // Combine both failed and unrecoverable recordings (remove duplicates)
      const allFailed = [...failed, ...unrecoverable.filter(r => !failed.find(f => f.id === r.id))];
      setFailedRecordings(allFailed);
    } catch (error) {
      console.error('Failed to load failed recordings:', error);
    }
  };

  const deleteFailedRecording = async (recordingId: string) => {
    try {
      await recordingStorage.deleteRecording(recordingId);
      await loadFailedRecordings(); // Refresh the list
      toast({
        title: "Recording Deleted",
        description: "Failed recording has been removed",
      });
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "Could not delete the recording",
        variant: "destructive",
      });
    }
  };

  const handleBulkDeleteFailedRecordings = async () => {
    try {
      const deletedCount = await deleteUnrecoverableFailedRecordings();
      await loadFailedRecordings(); // Refresh the list
      if (deletedCount === 0) {
        toast({
          title: "No Recordings to Delete",
          description: "There are no unrecoverable failed recordings to delete.",
        });
      }
    } catch (error) {
      toast({
        title: "Bulk Delete Failed",
        description: "Could not delete failed recordings",
        variant: "destructive",
      });
    }
  };

  // Load failed recordings when component mounts or when queue status changes
  useEffect(() => {
    if (showFailedRecordings) {
      loadFailedRecordings();
    }
  }, [showFailedRecordings, queueStatus]);

  const resetForm = () => {
    setSelectedMeeting(null);
    form.reset({
      title: "",
      description: "",
      scheduledAt: new Date(),
      duration: 60,
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, // Use user's local timezone
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, // Use user's local timezone
    });
  };

  const formatDuration = (duration: number, meeting?: Meeting) => {
    // For voice recordings, show "< 1 min" only if it's exactly 1 minute (likely a short recording)
    // Otherwise show the actual duration
    if (meeting?.title?.includes('Voice Recording') || meeting?.description?.includes('AI-processed')) {
      if (duration === 1) {
        return "< 1 min";
      }
    }
    
    if (duration === 0) {
      return "0 min";
    }
    
    if (duration < 60) {
      return `${Math.round(duration)} min`;
    }
    
    const hours = Math.floor(duration / 60);
    const minutes = Math.round(duration % 60);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  };

  const getMeetingStatus = (meeting: Meeting) => {
    const now = new Date();
    // Handle both ISO string and custom server date format
    const scheduledTime = new Date(meeting.scheduledAt);
    const endTime = new Date(scheduledTime.getTime() + meeting.duration * 60000);

    // Voice recordings are always completed regardless of timing
    if (meeting.title?.includes('Voice Recording') || 
        meeting.description?.includes('AI-processed') ||
        meeting.title?.includes('from Modal')) {
      return "completed";
    }

    // Handle regular meetings
    if (now < scheduledTime) return "upcoming";
    if (now >= scheduledTime && now <= endTime) return "ongoing";
    return "completed";
  };

  if (isLoading) {
    return (
      <div className="p-4 lg:p-8 pb-20 lg:pb-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading meetings...</div>
        </div>
      </div>
    );
  }

  const upcomingMeetings = meetings?.filter(m => getMeetingStatus(m) === "upcoming") || [];
  const pastMeetings = meetings?.filter(m => getMeetingStatus(m) === "completed") || [];

  return (
    <div className="p-4 lg:p-8 pb-20 lg:pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
            Meetings
          </h1>
          <p className="text-gray-600">
            Schedule meetings and record sessions with AI transcription
          </p>
        </div>
        
        <div className="flex space-x-3 mt-4 sm:mt-0">
          {(queueStatus.failed > 0 || pendingRecordings.length > 0) && (
            <Button
              onClick={() => setShowPendingRecordings(true)}
              variant="outline"
              className="border-orange-500 text-orange-600 hover:bg-orange-50"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Recover Recordings ({queueStatus.failed + pendingRecordings.length})
            </Button>
          )}
          
          {selectedMeetings.size > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="destructive"
                  disabled={batchDeleteMutation.isPending}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Selected ({selectedMeetings.size})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Selected Meetings</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete {selectedMeetings.size} selected meeting(s)? 
                    This action cannot be undone and will permanently delete all meeting data including recordings and transcripts.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleBatchDelete}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Delete {selectedMeetings.size} Meeting(s)
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          
          <Button
            onClick={() => setIsVoiceModalOpen(true)}
            variant="outline"
            className="border-secondary text-secondary hover:bg-secondary hover:text-white"
          >
            <Mic className="w-4 h-4 mr-2" />
            Start Recording
          </Button>
          
          
          
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" />
                Schedule Meeting
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Schedule New Meeting</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Meeting Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter meeting title" {...field} />
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
                            placeholder="Enter meeting description" 
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
                        <FormLabel>Project (Optional)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
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
                    name="scheduledAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Scheduled Date & Time</FormLabel>
                        <FormControl>
                          <Input
                            type="datetime-local"
                            {...field}
                            value={field.value ? (() => {
                              const date = new Date(field.value);
                              // Format for datetime-local input in user's local timezone
                              const year = date.getFullYear();
                              const month = String(date.getMonth() + 1).padStart(2, '0');
                              const day = String(date.getDate()).padStart(2, '0');
                              const hours = String(date.getHours()).padStart(2, '0');
                              const minutes = String(date.getMinutes()).padStart(2, '0');
                              return `${year}-${month}-${day}T${hours}:${minutes}`;
                            })() : ""}
                            onChange={(e) => {
                              // Preserve user's local time selection
                              if (e.target.value) {
                                // Parse the datetime-local value correctly without timezone shift
                                const [datePart, timePart] = e.target.value.split('T');
                                const [year, month, day] = datePart.split('-').map(Number);
                                const [hour, minute] = timePart.split(':').map(Number);
                                
                                // Create date using local timezone values
                                const localDate = new Date(year, month - 1, day, hour, minute);
                                field.onChange(localDate);
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="duration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duration (minutes)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateModalOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createMeetingMutation.isPending}>
                      {createMeetingMutation.isPending ? "Creating..." : "Create Meeting"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Batch Select Controls */}
      {meetings && meetings.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Checkbox 
                  checked={isSelectAll}
                  onCheckedChange={handleSelectAll}
                  id="select-all"
                />
                <label 
                  htmlFor="select-all" 
                  className="text-sm font-medium cursor-pointer"
                >
                  Select All ({meetings.length} meetings)
                </label>
              </div>
              <div className="text-sm text-gray-500">
                {selectedMeetings.size} selected
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recording Management Section - Only show when there are failed recordings */}
      {showFailedRecordings && (queueStatus.failed + queueStatus.unrecoverable) > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div 
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => setShowFailedRecordings(!showFailedRecordings)}
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  <CardTitle className="text-red-800">
                    Recording Management {(queueStatus.failed + queueStatus.unrecoverable) > 0 && `(${queueStatus.failed + queueStatus.unrecoverable} failed)`}
                  </CardTitle>
                </div>
                <Button variant="ghost" size="sm">
                  {showFailedRecordings ? (
                    <>Hide <Check className="w-4 h-4 ml-1" /></>
                  ) : (
                    <>Show <Eye className="w-4 h-4 ml-1" /></>
                  )}
                </Button>
              </div>
              <div className="flex gap-2">
                {queueStatus.failed > 0 && (
                  <Button 
                    onClick={retryFailedUploads}
                    variant="outline"
                    size="sm"
                    className="border-blue-500 text-blue-600 hover:bg-blue-50"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Retry Failed
                  </Button>
                )}
                <Button 
                  onClick={handleBulkDeleteFailedRecordings}
                  variant="destructive"
                  size="sm"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete All Failed
                </Button>
              </div>
            </div>
          </CardHeader>
          
          {showFailedRecordings && (
            <CardContent className="pt-0">
              <div className="text-sm text-red-700 mb-4">
                {(queueStatus.failed + queueStatus.unrecoverable) > 0 
                  ? "These recordings failed to upload or process. You can retry failed uploads or delete recordings that cannot be recovered."
                  : "No failed recordings found. You can use this section to clean up any problematic recordings if they appear in the future."
                }
              </div>
              
              {(queueStatus.failed + queueStatus.unrecoverable) === 0 ? (
                <div className="text-center text-green-600 py-4 bg-green-50 rounded-lg">
                  <Check className="w-6 h-6 mx-auto mb-2" />
                  All recordings are working properly!
                </div>
              ) : failedRecordings.length === 0 ? (
                <div className="text-center text-red-600 py-4">
                  Loading failed recordings...
                </div>
              ) : (
                <div className="space-y-3">
                  {failedRecordings.map((recording) => (
                    <div key={recording.id} className="flex items-center justify-between p-3 bg-white border border-red-200 rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          {recording.metadata.title || 'Untitled Recording'}
                        </div>
                        <div className="text-sm text-gray-600">
                          {new Date(recording.timestamp).toLocaleString()} • 
                          {Math.round(recording.metadata.size / 1024 / 1024 * 100) / 100}MB • 
                          {recording.duration}s • 
                          {recording.chunks?.length || 0} chunks
                        </div>
                        {recording.lastError && (
                          <div className="text-sm text-red-600 mt-1">
                            Error: {recording.lastError}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={recording.retryCount >= 3 ? "destructive" : "secondary"}>
                          {recording.status} {recording.retryCount > 0 && `(${recording.retryCount} retries)`}
                        </Badge>
                        <Button 
                          onClick={() => deleteFailedRecording(recording.id)}
                          variant="destructive" 
                          size="sm"
                          data-testid={`button-delete-failed-recording-${recording.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* Meeting Lists */}
      <div className="space-y-6">
        {/* Upcoming Meetings */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Upcoming Meetings ({upcomingMeetings.length})
          </h2>
          {upcomingMeetings.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-gray-500">
                No upcoming meetings scheduled
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {upcomingMeetings.map((meeting) => (
                <Card key={meeting.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center space-x-3">
                        <Checkbox 
                          checked={selectedMeetings.has(meeting.id)}
                          onCheckedChange={(checked) => handleSelectMeeting(meeting.id, checked as boolean)}
                          id={`meeting-${meeting.id}`}
                        />
                        <CardTitle className="text-lg">{meeting.title}</CardTitle>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="secondary">Upcoming</Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditModal(meeting)}>
                              <Edit3 className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600">
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Meeting</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{meeting.title}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteMeetingMutation.mutate(meeting.id)}
                                    className="bg-blue-600 hover:bg-blue-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        {formatDate(meeting.scheduledAt)}
                      </div>
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        {formatTime(meeting.scheduledAt)}
                      </div>
                      <div className="flex items-center">
                        <Users className="w-4 h-4 mr-1" />
                        {formatDuration(meeting.duration, meeting)}
                      </div>
                    </div>
                    {meeting.description && (
                      <p className="text-sm text-gray-600 mt-2">{meeting.description}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Past Meetings */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Past Meetings ({pastMeetings.length})
          </h2>
          {pastMeetings.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-gray-500">
                No past meetings found
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {pastMeetings.map((meeting) => (
                <Card key={meeting.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center space-x-3">
                        <Checkbox 
                          checked={selectedMeetings.has(meeting.id)}
                          onCheckedChange={(checked) => handleSelectMeeting(meeting.id, checked as boolean)}
                          id={`meeting-past-${meeting.id}`}
                        />
                        <div className="flex items-center space-x-2">
                          <CardTitle className="text-lg">{meeting.title}</CardTitle>
                          {meeting.transcription && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700">
                              <Brain className="w-3 h-3 mr-1" />
                              AI Processed
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">Completed</Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {meeting.transcription && (
                              <DropdownMenuItem onClick={() => openTranscriptModal(meeting)}>
                                <Eye className="w-4 h-4 mr-2" />
                                View Transcript
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => openEditModal(meeting)}>
                              <Edit3 className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-red-600">
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Meeting</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{meeting.title}"? This will also delete any transcription and AI-generated content. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteMeetingMutation.mutate(meeting.id)}
                                    className="bg-blue-600 hover:bg-blue-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        {formatDate(meeting.scheduledAt)}
                      </div>
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        {formatTime(meeting.scheduledAt)}
                      </div>
                      <div className="flex items-center">
                        <Users className="w-4 h-4 mr-1" />
                        {formatDuration(meeting.duration, meeting)}
                      </div>
                    </div>
                    
                    {meeting.description && (
                      <p className="text-sm text-gray-600 mb-3">{meeting.description}</p>
                    )}

                    {/* AI-Generated Content */}
                    {(meeting.transcription || meeting.aiSummary || meeting.extractedTasks) && (
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2 text-sm text-blue-600">
                          <Brain className="w-4 h-4" />
                          <span>AI Processing Complete</span>
                        </div>
                        
                        {meeting.aiSummary && (
                          <div className="bg-blue-50 p-3 rounded">
                            <div className="flex items-center space-x-2 mb-2">
                              <FileText className="w-4 h-4 text-blue-600" />
                              <span className="font-medium text-blue-900">Summary</span>
                            </div>
                            <p className="text-sm text-blue-800">{meeting.aiSummary}</p>
                          </div>
                        )}
                        
                        {meeting.extractedTasks && meeting.extractedTasks.length > 0 && (
                          <div className="bg-green-50 p-3 rounded">
                            <div className="flex items-center space-x-2 mb-2">
                              <CheckSquare className="w-4 h-4 text-green-600" />
                              <span className="font-medium text-green-900">
                                Tasks Created ({meeting.extractedTasks.length})
                              </span>
                            </div>
                            <div className="space-y-1">
                              {meeting.extractedTasks.slice(0, 3).map((task: any, index: number) => (
                                <div key={index} className="text-sm text-green-800">
                                  • {task.title}
                                </div>
                              ))}
                              {meeting.extractedTasks.length > 3 && (
                                <div className="text-sm text-green-600">
                                  +{meeting.extractedTasks.length - 3} more tasks...
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Voice Recording Modal */}
      <VoiceRecordingModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
      />

      {/* Edit Meeting Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={(open) => {
        if (!open) {
          setIsEditModalOpen(false);
          resetForm();
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Meeting</DialogTitle>
            <DialogDescription>
              Update the meeting details below.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meeting Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter meeting title" {...field} />
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
                        placeholder="Enter meeting description" 
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
                    <FormLabel>Project (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
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
                name="scheduledAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Scheduled Date & Time</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        {...field}
                        value={field.value ? (() => {
                          const date = new Date(field.value);
                          // Format for datetime-local input in user's local timezone
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const day = String(date.getDate()).padStart(2, '0');
                          const hours = String(date.getHours()).padStart(2, '0');
                          const minutes = String(date.getMinutes()).padStart(2, '0');
                          return `${year}-${month}-${day}T${hours}:${minutes}`;
                        })() : ""}
                        onChange={(e) => {
                          // Preserve user's local time selection
                          if (e.target.value) {
                            // Parse the datetime-local value correctly without timezone shift
                            const [datePart, timePart] = e.target.value.split('T');
                            const [year, month, day] = datePart.split('-').map(Number);
                            const [hour, minute] = timePart.split(':').map(Number);
                            
                            // Create date using local timezone values
                            const localDate = new Date(year, month - 1, day, hour, minute);
                            field.onChange(localDate);
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (minutes)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMeetingMutation.isPending}>
                  {updateMeetingMutation.isPending ? "Updating..." : "Update Meeting"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Transcript Modal */}
      <Dialog open={isTranscriptModalOpen} onOpenChange={setIsTranscriptModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <FileText className="w-5 h-5" />
              <span>Meeting Transcript</span>
            </DialogTitle>
            <DialogDescription>
              {selectedMeeting?.title} - {selectedMeeting && formatDate(selectedMeeting.scheduledAt)}
            </DialogDescription>
          </DialogHeader>
          {selectedMeeting?.transcription ? (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold text-gray-900 mb-2">Transcription</h4>
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {selectedMeeting.transcription}
                </p>
              </div>
              
              {selectedMeeting.aiSummary && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
                    <Brain className="w-4 h-4 mr-2" />
                    AI Summary
                  </h4>
                  <p className="text-blue-800">{selectedMeeting.aiSummary}</p>
                </div>
              )}
              
              {selectedMeeting.extractedTasks && selectedMeeting.extractedTasks.length > 0 && (
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-green-900 mb-2 flex items-center">
                    <CheckSquare className="w-4 h-4 mr-2" />
                    Extracted Tasks ({selectedMeeting.extractedTasks.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedMeeting.extractedTasks.map((task: any, index: number) => (
                      <div key={index} className="text-green-800">
                        <div className="font-medium">• {task.title}</div>
                        {task.description && (
                          <div className="text-sm text-green-700 ml-4">{task.description}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No transcription available for this meeting.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>


      {/* Pending Recordings Recovery Modal */}
      <Dialog open={showPendingRecordings} onOpenChange={setShowPendingRecordings}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <span>Recover Pending Recordings</span>
            </DialogTitle>
            <DialogDescription>
              These recordings are saved locally and can be processed now or retried if they failed previously.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {queueStatus.failed > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-semibold text-red-900 mb-1">
                      Failed Uploads ({queueStatus.failed})
                    </h4>
                    <p className="text-sm text-red-700 mb-3">
                      These recordings failed to upload but are still saved locally.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 mt-3">
                  <Button
                    onClick={async () => {
                      try {
                        await retryFailedUploads();
                        toast({
                          title: "Retrying Failed Uploads",
                          description: "All failed recordings are being retried.",
                        });
                      } catch (error) {
                        toast({
                          title: "Retry Failed",
                          description: "Could not retry failed uploads. Please try again later.",
                          variant: "destructive",
                        });
                      }
                    }}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Retry All Failed
                  </Button>
                  <Button
                    onClick={async () => {
                      try {
                        const deletedCount = await deleteUnrecoverableFailedRecordings();
                        if (deletedCount > 0) {
                          // Refresh pending recordings
                          const updated = await getPendingRecordings();
                          setPendingRecordings(updated);
                          setShowPendingRecordings(false);
                          toast({
                            title: "Failed Recordings Deleted",
                            description: `Removed ${deletedCount} failed recordings.`,
                          });
                        } else {
                          toast({
                            title: "No Recordings to Delete",
                            description: "There are no failed recordings to delete.",
                          });
                        }
                      } catch (error) {
                        toast({
                          title: "Delete Failed",
                          description: "Could not delete failed recordings. Please try again later.",
                          variant: "destructive",
                        });
                      }
                    }}
                    size="sm"
                    variant="destructive"
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete All Failed
                  </Button>
                </div>
              </div>
            )}

            {queueStatus.unrecoverable > 0 && (
              <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">
                      Unrecoverable Recordings ({queueStatus.unrecoverable})
                    </h4>
                    <p className="text-sm text-gray-700">
                      These failed recordings have no audio data and cannot be recovered. Delete them to free up space.
                    </p>
                  </div>
                  <Button
                    onClick={async () => {
                      try {
                        const deletedCount = await deleteUnrecoverableFailedRecordings();
                        if (deletedCount > 0) {
                          // Refresh pending recordings
                          const updated = await getPendingRecordings();
                          setPendingRecordings(updated);
                          setShowPendingRecordings(false);
                        }
                      } catch (error) {
                        toast({
                          title: "Delete Failed",
                          description: "Could not delete failed recordings. Please try again later.",
                          variant: "destructive",
                        });
                      }
                    }}
                    size="sm"
                    variant="destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete All
                  </Button>
                </div>
              </div>
            )}

            {queueStatus.uploading > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-1">
                      Currently Uploading ({queueStatus.uploading})
                    </h4>
                    <p className="text-sm text-blue-700">
                      These recordings are being processed right now.
                    </p>
                  </div>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                </div>
              </div>
            )}

            {queueStatus.queued > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-yellow-900 mb-1">
                      Queued for Upload ({queueStatus.queued})
                    </h4>
                    <p className="text-sm text-yellow-700">
                      These recordings are waiting to be processed.
                    </p>
                  </div>
                  <Clock className="w-5 h-5 text-yellow-600" />
                </div>
              </div>
            )}

            {pendingRecordings.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-gray-900">Pending Local Recordings</h4>
                {pendingRecordings.map((recording) => (
                  <div key={recording.id} className="bg-gray-50 border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">
                          {recording.metadata?.title || 'Untitled Recording'}
                        </p>
                        <p className="text-sm text-gray-600">
                          {new Date(recording.timestamp).toLocaleString()} • 
                          {Math.round((recording.metadata?.size || 0) / 1024 / 1024 * 100) / 100} MB
                        </p>
                        <Badge variant={recording.status === 'failed' ? 'destructive' : 'secondary'}>
                          {recording.status}
                        </Badge>
                      </div>
                      <Button
                        onClick={async () => {
                          try {
                            await retryFailedUploads();
                            // Refresh pending recordings
                            const updated = await getPendingRecordings();
                            setPendingRecordings(updated);
                          } catch (error) {
                            console.error('Failed to process recording:', error);
                          }
                        }}
                        size="sm"
                        variant="outline"
                      >
                        Process
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {queueStatus.failed === 0 && queueStatus.uploading === 0 && queueStatus.queued === 0 && pendingRecordings.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                <Check className="w-12 h-12 text-green-600 mx-auto mb-2" />
                <p>All recordings are up to date!</p>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={() => setShowPendingRecordings(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}