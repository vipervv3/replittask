import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus,
  Clock,
  Users,
  Video,
  Mic,
  CheckSquare,
  MapPin,
  Edit3,
  Settings,
  RefreshCw,
  Target,
  Trash2,
  Repeat
} from "lucide-react";
import CalendarSyncOptions from "@/components/CalendarSyncOptions";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertMeetingSchema } from "@shared/schema";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import VoiceRecordingModal from "@/components/modals/VoiceRecordingModal";

interface Meeting {
  id: string;
  title: string;
  description?: string;
  scheduledAt: string;
  duration: number;
  projectId?: string;
}

interface Task {
  id: string;
  title: string;
  dueDate?: string;
  priority: string;
  status: string;
}

interface Project {
  id: string;
  name: string;
}

type MeetingFormData = z.infer<typeof insertMeetingSchema>;

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date()); // Start at today's date
  
  // Check if mobile screen
  const isMobile = () => window.innerWidth < 768;
  
  // Default to 3-day view on mobile, week view on desktop
  const [view, setView] = useState<"month" | "week" | "day" | "3-day">(isMobile() ? "3-day" : "week");
  
  // Handle screen size changes - auto switch to day view on mobile
  useEffect(() => {
    const handleResize = () => {
      const isCurrentlyMobile = isMobile();
      // Only auto-switch if user is switching between mobile/desktop sizes
      if (isCurrentlyMobile && view === "week") {
        setView("3-day");
      } else if (!isCurrentlyMobile && (view === "day" || view === "3-day")) {
        // Don't auto-switch back to week when going from mobile to desktop
        // Let user choose their preferred view on desktop
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [view]);
  
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isOutlookConnected, setIsOutlookConnected] = useState(false);
  const [isCalendarSetupOpen, setIsCalendarSetupOpen] = useState(false);
  const [isSyncOptionsOpen, setIsSyncOptionsOpen] = useState(false);
  const [calendarUrl, setCalendarUrl] = useState('');
  const [timeFormat, setTimeFormat] = useState<"12" | "24">("12"); // 12-hour or 24-hour format
  const [isEditMeetingModalOpen, setIsEditMeetingModalOpen] = useState(false);
  const [selectedMeetingForEdit, setSelectedMeetingForEdit] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Setup Outlook calendar via URL
  const setupOutlookMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/outlook/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          calendarUrl: calendarUrl.trim(),
          enabled: true 
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to configure calendar');
      }
      
      return response.json();
    },
    onSuccess: () => {
      setIsOutlookConnected(true);
      setIsCalendarSetupOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/outlook/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Calendar Connected",
        description: "Your Outlook calendar is now synced",
      });
    },
    onError: (error) => {
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Could not connect calendar",
        variant: "destructive",
      });
    },
  });

  // Disconnect calendar sync
  const disconnectCalendarMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/outlook/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          enabled: false 
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to disconnect calendar');
      }
      
      return response.json();
    },
    onSuccess: () => {
      setIsOutlookConnected(false);
      setCalendarUrl('');
      // AGGRESSIVELY clear ALL calendar-related cache
      queryClient.removeQueries({ queryKey: ["/api/outlook/events"] });
      queryClient.removeQueries({ queryKey: ["/api/dashboard/todays-meetings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      
      // Nuclear option: Clear ALL React Query cache to ensure no calendar data persists
      queryClient.clear();
      
      // Force settings and related data refetch to get updated state  
      queryClient.refetchQueries({ queryKey: ["/api/settings"] });
      queryClient.refetchQueries({ queryKey: ["/api/dashboard/todays-meetings"] });
      
      toast({
        title: "Calendar Disconnected",
        description: "External calendar sync has been disabled. Reloading page to clear all cached data...",
      });
      
    },
    onError: (error) => {
      toast({
        title: "Disconnect Failed", 
        description: error instanceof Error ? error.message : "Could not disconnect calendar",
        variant: "destructive",
      });
    },
  });

  // Test calendar URL
  const testCalendarMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/outlook/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarUrl: calendarUrl.trim() })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Test failed');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Calendar Test Successful",
        description: `Found ${data.eventCount} events. Calendar URL is valid.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Test Failed",
        description: error instanceof Error ? error.message : "Could not access calendar",
        variant: "destructive",
      });
    },
  });

  const connectOutlookMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/outlook/auth");
      const data = await response.json();
      return data.authUrl;
    },
    onSuccess: (authUrl) => {
      window.open(authUrl, '_blank', 'width=600,height=700');
      
      // Listen for the callback
      const checkConnection = setInterval(() => {
        if (window.location.search.includes('outlook=connected')) {
          setIsOutlookConnected(true);
          queryClient.invalidateQueries({ queryKey: ["/api/outlook/events"] });
          toast({
            title: "Success",
            description: "Outlook calendar connected successfully",
          });
          clearInterval(checkConnection);
        }
      }, 1000);
      
      // Stop checking after 2 minutes
      setTimeout(() => clearInterval(checkConnection), 120000);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to connect to Outlook",
        variant: "destructive",
      });
    },
  });

  const { data: meetings } = useQuery<Meeting[]>({
    queryKey: ["/api/meetings"],
  });

  const { data: tasks } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Check if user has Outlook configured on load
  const { data: userSettings } = useQuery<{
    outlookCalendarEnabled?: boolean;
    outlookCalendarUrl?: string;
    [key: string]: any;
  }>({
    queryKey: ["/api/settings"],
  });

  // Effect to update Outlook connection state when settings change
  useEffect(() => {
    if (userSettings?.outlookCalendarEnabled && userSettings?.outlookCalendarUrl) {
      setIsOutlookConnected(true);
      setCalendarUrl(userSettings.outlookCalendarUrl);
    } else {
      setIsOutlookConnected(false);
      setCalendarUrl('');
      // Aggressively clear all cached Outlook event data when disconnected
      queryClient.removeQueries({ queryKey: ["/api/outlook/events"] });
    }
  }, [userSettings]);

  const { data: outlookEvents, isLoading: outlookEventsLoading, refetch: refetchOutlookEvents } = useQuery<any[]>({
    queryKey: ["/api/outlook/events"],
    enabled: !!(isOutlookConnected && userSettings?.outlookCalendarEnabled), // Force boolean conversion
    staleTime: 15 * 60 * 1000, // Consider data fresh for 15 minutes (server cache is 30 min)
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    refetchOnMount: false, // Don't refetch when component mounts if data is still fresh
    retry: false, // Don't retry failed requests 
    retryOnMount: false, // Don't retry when component mounts
  });

  // Force full resync of Outlook events
  const forceOutlookSync = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/outlook/events?refresh=true');
      if (!response.ok) {
        throw new Error('Failed to sync calendar');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/outlook/events"] });
      toast({
        title: "Calendar Synced",
        description: "All Outlook events have been refreshed",
      });
    },
    onError: () => {
      toast({
        title: "Sync Failed", 
        description: "Could not refresh calendar events",
        variant: "destructive",
      });
    },
  });

  // Ensure outlookEvents is empty when sync is disabled
  const activeOutlookEvents = (isOutlookConnected && userSettings?.outlookCalendarEnabled) ? outlookEvents : [];



  // Auto-scroll to first event time in week view
  useEffect(() => {
    if (view === 'week' && activeOutlookEvents && activeOutlookEvents.length > 0) {
      const weekDays = getWeekDays(currentDate);
      const weekEvents = weekDays.flatMap(date => getEventsForDate(date));
      
      if (weekEvents.length > 0) {
        // Find the earliest event time
        const eventTimes = weekEvents
          .map(event => {
            if (event.time) {
              const [time, period] = event.time.split(' ');
              const [hour] = time.split(':');
              let hourNum = parseInt(hour);
              if (period === 'PM' && hourNum !== 12) hourNum += 12;
              if (period === 'AM' && hourNum === 12) hourNum = 0;
              return hourNum;
            }
            return null;
          })
          .filter(h => h !== null)
          .sort((a, b) => a - b);

        if (eventTimes.length > 0) {
          const earliestHour = eventTimes[0];
          // Scroll to 1 hour before the earliest event, or to the earliest event if it's before 1 AM
          const scrollToHour = Math.max(0, earliestHour - 1);
          
          setTimeout(() => {
            const timeSlot = document.getElementById(`time-slot-${scrollToHour}`);
            const grid = document.getElementById('calendar-time-grid');
            if (timeSlot && grid) {
              grid.scrollTop = timeSlot.offsetTop - 100;
            }
          }, 100);
        }
      }
    }
  }, [view, currentDate, activeOutlookEvents]);

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
        description: "Meeting scheduled successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to schedule meeting",
        variant: "destructive",
      });
    },
  });



  // Update meeting mutation
  const updateMeetingMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: MeetingFormData }) => {
      const response = await apiRequest("PUT", `/api/meetings/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      setIsEditMeetingModalOpen(false);
      setSelectedMeetingForEdit(null);
      // Clear selected event so modal refreshes with updated data
      setSelectedEvent(null);
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

  // Delete meeting mutation
  const deleteMeetingMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/meetings/${id}`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      setSelectedEvent(null);
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

  const form = useForm<MeetingFormData>({
    resolver: zodResolver(insertMeetingSchema.omit({ createdById: true })),
    defaultValues: {
      title: "",
      description: "",
      scheduledAt: (() => {
        const now = new Date();
        now.setHours(now.getHours() + 1); // Default to 1 hour from now
        now.setMinutes(0); // Round to the hour
        return now;
      })(),
      duration: 60,
      isRecurring: false,
      recurrenceType: undefined,
      recurrenceInterval: 1,
      recurrenceEndDate: undefined,
      recurrencePattern: undefined,
    },
  });

  const editForm = useForm<MeetingFormData>({
    resolver: zodResolver(insertMeetingSchema.omit({ createdById: true })),
    defaultValues: {
      title: "",
      description: "",
      scheduledAt: new Date(),
      duration: 60,
      isRecurring: false,
      recurrenceType: undefined,
      recurrenceInterval: 1,
      recurrenceEndDate: undefined,
      recurrencePattern: undefined,
    },
  });

  const onSubmit = (data: MeetingFormData) => {
    console.log('🚀 Form submission data:', data);
    console.log('📅 scheduledAt type:', typeof data.scheduledAt, data.scheduledAt);
    console.log('🔄 isRecurring:', data.isRecurring);
    console.log('📆 recurrenceEndDate:', data.recurrenceEndDate);
    
    // Ensure scheduledAt is a proper Date object
    const processedData = {
      ...data,
      scheduledAt: data.scheduledAt instanceof Date ? data.scheduledAt : new Date(data.scheduledAt),
      // Convert empty strings to undefined for optional fields
      recurrenceType: data.recurrenceType || undefined,
      recurrenceEndDate: data.recurrenceEndDate || undefined,
      recurrencePattern: data.recurrencePattern || undefined,
      projectId: data.projectId || undefined,
    };
    
    console.log('✨ Processed data:', processedData);
    createMeetingMutation.mutate(processedData);
  };

  const onEditSubmit = (data: MeetingFormData) => {
    if (!selectedMeetingForEdit) return;
    updateMeetingMutation.mutate({ id: selectedMeetingForEdit.id, updates: data });
  };

  const handleEditMeeting = (meeting: any) => {
    setSelectedMeetingForEdit(meeting);
    
    // Convert meeting scheduledAt to Date object for editing
    const meetingDate = new Date(meeting.scheduledAt);
    
    editForm.reset({
      title: meeting.title,
      description: meeting.description || "",
      scheduledAt: meetingDate,
      duration: meeting.duration,
      isRecurring: meeting.isRecurring || false,
      recurrenceType: meeting.recurrenceType || undefined,
      recurrenceInterval: meeting.recurrenceInterval || 1,
      recurrenceEndDate: meeting.recurrenceEndDate || undefined,
      recurrencePattern: meeting.recurrencePattern || undefined,
    });
    setIsEditMeetingModalOpen(true);
  };

  const handleDeleteMeeting = (meetingId: string) => {
    deleteMeetingMutation.mutate(meetingId);
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const getEventsForDate = (date: Date) => {
    // Create date string in local timezone to avoid UTC conversion issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const events: any[] = [];


    // Add meetings - FIXED: Handle string format directly to avoid timezone issues
    // Filter out voice recordings from calendar display
    meetings?.filter(meeting => {
      // Exclude voice recordings from calendar - they should only appear on Meetings page
      return !meeting.title?.includes('Voice Recording') && 
             !meeting.title?.includes('from Modal') &&
             !meeting.description?.includes('AI-processed');
    }).forEach(meeting => {
      try {
        // Safely handle scheduledAt - might be string or Date object
        let meetingDate;
        
        if (typeof meeting.scheduledAt === 'string') {
          if (meeting.scheduledAt.includes(' ')) {
            meetingDate = meeting.scheduledAt.split(' ')[0]; // "2025-08-25 09:00:00" → "2025-08-25"
          } else {
            meetingDate = meeting.scheduledAt.split('T')[0]; // "2025-08-25T09:00:00.000Z" → "2025-08-25"
          }
        } else if (meeting.scheduledAt && typeof meeting.scheduledAt === 'object') {
          const date = meeting.scheduledAt as Date;
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          meetingDate = `${year}-${month}-${day}`;
        } else {
          console.warn('Unknown scheduledAt format:', meeting.scheduledAt);
          return; // Skip this meeting
        }
        
        if (meetingDate === dateStr) {
        events.push({
          id: meeting.id,
          title: meeting.title,
          time: (() => {
            try {
              // Convert to Date object and use local timezone
              const date = new Date(meeting.scheduledAt);
              if (isNaN(date.getTime())) {
                return 'Invalid Time';
              }
              
              const hour = date.getHours(); // Gets hour in user's local timezone
              const minute = date.getMinutes();
              
              if (timeFormat === "12") {
                const period = hour >= 12 ? 'PM' : 'AM';
                const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
              } else {
                return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
              }
            } catch (error) {
              console.error('Error formatting meeting time:', error);
              return 'Time Error';
            }
          })(),
          type: 'meeting',
          duration: meeting.duration,
          description: meeting.description,
          scheduledAt: meeting.scheduledAt, // Preserve original scheduledAt for editing
          projectId: meeting.projectId, // Preserve projectId for editing
          source: 'internal'
        });
        }
      } catch (error) {
        console.error('Error processing meeting:', meeting.title, error);
      }
    });

    // Add Outlook events (only if sync is enabled)
    if (isOutlookConnected && userSettings?.outlookCalendarEnabled) {
      activeOutlookEvents?.forEach(event => {
      try {
        
        // FIXED: Parse date directly from ISO string to avoid timezone conversion
        const isoStart = event.start; // e.g., "2025-08-25T15:30:00.000Z"
        const datePart = isoStart.split('T')[0]; // Extract "2025-08-25"
        const eventDate = datePart;
        

        
        if (eventDate === dateStr) {
          events.push({
            id: `outlook-${event.id}`,
            title: event.title || 'Untitled Event',
            time: (() => {
              try {
                // FIXED: Server now properly converts Eastern to UTC, client displays in local timezone
                const eventDate = new Date(event.start); // This automatically converts UTC to local timezone
                const hour = eventDate.getHours(); // Gets hour in user's local timezone
                const minute = eventDate.getMinutes();
                
                if (timeFormat === "12") {
                  const period = hour >= 12 ? 'PM' : 'AM';
                  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
                  return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
                } else {
                  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                }
              } catch (error) {
                console.error('Error parsing Outlook event time:', error);
                return 'Time TBD';
              }
            })(),
            type: 'meeting', // Treat all Outlook events as meetings
            duration: event.end ? Math.round((new Date(event.end).getTime() - new Date(event.start).getTime()) / (1000 * 60)) : 60,
            location: event.location,
            description: event.description,
            source: 'outlook'
          });
        }
      } catch (error) {
        console.warn('Error processing Outlook event:', event, error);
      }
      });
    }

    // Add tasks with due dates
    tasks?.forEach(task => {
      if (task.dueDate) {
        const taskStart = new Date(task.dueDate);
        const taskYear = taskStart.getFullYear();
        const taskMonth = String(taskStart.getMonth() + 1).padStart(2, '0');
        const taskDay = String(taskStart.getDate()).padStart(2, '0');
        const taskDate = `${taskYear}-${taskMonth}-${taskDay}`;
        
        if (taskDate === dateStr) {
          events.push({
            id: task.id,
            title: task.title,
            type: 'task',
            priority: task.priority,
            status: task.status,
          });
        }
      }
    });





    return events.sort((a, b) => {
      if (a.time && b.time) {
        return a.time.localeCompare(b.time);
      }
      return a.type === 'meeting' ? -1 : 1;
    });
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setDate(prev.getDate() - 7);
      } else {
        newDate.setDate(prev.getDate() + 7);
      }
      return newDate;
    });
  };

  const getWeekDays = (date: Date) => {
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day;
    startOfWeek.setDate(diff);

    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      weekDays.push(day);
    }
    return weekDays;
  };

  const getNext3Days = (date: Date) => {
    const days = [];
    for (let i = 0; i < 3; i++) {
      const day = new Date(date);
      day.setDate(date.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const days = getDaysInMonth(currentDate);
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const todayEvents = getEventsForDate(new Date());
  // Combine both manually created meetings and Outlook events for upcoming meetings section
  const upcomingMeetings = (() => {
    const now = new Date();
    const allUpcomingMeetings = [];
    
    // Add manually created meetings (excluding voice recordings)
    const internalMeetings = meetings?.filter(meeting => {
      const meetingDate = new Date(meeting.scheduledAt);
      const isUpcoming = meetingDate > now;
      const isNotRecording = !meeting.title?.includes('Voice Recording') && 
                            !meeting.title?.includes('from Modal') &&
                            !meeting.description?.includes('AI-processed');
      return isUpcoming && isNotRecording;
    }).map(meeting => ({
      ...meeting,
      source: 'internal'
    })) || [];
    
    // Add Outlook events as meetings (only if sync is enabled)
    const outlookMeetings = (isOutlookConnected && userSettings?.outlookCalendarEnabled && activeOutlookEvents) 
      ? activeOutlookEvents.filter(event => {
          const eventDate = new Date(event.start);
          return eventDate > now;
        }).map(event => ({
          id: event.id,
          title: event.title,
          scheduledAt: event.start,
          duration: Math.round((new Date(event.end).getTime() - new Date(event.start).getTime()) / (1000 * 60)),
          source: 'outlook'
        }))
      : [];
    
    // Combine and sort by date
    allUpcomingMeetings.push(...internalMeetings, ...outlookMeetings);
    allUpcomingMeetings.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    
    return allUpcomingMeetings.slice(0, 3);
  })();

  return (
    <div className="p-3 sm:p-4 lg:p-8 pb-20 lg:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div className="flex items-center space-x-4 mb-4 sm:mb-0">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
            Calendar
          </h1>
          {isOutlookConnected && userSettings?.outlookCalendarEnabled && (
            <div className="flex items-center space-x-2 px-3 py-1 bg-purple-100 rounded-full">
              <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse"></div>
              <span className="text-xs text-purple-700 font-medium">Outlook Synced</span>
            </div>
          )}
          {isOutlookConnected && userSettings?.outlookCalendarEnabled && (
            <div className="flex items-center space-x-2">
              {outlookEventsLoading ? (
                <span className="text-xs text-gray-500 animate-pulse">Syncing...</span>
              ) : activeOutlookEvents && activeOutlookEvents.length > 0 ? (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">
                    ({activeOutlookEvents.length} Outlook events total)
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-6 px-2"
                    onClick={async () => {
                      toast({ 
                        title: "Refreshing Calendar", 
                        description: "Fetching latest events from Outlook..." 
                      });
                      
                      // Force refresh with server cache bypass
                      await refetchOutlookEvents();
                      
                      toast({ 
                        title: "Calendar Updated", 
                        description: "Latest events have been synced" 
                      });
                    }}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Refresh
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-6 px-2"
                    onClick={() => {
                      const today = new Date().toISOString().split('T')[0];
                      const todayEvents = activeOutlookEvents.filter(event => {
                        const eventDate = new Date(event.start).toISOString().split('T')[0];
                        return eventDate === today;
                      });
                      
                      const upcomingEvents = activeOutlookEvents.filter(event => {
                        const eventDate = new Date(event.start).toISOString().split('T')[0];
                        return eventDate >= today;
                      }).slice(0, 10);
                      
                      console.group('📅 Outlook Calendar Summary');
                      console.log(`📊 Total events: ${activeOutlookEvents.length}`);
                      console.log(`📅 Today (${today}): ${todayEvents.length} events`);
                      console.log('🔜 Next 10 upcoming:');
                      upcomingEvents.forEach(event => {
                        const eventDate = new Date(event.start).toISOString().split('T')[0];
                        const eventTime = new Date(event.start).toLocaleTimeString('en-US', { 
                          hour: 'numeric', 
                          minute: '2-digit', 
                          hour12: true
                        });
                        console.log(`   ${eventDate} ${eventTime} - ${event.title}`);
                      });
                      console.groupEnd();
                      
                      toast({ 
                        title: "Calendar Summary", 
                        description: `Total: ${activeOutlookEvents.length} events. Today: ${todayEvents.length}. Check console for details.` 
                      });
                    }}
                  >
                    View Summary
                  </Button>
                </div>
              ) : (
                <span className="text-xs text-gray-500">Connected</span>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Time Format Toggle */}
          <div className="flex items-center border rounded-lg">
            <Button
              variant={timeFormat === "12" ? "default" : "ghost"}
              size="sm"
              onClick={() => setTimeFormat("12")}
              className="rounded-r-none text-xs"
            >
              12h
            </Button>
            <Button
              variant={timeFormat === "24" ? "default" : "ghost"}
              size="sm"
              onClick={() => setTimeFormat("24")}
              className="rounded-l-none text-xs"
            >
              24h
            </Button>
          </div>
          
          <div className="flex items-center border rounded-lg">
            <Button
              variant={view === "month" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("month")}
              className="rounded-r-none hidden sm:flex"
            >
              Month
            </Button>
            <Button
              variant={view === "week" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("week")}
              className={`${window.innerWidth < 768 ? 'rounded-none' : 'rounded-l-none'} hidden sm:flex`}
            >
              Week
            </Button>
            <Button
              variant={view === "3-day" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("3-day")}
              className="rounded-none sm:hidden"
            >
              3-Day
            </Button>
            <Button
              variant={view === "day" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("day")}
              className="rounded-l-none sm:hidden"
            >
              Day
            </Button>
          </div>
          
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90">
                <Plus className="w-4 h-4 mr-2" />
                New Event
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

                  {/* Recurring Meeting Fields */}
                  <FormField
                    control={form.control}
                    name="isRecurring"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="flex items-center gap-2">
                            <Repeat className="w-4 h-4" />
                            Make this a recurring meeting
                          </FormLabel>
                        </div>
                      </FormItem>
                    )}
                  />

                  {form.watch("isRecurring") && (
                    <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="recurrenceType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Repeat</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value || ""}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select frequency" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="daily">Daily</SelectItem>
                                  <SelectItem value="weekly">Weekly</SelectItem>
                                  <SelectItem value="monthly">Monthly</SelectItem>
                                  <SelectItem value="yearly">Yearly</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="recurrenceInterval"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Every</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="1"
                                  max="99"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="recurrenceEndDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>End Date (Optional)</FormLabel>
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

                      {form.watch("recurrenceType") === "weekly" && (
                        <FormField
                          control={form.control}
                          name="recurrencePattern"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Repeat on</FormLabel>
                              <div className="flex space-x-2">
                                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => (
                                  <Button
                                    key={day}
                                    type="button"
                                    variant={field.value?.includes(index.toString()) ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => {
                                      const currentPattern = field.value || "";
                                      const dayStr = index.toString();
                                      if (currentPattern.includes(dayStr)) {
                                        field.onChange(currentPattern.replace(dayStr, ""));
                                      } else {
                                        field.onChange(currentPattern + dayStr);
                                      }
                                    }}
                                  >
                                    {day}
                                  </Button>
                                ))}
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="scheduledAt"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date & Time</FormLabel>
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
                          <FormLabel>Duration (min)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="15"
                              max="120"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

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
                      disabled={createMeetingMutation.isPending}
                      className="flex-1"
                    >
                      {createMeetingMutation.isPending ? "Creating..." : "Schedule Meeting"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-4 lg:gap-8">
        {/* Calendar */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="pb-4 space-y-3">
              <div className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg sm:text-xl font-semibold truncate mr-2">
                  {view === "month" ? monthName : 
                   view === "day" ? currentDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) :
                   view === "3-day" ? `${currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - Next 3 Days` :
                   `Week ${currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                </CardTitle>
                <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (view === "month") {
                        navigateMonth('prev');
                      } else if (view === "day") {
                        const prevDay = new Date(currentDate);
                        prevDay.setDate(prevDay.getDate() - 1);
                        setCurrentDate(prevDay);
                      } else if (view === "3-day") {
                        const prevThreeDays = new Date(currentDate);
                        prevThreeDays.setDate(prevThreeDays.getDate() - 3);
                        setCurrentDate(prevThreeDays);
                      } else {
                        navigateWeek('prev');
                      }
                    }}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentDate(new Date())}
                    className="text-xs px-2 h-8"
                  >
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (view === "month") {
                        navigateMonth('next');
                      } else if (view === "day") {
                        const nextDay = new Date(currentDate);
                        nextDay.setDate(nextDay.getDate() + 1);
                        setCurrentDate(nextDay);
                      } else if (view === "3-day") {
                        const nextThreeDays = new Date(currentDate);
                        nextThreeDays.setDate(nextThreeDays.getDate() + 3);
                        setCurrentDate(nextThreeDays);
                      } else {
                        navigateWeek('next');
                      }
                    }}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              {/* Quick date shortcuts - hidden on mobile */}
              <div className="hidden sm:flex items-center space-x-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentDate(new Date(2025, 7, 20))}
                  className="text-xs"
                >
                  Aug 20
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentDate(new Date(2025, 7, 25))}
                  className="text-xs"
                >
                  Aug 25
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentDate(new Date(2025, 7, 28))}
                  className="text-xs"
                >
                  Aug 28
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentDate(new Date(2025, 8, 8))}
                  className="text-xs"
                >
                  Sep 8
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {view === "month" ? (
                <>
                  {/* Weekday headers */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {weekdays.map(day => (
                      <div key={day} className="p-1 sm:p-2 text-center text-xs sm:text-sm font-medium text-gray-500">
                        <span className="sm:hidden">{day.slice(0, 1)}</span>
                        <span className="hidden sm:inline">{day}</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Calendar grid - responsive height and padding */}
                  <div className="grid grid-cols-7 gap-1">
                    {days.map((date, index) => {
                      if (!date) {
                        return <div key={index} className="p-1 sm:p-2 h-16 sm:h-24" />;
                      }
                      
                      const events = getEventsForDate(date);
                      const isCurrentDay = isToday(date);
                      
                      return (
                        <div
                          key={date.toISOString()}
                          className={`p-1 sm:p-2 h-16 sm:h-24 border border-gray-100 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer ${
                            isCurrentDay ? 'bg-blue-50 border-blue-200' : ''
                          }`}
                          onClick={() => events.length > 0 && setSelectedEvent({ date, events })}
                        >
                          <div className={`text-xs sm:text-sm font-medium mb-1 ${
                            isCurrentDay ? 'text-blue-600' : 'text-gray-900'
                          }`}>
                            {date.getDate()}
                          </div>
                          
                          <div className="space-y-1">
                            {events.slice(0, 1).map((event, idx) => (
                              <div
                                key={`${event.id}-${idx}`}
                                className={`text-xs p-1 rounded text-white truncate hover:opacity-80 sm:block ${
                                  event.type === 'meeting' ? 'bg-blue-500' : 
                                  event.priority === 'urgent' ? 'bg-red-500' :
                                  event.priority === 'high' ? 'bg-orange-500' :
                                  'bg-green-500'
                                }`}
                                title={`${event.time || ''} ${event.title}`}
                              >
                                <span className="hidden sm:inline">{event.time && `${event.time} `}</span>{event.title}
                              </div>
                            ))}
                            {events.length > 1 && (
                              <div className="text-xs text-gray-500">
                                +{events.length - 1} more
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : view === "day" ? (
                /* Day View */
                <>
                  <div className="grid grid-cols-2 gap-1 mb-2">
                    <div className="p-1 sm:p-2"></div>
                    <div className="p-1 sm:p-2 text-center">
                      <div className="text-xs text-gray-500 uppercase">
                        {currentDate.toLocaleDateString('en-US', { weekday: 'short' })}
                      </div>
                      <div className={`text-lg sm:text-xl font-bold ${
                        isToday(currentDate) ? 'text-blue-600' : 'text-gray-900'
                      }`}>
                        {currentDate.getDate()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-1 h-[500px] sm:h-[600px] overflow-y-auto" id="calendar-time-grid">
                    <div className="space-y-0 pt-0 pr-2">
                      {Array.from({ length: 24 }, (_, i) => (
                        <div key={i} className="text-xs text-gray-500 h-10 sm:h-12 flex items-center border-t border-gray-100" id={`time-slot-${i}`}>
                          <span className="text-xs sm:text-sm">
                            {timeFormat === "12" ? 
                              (i === 0 ? '12 AM' : i === 12 ? '12 PM' : i < 12 ? `${i} AM` : `${i - 12} PM`) :
                              `${i.toString().padStart(2, '0')}:00`
                            }
                          </span>
                        </div>
                      ))}
                    </div>
                    
                    <div className="border border-gray-100 relative min-h-full">
                      {getEventsForDate(currentDate).map((event, idx) => {
                        // Calculate position based on event time - mobile responsive
                        let topPosition = 0;
                        const hourHeight = window.innerWidth < 768 ? 40 : 48; // 40px on mobile, 48px on desktop
                        
                        if (event.time) {
                          const [time, period] = event.time.split(' ');
                          const [hour, minute] = time.split(':');
                          let hourNum = parseInt(hour);
                          const minuteNum = parseInt(minute) || 0;
                          
                          if (period === 'PM' && hourNum !== 12) hourNum += 12;
                          if (period === 'AM' && hourNum === 12) hourNum = 0;
                          
                          // Mobile-responsive hour positioning - FIXED: Account for time grid starting position
                          topPosition = (hourNum * hourHeight) + (minuteNum * hourHeight / 60);
                        }
                        
                        return (
                          <div
                            key={`${event.id}-${idx}`}
                            className={`absolute left-1 right-1 text-xs p-1 sm:p-2 rounded text-white cursor-pointer hover:opacity-80 z-10 ${
                              event.type === 'meeting' ? 'bg-blue-500' : 
                              event.priority === 'urgent' ? 'bg-red-500' :
                              event.priority === 'high' ? 'bg-orange-500' :
                              'bg-green-500'
                            }`}
                            style={{ top: `${topPosition}px`, minHeight: '28px' }}
                            title={`${event.time} - ${event.title}`}
                            onClick={() => setSelectedEvent({ date: currentDate, events: [event] })}
                          >
                            <div className="font-medium truncate text-xs sm:text-sm">{event.title}</div>
                            {event.time && <div className="opacity-75 text-xs hidden sm:block">{event.time}</div>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : view === "3-day" ? (
                /* 3-Day View */
                <>
                  <div className="grid grid-cols-4 gap-1 mb-2">
                    <div className="p-2"></div>
                    {getNext3Days(currentDate).map((date, index) => (
                      <div key={index} className="p-2 text-center">
                        <div className="text-xs text-gray-500 uppercase">
                          {date.toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                        <div className={`text-lg font-bold ${
                          isToday(date) ? 'text-blue-600' : 'text-gray-900'
                        }`}>
                          {date.getDate()}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="grid grid-cols-4 gap-1 h-[500px] overflow-y-auto" id="calendar-time-grid">
                    <div className="space-y-0 pt-0">
                      {Array.from({ length: 24 }, (_, i) => (
                        <div key={i} className="text-xs text-gray-500 h-10 flex items-center border-t border-gray-100" id={`time-slot-${i}`}>
                          {timeFormat === "12" ? 
                            (i === 0 ? '12 AM' : i === 12 ? '12 PM' : i < 12 ? `${i} AM` : `${i - 12} PM`) :
                            `${i.toString().padStart(2, '0')}:00`
                          }
                        </div>
                      ))}
                    </div>
                    
                    {getNext3Days(currentDate).map((date, index) => {
                      const events = getEventsForDate(date);
                      return (
                        <div key={index} className="border border-gray-100 relative min-h-full">
                          {events.map((event, idx) => {
                            // Calculate position based on event time
                            let topPosition = 0;
                            const hourHeight = 40; // 40px per hour for 3-day view
                            
                            if (event.time) {
                              const [time, period] = event.time.split(' ');
                              const [hour, minute] = time.split(':');
                              let hourNum = parseInt(hour);
                              const minuteNum = parseInt(minute) || 0;
                              
                              if (period === 'PM' && hourNum !== 12) hourNum += 12;
                              if (period === 'AM' && hourNum === 12) hourNum = 0;
                              
                              topPosition = (hourNum * hourHeight) + (minuteNum * hourHeight / 60);
                            }
                            
                            return (
                              <div
                                key={`${event.id}-${idx}`}
                                className={`absolute left-1 right-1 text-xs p-1 rounded text-white cursor-pointer hover:opacity-80 z-10 ${
                                  event.type === 'meeting' ? 'bg-blue-500' : 
                                  event.priority === 'urgent' ? 'bg-red-500' :
                                  event.priority === 'high' ? 'bg-orange-500' :
                                  'bg-green-500'
                                }`}
                                style={{ top: `${topPosition}px`, minHeight: '20px' }}
                                title={`${event.time} - ${event.title}`}
                                onClick={() => setSelectedEvent({ date, events: [event] })}
                              >
                                <div className="font-medium truncate text-xs">{event.title}</div>
                                {event.time && <div className="opacity-75 text-xs">{event.time}</div>}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                /* Week View */
                <>
                  <div className="grid grid-cols-8 gap-1 mb-2">
                    <div className="p-2"></div>
                    {getWeekDays(currentDate).map((date, index) => (
                      <div key={index} className="p-2 text-center">
                        <div className="text-xs text-gray-500 uppercase">
                          {date.toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                        <div className={`text-lg font-bold ${
                          isToday(date) ? 'text-blue-600' : 'text-gray-900'
                        }`}>
                          {date.getDate()}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="grid grid-cols-8 gap-1 h-[600px] overflow-y-auto" id="calendar-time-grid">
                    <div className="space-y-0 pt-0">
                      {Array.from({ length: 24 }, (_, i) => (
                        <div key={i} className="text-xs text-gray-500 h-12 flex items-center border-t border-gray-100" id={`time-slot-${i}`}>
                          {timeFormat === "12" ? 
                            (i === 0 ? '12:00 AM' : i === 12 ? '12:00 PM' : i < 12 ? `${i}:00 AM` : `${i - 12}:00 PM`) :
                            `${i.toString().padStart(2, '0')}:00`
                          }
                        </div>
                      ))}
                    </div>
                    
                    {getWeekDays(currentDate).map((date, index) => {
                      const events = getEventsForDate(date);
                      return (
                        <div key={index} className="border border-gray-100 relative min-h-full">
                          {events.map((event, idx) => {
                            // Calculate position based on event time
                            let topPosition = 0;
                            if (event.time) {
                              const [time, period] = event.time.split(' ');
                              const [hour, minute] = time.split(':');
                              let hourNum = parseInt(hour);
                              const minuteNum = parseInt(minute) || 0;
                              
                              if (period === 'PM' && hourNum !== 12) hourNum += 12;
                              if (period === 'AM' && hourNum === 12) hourNum = 0;
                              
                              // Each hour slot is 48px (h-12), position event accordingly  
                              topPosition = (hourNum * 48) + (minuteNum * 48 / 60);
                            }
                            
                            return (
                              <div
                                key={`${event.id}-${idx}`}
                                className={`absolute left-1 right-1 text-xs p-2 rounded text-white cursor-pointer hover:opacity-80 z-10 ${
                                  event.type === 'meeting' ? 'bg-blue-500' : 
                                  event.priority === 'urgent' ? 'bg-red-500' :
                                  event.priority === 'high' ? 'bg-orange-500' :
                                  'bg-green-500'
                                }`}
                                style={{ top: `${topPosition}px`, minHeight: '32px' }}
                                title={`${event.time} - ${event.title}`}
                                onClick={() => setSelectedEvent({ date, events: [event] })}
                              >
                                <div className="font-medium truncate">{event.title}</div>
                                {event.time && <div className="opacity-75 text-xs">{event.time}</div>}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Today's Schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Today's Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              {todayEvents.length > 0 ? (
                <div className="space-y-3">
                  {todayEvents.map((event, index) => (
                    <div key={`${event.id}-${index}`} className="flex items-start space-x-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        event.type === 'meeting' ? 'bg-blue-100' : 'bg-green-100'
                      }`}>
                        {event.type === 'meeting' ? (
                          <Video className={`w-4 h-4 ${
                            event.type === 'meeting' ? 'text-blue-600' : 'text-green-600'
                          }`} />
                        ) : (
                          <CheckSquare className="w-4 h-4 text-green-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <p className="text-sm font-medium text-gray-900">{event.title}</p>
                          {event.source === 'outlook' && (
                            <Badge className="bg-purple-100 text-purple-800 text-xs" variant="secondary">
                              Outlook
                            </Badge>
                          )}
                        </div>
                        {event.time && (
                          <p className="text-xs text-gray-500">{event.time}</p>
                        )}
                        {event.priority && (
                          <Badge 
                            className={`mt-1 ${
                              event.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                              event.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}
                            variant="secondary"
                          >
                            {event.priority}
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <CalendarIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No events today</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Meetings */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Upcoming Meetings</CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingMeetings.length > 0 ? (
                <div className="space-y-4">
                  {upcomingMeetings.map((meeting) => (
                    <div key={meeting.id} className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-medium text-gray-900">{meeting.title}</h4>
                          {meeting.source === 'outlook' && (
                            <Badge className="bg-purple-100 text-purple-800 text-xs" variant="secondary">
                              Outlook
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center space-x-1">
                          <Mic className="w-4 h-4 text-blue-600" />
                        </div>
                      </div>
                      <div className="space-y-1 text-xs text-gray-600">
                        <div className="flex items-center">
                          <CalendarIcon className="w-3 h-3 mr-1" />
                          {(() => {
                            try {
                              if (!meeting.scheduledAt) return 'Date TBD';
                              return new Date(meeting.scheduledAt).toLocaleDateString();
                            } catch (error) {
                              return 'Invalid Date';
                            }
                          })()}
                        </div>
                        <div className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {(() => {
                            try {
                              if (!meeting.scheduledAt) return 'Time TBD';
                              
                              const date = new Date(meeting.scheduledAt);
                              if (isNaN(date.getTime())) {
                                return 'Invalid time';
                              }
                              
                              // Format time consistently based on user preference
                              const options: Intl.DateTimeFormatOptions = timeFormat === "12" 
                                ? { hour: 'numeric', minute: '2-digit', hour12: true }
                                : { hour: '2-digit', minute: '2-digit', hour12: false };
                              
                              return date.toLocaleTimeString([], options);
                            } catch (error) {
                              console.error('Error formatting time:', error);
                              return 'Time Error';
                            }
                          })()} ({meeting.duration} min)
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4">
                  <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No upcoming meetings</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => setIsCreateModalOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Schedule Meeting
              </Button>
              {isOutlookConnected && (
                <Button 
                  className="w-full justify-start" 
                  variant="outline"
                  onClick={() => forceOutlookSync.mutate()}
                  disabled={forceOutlookSync.isPending}
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${forceOutlookSync.isPending ? 'animate-spin' : ''}`} />
                  {forceOutlookSync.isPending ? 'Syncing...' : 'Sync Outlook Calendar'}
                </Button>
              )}
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => setIsCreateModalOpen(true)}
              >
                <CalendarIcon className="w-4 h-4 mr-2" />
                Add Event
              </Button>
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => setIsVoiceModalOpen(true)}
              >
                <Mic className="w-4 h-4 mr-2" />
                Start Recording
              </Button>
              {!isOutlookConnected ? (
                <Button 
                  className="w-full justify-start bg-purple-600 hover:bg-purple-700 text-white" 
                  onClick={() => setIsSyncOptionsOpen(true)}
                >
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  Connect Your Calendar
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mr-3">
                      <CalendarIcon className="w-4 h-4 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-purple-900">Outlook Connected</p>
                      <p className="text-xs text-purple-700">
                        {outlookEventsLoading ? 'Syncing...' : 
                         (activeOutlookEvents && isOutlookConnected && userSettings?.outlookCalendarEnabled) ? `${activeOutlookEvents.length} events synced` : 
                         'Ready to sync'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        queryClient.invalidateQueries({ queryKey: ["/api/outlook/events"] });
                        toast({ title: "Refreshed", description: "Calendar events updated" });
                      }}
                      className="flex-1"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Refresh
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => disconnectCalendarMutation.mutate()}
                      disabled={disconnectCalendarMutation.isPending}
                      className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                    >
                      <CalendarIcon className="w-3 h-3 mr-1" />
                      {disconnectCalendarMutation.isPending ? "..." : "Disconnect"}
                    </Button>
                  </div>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsSyncOptionsOpen(true)}
                    className="w-full"
                  >
                    <Settings className="w-3 h-3 mr-1" />
                    Calendar Settings
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Voice Recording Modal */}
      <VoiceRecordingModal 
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
      />

      {/* Event Details Modal */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Events for {selectedEvent?.date.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </DialogTitle>
          </DialogHeader>
          
          {selectedEvent && (
            <div className="space-y-4">
              {selectedEvent.events.map((event: any, index: number) => (
                <div key={`${event.id}-${index}`} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        event.type === 'meeting' ? 'bg-blue-100' : 'bg-green-100'
                      }`}>
                        {event.type === 'meeting' ? (
                          <Video className={`w-4 h-4 ${
                            event.type === 'meeting' ? 'text-blue-600' : 'text-green-600'
                          }`} />
                        ) : (
                          <CheckSquare className="w-4 h-4 text-green-600" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{event.title}</h3>
                        {event.time && (
                          <p className="text-sm text-gray-500">{event.time}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      {event.type === 'meeting' && event.source === 'internal' && (
                        <>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleEditMeeting(event)}
                            data-testid={`button-edit-meeting-${event.id}`}
                          >
                            <Edit3 className="w-3 h-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                data-testid={`button-delete-meeting-${event.id}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Meeting</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{event.title}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteMeeting(event.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                  disabled={deleteMeetingMutation.isPending}
                                >
                                  {deleteMeetingMutation.isPending ? "Deleting..." : "Delete"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </div>
                  
                  {event.duration && (
                    <div className="flex items-center text-sm text-gray-600 mb-2">
                      <Clock className="w-4 h-4 mr-1" />
                      {event.duration} minutes
                    </div>
                  )}
                  
                  {event.description && (
                    <div className="text-sm text-gray-700 mb-2 p-2 bg-gray-50 rounded">
                      {event.description}
                    </div>
                  )}
                  
                  {event.source === 'outlook' && (
                    <Badge className="bg-purple-100 text-purple-800 mb-2" variant="secondary">
                      <CalendarIcon className="w-3 h-3 mr-1" />
                      Outlook Event
                    </Badge>
                  )}
                  
                  {event.priority && (
                    <Badge 
                      className={`${
                        event.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                        event.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}
                      variant="secondary"
                    >
                      {event.priority} priority
                    </Badge>
                  )}
                  
                  {event.status && (
                    <Badge 
                      className={`ml-2 ${
                        event.status === 'completed' ? 'bg-green-100 text-green-800' :
                        event.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}
                      variant="secondary"
                    >
                      {event.status.replace('_', ' ')}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Voice Recording Modal */}
      <VoiceRecordingModal 
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
      />

      {/* Outlook Calendar Setup Modal */}
      <Dialog open={isCalendarSetupOpen} onOpenChange={setIsCalendarSetupOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect Outlook Calendar</DialogTitle>
            <DialogDescription>
              Enter your Outlook calendar sharing URL to sync events
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="calendar-url">Calendar Sharing URL</Label>
              <Input
                id="calendar-url"
                value={calendarUrl}
                onChange={(e) => setCalendarUrl(e.target.value)}
                placeholder="https://outlook.office365.com/.../calendar.ics"
                className="w-full"
              />
              <p className="text-xs text-gray-500">
                Get this URL from your Outlook calendar sharing settings
              </p>
            </div>

            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <h4 className="text-sm font-medium text-blue-900 mb-2">How to get your ICS sharing URL:</h4>
              <ol className="text-xs text-blue-800 space-y-1">
                <li>1. Open Outlook.com and go to Calendar</li>
                <li>2. Right-click on your calendar name</li>
                <li>3. Select "Sharing and permissions"</li>
                <li>4. Choose "Can view when I'm busy" or "Can view titles and locations"</li>
                <li>5. Copy the <strong>ICS link</strong> (not HTML link)</li>
                <li>6. Make sure URL ends with <code>.ics</code> not <code>.html</code></li>
              </ol>
            </div>

            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
              <h4 className="text-sm font-medium text-amber-900 mb-2">Quick Fix:</h4>
              <p className="text-xs text-amber-800">
                If your URL ends with <code>.html</code>, simply change it to <code>.ics</code> 
                <br />
                Example: <code>calendar.html</code> → <code>calendar.ics</code>
              </p>
            </div>

            <div className="flex space-x-2">
              <Button
                onClick={() => testCalendarMutation.mutate()}
                disabled={!calendarUrl.trim() || testCalendarMutation.isPending}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                {testCalendarMutation.isPending ? "Testing..." : "Test URL"}
              </Button>
              <Button
                onClick={() => setupOutlookMutation.mutate()}
                disabled={!calendarUrl.trim() || setupOutlookMutation.isPending}
                size="sm"
                className="flex-1"
              >
                {setupOutlookMutation.isPending ? "Connecting..." : "Connect"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Calendar Sync Options Modal */}
      <CalendarSyncOptions
        isOpen={isSyncOptionsOpen}
        onClose={() => setIsSyncOptionsOpen(false)}
        onConnected={() => {
          setIsOutlookConnected(true);
          queryClient.invalidateQueries({ queryKey: ["/api/outlook/events"] });
          toast({
            title: "Success",
            description: "Calendar connected successfully",
          });
          setIsSyncOptionsOpen(false);
        }}
      />

      {/* Create Meeting Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Schedule Meeting</DialogTitle>
            <DialogDescription>
              Create a new meeting or event
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Meeting title" {...field} />
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
                      <Textarea placeholder="Meeting description" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="scheduledAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date & Time</FormLabel>
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
                          console.log('📅 Date input changed:', e.target.value);
                          if (e.target.value) {
                            // Parse the datetime-local value correctly without timezone shift
                            const [datePart, timePart] = e.target.value.split('T');
                            const [year, month, day] = datePart.split('-').map(Number);
                            const [hour, minute] = timePart.split(':').map(Number);
                            
                            // Create date using local timezone values
                            const localDate = new Date(year, month - 1, day, hour, minute);
                            console.log('🕒 Converted to Date:', localDate);
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
                        placeholder="60" 
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {projects && projects.length > 0 && (
                <FormField
                  control={form.control}
                  name="projectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a project" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {projects.map((project) => (
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
              )}

              {/* Recurring Meeting Fields */}
              <FormField
                control={form.control}
                name="isRecurring"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="flex items-center gap-2">
                        <Repeat className="w-4 h-4" />
                        Make this a recurring meeting
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              {form.watch("isRecurring") && (
                <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="recurrenceType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Repeat</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select frequency" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="yearly">Yearly</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="recurrenceInterval"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Every</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="99"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="recurrenceEndDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date (Optional)</FormLabel>
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

                  {form.watch("recurrenceType") === "weekly" && (
                    <FormField
                      control={form.control}
                      name="recurrencePattern"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Repeat on</FormLabel>
                          <div className="flex space-x-2">
                            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => (
                              <Button
                                key={day}
                                type="button"
                                variant={field.value?.includes(index.toString()) ? "default" : "outline"}
                                size="sm"
                                onClick={() => {
                                  const currentPattern = field.value || "";
                                  const dayStr = index.toString();
                                  if (currentPattern.includes(dayStr)) {
                                    field.onChange(currentPattern.replace(dayStr, ""));
                                  } else {
                                    field.onChange(currentPattern + dayStr);
                                  }
                                }}
                              >
                                {day}
                              </Button>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              )}
              
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMeetingMutation.isPending}
                >
                  {createMeetingMutation.isPending ? "Creating..." : "Create Meeting"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Meeting Modal */}
      <Dialog open={isEditMeetingModalOpen} onOpenChange={setIsEditMeetingModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Meeting</DialogTitle>
            <DialogDescription>
              Update meeting details
            </DialogDescription>
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
                      <Input placeholder="Meeting title" {...field} />
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
                      <Textarea placeholder="Meeting description" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="scheduledAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date & Time</FormLabel>
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
                control={editForm.control}
                name="duration"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (minutes)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="60" 
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {projects && projects.length > 0 && (
                <FormField
                  control={editForm.control}
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
                          {projects.map((project) => (
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
              )}

              {/* Recurring Meeting Fields */}
              <FormField
                control={editForm.control}
                name="isRecurring"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="flex items-center gap-2">
                        <Repeat className="w-4 h-4" />
                        Make this a recurring meeting
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />

              {editForm.watch("isRecurring") && (
                <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={editForm.control}
                      name="recurrenceType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Repeat</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select frequency" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="yearly">Yearly</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={editForm.control}
                      name="recurrenceInterval"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Every</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="1"
                              max="99"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={editForm.control}
                    name="recurrenceEndDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date (Optional)</FormLabel>
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

                  {editForm.watch("recurrenceType") === "weekly" && (
                    <FormField
                      control={editForm.control}
                      name="recurrencePattern"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Repeat on</FormLabel>
                          <div className="flex space-x-2">
                            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => (
                              <Button
                                key={day}
                                type="button"
                                variant={field.value?.includes(index.toString()) ? "default" : "outline"}
                                size="sm"
                                onClick={() => {
                                  const currentPattern = field.value || "";
                                  const dayIndex = index.toString();
                                  
                                  if (currentPattern.includes(dayIndex)) {
                                    field.onChange(currentPattern.replace(dayIndex, ""));
                                  } else {
                                    field.onChange(currentPattern + dayIndex);
                                  }
                                }}
                              >
                                {day}
                              </Button>
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              )}
              
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditMeetingModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={updateMeetingMutation.isPending}
                >
                  {updateMeetingMutation.isPending ? "Updating..." : "Update Meeting"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
