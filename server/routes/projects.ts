import type { Express } from "express";
import { randomUUID } from "crypto";
import { storage } from "../storage";
import { insertProjectSchema } from "@shared/schema";
import { requireAuth, getUserId } from "../middleware/auth";

export function registerProjectRoutes(app: Express) {
  const mockUserId = "b671eb82-abc1-424f-8bdf-30cc749e5ec9";

  // Get all projects for the authenticated user (owned + collaborated)
  app.get("/api/projects", async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const projects = await storage.getProjects(userId);
      res.json(projects);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  // Create a new project
  app.post("/api/projects", async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const projectData = insertProjectSchema.parse({ 
        ...req.body, 
        ownerId: userId 
      });
      const project = await storage.createProject(projectData);
      res.json(project);
    } catch (error: any) {
      res.status(400).json({ message: "Invalid project data", error: error.message });
    }
  });

  // Get project details (with access control)
  app.get("/api/projects/:id", async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const project = await storage.getProject(req.params.id);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Check if user has access to this project
      const userProjects = await storage.getProjects(userId);
      const hasAccess = userProjects.some(p => p.id === project.id);
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(project);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  // Add collaborator to project
  app.post("/api/projects/:id/collaborators", async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const { email } = req.body;
      
      // Find user by email
      const collaborator = await storage.getUserByEmail(email);
      if (!collaborator) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if current user owns the project
      const project = await storage.getProject(req.params.id);
      if (!project || project.ownerId !== userId) {
        return res.status(403).json({ message: "Only project owner can add collaborators" });
      }

      // Add as project member
      await storage.addProjectMember({
        projectId: req.params.id,
        userId: collaborator.id,
        role: "member"
      });

      res.json({ message: "Collaborator added successfully" });
    } catch (error: any) {
      console.error("Error adding collaborator:", error);
      res.status(500).json({ message: "Failed to add collaborator" });
    }
  });

  // Get project collaborators
  app.get("/api/projects/:id/collaborators", async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      
      // Check if user has access to this project
      const userProjects = await storage.getProjects(userId);
      const hasAccess = userProjects.some(p => p.id === req.params.id);
      
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const collaborators = await storage.getProjectMembers(req.params.id);
      res.json(collaborators);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch collaborators" });
    }
  });

  // Send project invitation
  app.post("/api/projects/:id/invite", async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const { email, role = "member" } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Check if current user owns the project
      const project = await storage.getProject(req.params.id);
      if (!project || project.ownerId !== userId) {
        return res.status(403).json({ message: "Only project owner can send invitations" });
      }

      // Check if user is already a member
      const existingMembers = await storage.getProjectMembers(req.params.id);
      const isAlreadyMember = existingMembers.some(member => member.user.email === email);
      if (isAlreadyMember) {
        return res.status(400).json({ message: "User is already a member of this project" });
      }

      // Check if there's already a pending invitation
      const existingInvitations = await storage.getInvitationsByProject(req.params.id);
      const hasPendingInvitation = existingInvitations.some(inv => inv.inviteeEmail === email && inv.status === 'pending');
      if (hasPendingInvitation) {
        return res.status(400).json({ message: "An invitation has already been sent to this email" });
      }

      // Create invitation
      const invitation = await storage.createInvitation({
        token: randomUUID(),
        projectId: req.params.id,
        inviterUserId: userId,
        inviteeEmail: email,
        role: role,
        status: "pending",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
      });

      res.json({ message: "Invitation sent successfully", invitation });
    } catch (error: any) {
      console.error("Error sending invitation:", error);
      res.status(500).json({ message: "Failed to send invitation" });
    }
  });

  // Get project invitations (for project owner)
  app.get("/api/projects/:id/invitations", async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      
      // Check if current user owns the project
      const project = await storage.getProject(req.params.id);
      if (!project || project.ownerId !== userId) {
        return res.status(403).json({ message: "Only project owner can view invitations" });
      }

      const invitations = await storage.getInvitationsByProject(req.params.id);
      res.json(invitations);
    } catch (error) {
      console.error("Error fetching invitations:", error);
      res.status(500).json({ message: "Failed to fetch invitations" });
    }
  });

  // Cancel invitation
  app.delete("/api/invitations/:token", async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      
      const invitation = await storage.getInvitation(req.params.token);
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      // Check if current user is the inviter or project owner
      if (invitation.inviterUserId !== userId && invitation.project.ownerId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.deleteInvitation(req.params.token);
      res.json({ message: "Invitation cancelled successfully" });
    } catch (error) {
      console.error("Error cancelling invitation:", error);
      res.status(500).json({ message: "Failed to cancel invitation" });
    }
  });
}