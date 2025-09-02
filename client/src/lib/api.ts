import { queryClient } from "./queryClient";

// Re-export the apiRequest function for convenience
export { apiRequest } from "./queryClient";

// API endpoint helpers
export const API_ENDPOINTS = {
  // Dashboard
  DASHBOARD_STATS: "/api/dashboard/stats",
  
  // Projects
  PROJECTS: "/api/projects",
  PROJECT: (id: string) => `/api/projects/${id}`,
  
  // Tasks
  TASKS: "/api/tasks",
  TASK: (id: string) => `/api/tasks/${id}`,
  
  // Meetings
  MEETINGS: "/api/meetings",
  MEETING: (id: string) => `/api/meetings/${id}`,
  PROCESS_RECORDING: (meetingId: string) => `/api/meetings/${meetingId}/process-recording`,
  
  // AI
  PROJECT_INSIGHTS: (projectId: string) => `/api/ai/project-insights/${projectId}`,
  
  // Notifications
  NOTIFICATIONS: "/api/notifications",
  MARK_NOTIFICATION_READ: (id: string) => `/api/notifications/${id}/read`,
  
  // Settings
  SETTINGS: "/api/settings",
  TEST_EMAIL: "/api/settings/test-email",
  
  // Project Members
  PROJECT_MEMBERS: "/api/project-members",
} as const;

// Query key factories for consistent cache management
export const QueryKeys = {
  // Dashboard
  dashboardStats: () => [API_ENDPOINTS.DASHBOARD_STATS],
  
  // Projects
  projects: () => [API_ENDPOINTS.PROJECTS],
  project: (id: string) => [API_ENDPOINTS.PROJECT(id)],
  
  // Tasks
  tasks: (filters?: { projectId?: string; userId?: string }) => {
    const key = [API_ENDPOINTS.TASKS] as (string | undefined)[];
    if (filters?.projectId) key.push(filters.projectId);
    if (filters?.userId) key.push(filters.userId);
    return key;
  },
  task: (id: string) => [API_ENDPOINTS.TASK(id)],
  
  // Meetings
  meetings: (filters?: { projectId?: string }) => {
    const key = [API_ENDPOINTS.MEETINGS] as (string | undefined)[];
    if (filters?.projectId) key.push(filters.projectId);
    return key;
  },
  meeting: (id: string) => [API_ENDPOINTS.MEETING(id)],
  
  // AI
  projectInsights: (projectId: string) => [API_ENDPOINTS.PROJECT_INSIGHTS(projectId)],
  
  // Notifications
  notifications: () => [API_ENDPOINTS.NOTIFICATIONS],
  
  // Settings
  settings: () => [API_ENDPOINTS.SETTINGS],
  
  // Project Members
  projectMembers: (projectId?: string) => {
    const key = [API_ENDPOINTS.PROJECT_MEMBERS] as (string | undefined)[];
    if (projectId) key.push(projectId);
    return key;
  },
} as const;

// Cache invalidation helpers
export const invalidateQueries = {
  // Dashboard
  dashboardStats: () => queryClient.invalidateQueries({ queryKey: QueryKeys.dashboardStats() }),
  
  // Projects
  projects: () => queryClient.invalidateQueries({ queryKey: QueryKeys.projects() }),
  project: (id: string) => queryClient.invalidateQueries({ queryKey: QueryKeys.project(id) }),
  allProjects: () => queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.PROJECTS] }),
  
  // Tasks
  tasks: () => queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.TASKS] }),
  task: (id: string) => queryClient.invalidateQueries({ queryKey: QueryKeys.task(id) }),
  
  // Meetings
  meetings: () => queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.MEETINGS] }),
  meeting: (id: string) => queryClient.invalidateQueries({ queryKey: QueryKeys.meeting(id) }),
  
  // AI
  projectInsights: (projectId: string) => queryClient.invalidateQueries({ queryKey: QueryKeys.projectInsights(projectId) }),
  
  // Notifications
  notifications: () => queryClient.invalidateQueries({ queryKey: QueryKeys.notifications() }),
  
  // Settings
  settings: () => queryClient.invalidateQueries({ queryKey: QueryKeys.settings() }),
  
  // Project Members
  projectMembers: () => queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.PROJECT_MEMBERS] }),
} as const;

// Error handling helpers
export const handleApiError = (error: any) => {
  console.error("API Error:", error);
  
  if (error.message?.includes("401")) {
    return "Authentication required. Please log in again.";
  }
  
  if (error.message?.includes("403")) {
    return "You don't have permission to perform this action.";
  }
  
  if (error.message?.includes("404")) {
    return "The requested resource was not found.";
  }
  
  if (error.message?.includes("500")) {
    return "Server error. Please try again later.";
  }
  
  return error.message || "An unexpected error occurred.";
};

// Request timeout wrapper
export const withTimeout = (promise: Promise<any>, timeoutMs: number = 30000) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Request timeout")), timeoutMs)
    )
  ]);
};

// Retry logic for failed requests
export const retryRequest = async (
  requestFn: () => Promise<any>, 
  maxRetries: number = 3,
  delay: number = 1000
) => {
  let lastError: any;
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;
      
      if (i === maxRetries) break;
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
  
  throw lastError;
};
