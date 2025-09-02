import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Crown, UserCheck, Mail, UserPlus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ProjectMembersProps {
  projectId: string;
  isOwner: boolean;
}

export default function ProjectMembers({ projectId, isOwner }: ProjectMembersProps) {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: members = [], isLoading, error } = useQuery<any[]>({
    queryKey: ['/api/projects', projectId, 'members'],
    enabled: !!projectId,
  });

  const { data: project } = useQuery<any>({
    queryKey: ['/api/projects', projectId],
    enabled: !!projectId,
  });

  const { data: invitations = [] } = useQuery<any[]>({
    queryKey: ['/api/projects', projectId, 'invitations'],
    enabled: !!projectId && isOwner,
  });

  const inviteMutation = useMutation({
    mutationFn: async (data: { email: string; role: string }) => {
      const response = await apiRequest("POST", `/api/projects/${projectId}/invite`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'invitations'] });
      setIsInviteModalOpen(false);
      setInviteEmail("");
      setInviteRole("member");
      toast({
        title: "Invitation Sent",
        description: "The invitation has been sent successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation",
        variant: "destructive",
      });
    },
  });

  const cancelInvitationMutation = useMutation({
    mutationFn: async (token: string) => {
      const response = await apiRequest("DELETE", `/api/invitations/${token}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'invitations'] });
      toast({
        title: "Invitation Cancelled",
        description: "The invitation has been cancelled.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to cancel invitation",
        variant: "destructive",
      });
    },
  });

  const handleInvite = () => {
    if (!inviteEmail.trim()) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    inviteMutation.mutate({ email: inviteEmail, role: inviteRole });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-gray-500">Loading members...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-red-500">Failed to load members</div>
        </CardContent>
      </Card>
    );
  }

  const getRoleIcon = (role: string) => {
    if (role === 'owner') return <Crown className="h-4 w-4 text-yellow-600" />;
    if (role === 'admin') return <UserCheck className="h-4 w-4 text-blue-600" />;
    return <Users className="h-4 w-4 text-gray-600" />;
  };

  const getRoleBadgeVariant = (role: string) => {
    if (role === 'owner') return 'default';
    if (role === 'admin') return 'secondary';
    return 'outline';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Members ({(members.length || 0) + 1})
          </div>
          {isOwner && (
            <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
              <DialogTrigger asChild>
                <Button 
                  size="sm" 
                  className="bg-blue-600 hover:bg-blue-700"
                  data-testid="button-invite-member"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Invite Team Member</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="invite-email">Email Address</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="colleague@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      data-testid="input-invite-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite-role">Role</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger data-testid="select-invite-role">
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
                      data-testid="button-cancel-invite"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleInvite}
                      disabled={inviteMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700"
                      data-testid="button-send-invite"
                    >
                      {inviteMutation.isPending ? "Sending..." : "Send Invitation"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Project Owner */}
        {project && (
          <div className="flex items-center justify-between p-3 rounded-lg border bg-yellow-50 dark:bg-yellow-950/10">
            <div className="flex items-center space-x-3">
              <Avatar>
                <AvatarFallback>
                  <Crown className="h-4 w-4 text-yellow-600" />
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">Project Owner</div>
                <div className="text-sm text-gray-600">
                  {(project as any)?.ownerName || "Owner"}
                </div>
              </div>
            </div>
            <Badge variant="default">Owner</Badge>
          </div>
        )}

        {/* Team Members */}
        {members.length > 0 ? (
          members.map((member: any) => (
            <div key={member.id} className="flex items-center justify-between p-3 rounded-lg border">
              <div className="flex items-center space-x-3">
                <Avatar>
                  <AvatarFallback>
                    {member.user?.name?.charAt(0) || member.user?.email?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">
                    {member.user?.name || "Unknown User"}
                  </div>
                  <div className="text-sm text-gray-600 flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {member.user?.email || "No email"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={getRoleBadgeVariant(member.role)}>
                  {member.role}
                </Badge>
                {isOwner && member.role !== 'owner' && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-red-600 hover:text-red-700"
                    // onClick={() => removeMember(member.userId)}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">
            <UserCheck className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-2">Just you for now</p>
            <p className="text-sm">
              {isOwner ? "Invite team members to collaborate on this project." : "No other members yet."}
            </p>
          </div>
        )}

        {/* Pending Invitations - Only visible to project owner */}
        {isOwner && invitations.length > 0 && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Pending Invitations ({invitations.length})
            </h4>
            <div className="space-y-2">
              {invitations.map((invitation: any) => (
                <div key={invitation.id} className="flex items-center justify-between p-3 rounded-lg border bg-orange-50 dark:bg-orange-950/10">
                  <div className="flex items-center space-x-3">
                    <Avatar>
                      <AvatarFallback>
                        <Mail className="h-4 w-4 text-orange-600" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium text-sm">{invitation.inviteeEmail}</div>
                      <div className="text-xs text-gray-600">
                        Invited {new Date(invitation.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-orange-600 border-orange-600">
                      {invitation.role}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => cancelInvitationMutation.mutate(invitation.token)}
                      disabled={cancelInvitationMutation.isPending}
                      data-testid={`button-cancel-invitation-${invitation.token}`}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}