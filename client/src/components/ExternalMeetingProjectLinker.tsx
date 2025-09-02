import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Link2, Unlink } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ExternalMeetingProjectLinkerProps {
  meetingId: string;
  meetingTitle: string;
  externalId: string;
  currentProjectId?: string;
  currentProjectName?: string;
  meetingStartTime?: string;
  meetingEndTime?: string;
  meetingDescription?: string;
  meetingLocation?: string;
  onLinked?: (projectId: string | null, projectName?: string) => void;
}

interface Project {
  id: string;
  name: string;
}

export function ExternalMeetingProjectLinker({
  meetingId,
  meetingTitle,
  externalId,
  currentProjectId,
  currentProjectName,
  meetingStartTime,
  meetingEndTime,
  meetingDescription,
  meetingLocation,
  onLinked
}: ExternalMeetingProjectLinkerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(currentProjectId || null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user's projects
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Create or update external meeting
  const createExternalMeetingMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/external-meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create external meeting");
      return response.json();
    },
  });

  // Link external meeting to project
  const linkMeetingMutation = useMutation({
    mutationFn: async ({ meetingId, projectId, meetingData }: { 
      meetingId: string; 
      projectId: string | null; 
      meetingData?: any;
    }) => {
      const response = await fetch(`/api/external-meetings/${meetingId}/link-project`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, meetingData }),
      });
      if (!response.ok) throw new Error("Failed to link meeting to project");
      return response.json();
    },
    onSuccess: async (data, variables) => {
      const selectedProject = projects.find(p => p.id === variables.projectId);
      onLinked?.(variables.projectId, selectedProject?.name);
      setIsOpen(false);
      
      // CRITICAL: Force fresh fetch by adding timestamp to bypass 304 cache
      await queryClient.refetchQueries({ 
        queryKey: ["/api/outlook/events"],
        type: 'active',
        exact: true
      });
      queryClient.invalidateQueries({ queryKey: ["/api/external-meetings"] });
      
      toast({
        title: variables.projectId ? "Meeting Linked" : "Meeting Unlinked", 
        description: variables.projectId 
          ? `"${meetingTitle}" is now linked to ${selectedProject?.name}`
          : `"${meetingTitle}" has been unlinked from projects`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to link meeting",
        variant: "destructive",
      });
    },
  });

  const handleLinkToProject = () => {
    // For Outlook meetings that don't exist in our DB yet, we need to provide meeting data
    const requestData: any = { projectId: selectedProjectId };
    
    if (meetingId?.startsWith('outlook-')) {
      // Extract meeting data from the current event display
      // This will be passed to the API to create the external meeting record
      requestData.meetingData = {
        title: meetingTitle,
        startTime: meetingStartTime || new Date().toISOString(),
        endTime: meetingEndTime || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        description: meetingDescription || '',
        location: meetingLocation || ''
      };
    }

    linkMeetingMutation.mutate({ meetingId: meetingId || `outlook-${externalId}`, ...requestData });
  };

  const handleUnlink = () => {
    if (!meetingId) {
      toast({
        title: "Cannot Unlink",
        description: "This meeting hasn't been processed yet.",
        variant: "destructive",
      });
      return;
    }

    linkMeetingMutation.mutate({ meetingId, projectId: null });
  };

  return (
    <div className="flex items-center gap-2">
      {currentProjectId && currentProjectName ? (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            <Link2 className="w-3 h-3 mr-1" />
            {currentProjectName}
          </Badge>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-xs h-6 px-2">
                <Unlink className="w-3 h-3 mr-1" />
                Change
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Link Meeting to Project</DialogTitle>
                <DialogDescription>
                  Choose which project this meeting should be associated with for better meeting preparation.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Meeting</label>
                  <p className="text-sm text-muted-foreground">{meetingTitle}</p>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Link to Project</label>
                  <Select value={selectedProjectId || ""} onValueChange={(value) => setSelectedProjectId(value || null)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No project (unlink)</SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={handleLinkToProject}
                    disabled={linkMeetingMutation.isPending}
                    className="flex-1"
                  >
                    {linkMeetingMutation.isPending ? "Linking..." : (selectedProjectId ? "Link to Project" : "Unlink")}
                  </Button>
                  <Button variant="outline" onClick={() => setIsOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      ) : (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-xs h-6 px-2">
              <Link2 className="w-3 h-3 mr-1" />
              Link to Project
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Link Meeting to Project</DialogTitle>
              <DialogDescription>
                Choose which project this meeting should be associated with for better meeting preparation with relevant tasks and context.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Meeting</label>
                <p className="text-sm text-muted-foreground">{meetingTitle}</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Link to Project</label>
                <Select value={selectedProjectId || ""} onValueChange={(value) => setSelectedProjectId(value || null)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleLinkToProject}
                  disabled={linkMeetingMutation.isPending || !selectedProjectId}
                  className="flex-1"
                >
                  {linkMeetingMutation.isPending ? "Linking..." : "Link to Project"}
                </Button>
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default ExternalMeetingProjectLinker;