import type { Express } from "express";
import { createServer, type Server } from "http";
import { randomBytes } from "crypto";
import { storage } from "./storage";
import { aiService } from "./services/ai";
import { insertProjectSchema, insertTaskSchema, insertMeetingSchema, insertUserSettingsSchema, insertInvitationSchema, insertExternalMeetingSchema } from "@shared/schema";
import { emailService } from "./services/email";
import { transcriptionService } from "./services/transcription";
import { analyticsService } from "./services/analytics";
import { authService } from "./auth";
import { registerProjectRoutes } from "./routes/projects";
import { getUserId, requireAuth } from "./middleware/auth";
import { OutlookService } from "./services/outlook";
import { 
  generateRegistrationOptions, 
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse 
} from "@simplewebauthn/server";
import crypto from "crypto";

// Helper function to calculate string similarity using Levenshtein distance
function calculateStringSimilarity(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0) return len2 === 0 ? 1 : 0;
  if (len2 === 0) return 0;
  
  // Create a matrix to store distances
  const matrix: number[][] = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));
  
  // Initialize first row and column
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;
  
  // Fill the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,     // deletion
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j - 1] + 1  // substitution
        );
      }
    }
  }
  
  // Calculate similarity as a percentage
  const maxLen = Math.max(len1, len2);
  const distance = matrix[len1][len2];
  return (maxLen - distance) / maxLen;
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Removed conflicting middleware - now using proper comprehensive endpoint

  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      const user = await authService.login({ email, password }, storage);
      
      if (!user) {
        // Log failed login attempt
        try {
          const existingUser = await storage.getUserByEmail(email);
          if (existingUser) {
            await storage.createLoginEvent({
              userId: existingUser.id,
              type: "login_failure",
              method: "password",
              deviceName: req.get("user-agent")?.includes("Mobile") ? "Mobile Device" : "Desktop",
              userAgent: req.get("user-agent") || null,
              ipAddress: req.ip || req.connection.remoteAddress || null,
            });
          }
        } catch (error) {
          console.error("Failed to log failed login event:", error);
        }
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Set session
      req.session.userId = user.id;
      req.session.user = user;

      // Log login event
      try {
        await storage.createLoginEvent({
          userId: user.id,
          type: "login_success",
          method: "password",
          deviceName: req.get("user-agent")?.includes("Mobile") ? "Mobile Device" : "Desktop",
          userAgent: req.get("user-agent") || null,
          ipAddress: req.ip || req.connection.remoteAddress || null,
        });
      } catch (error) {
        console.error("Failed to log login event:", error);
      }
      
      res.json({ user, message: "Login successful" });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, name } = req.body;
      
      if (!email || !password || !name) {
        return res.status(400).json({ error: "Email, password, and name are required" });
      }

      const user = await authService.register({ email, password, name }, storage);
      
      if (!user) {
        return res.status(400).json({ error: "Registration failed - user may already exist" });
      }

      // Set session
      req.session.userId = user.id;
      req.session.user = user;
      
      res.status(201).json({ user, message: "Registration successful" });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ message: "Logout successful" });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        req.session.destroy(() => {});
        return res.status(401).json({ error: "User not found" });
      }

      const safeUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username
      };

      res.json({ user: safeUser });
    } catch (error) {
      console.error("Auth check error:", error);
      res.status(500).json({ error: "Authentication check failed" });
    }
  });

  // Security Analytics endpoint
  app.get("/api/auth/security-analytics", async (req, res) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const analytics = await storage.getSecurityAnalytics(req.session.userId);
      res.json(analytics);
    } catch (error) {
      console.error("Security analytics error:", error);
      res.status(500).json({ error: "Failed to fetch security analytics" });
    }
  });

  // WebAuthn routes
  app.post("/api/auth/webauthn/register/begin", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const existingAuthenticators = await storage.getUserAuthenticators(userId);

      const options = await generateRegistrationOptions({
        rpName: "AI ProjectHub",
        rpID: req.hostname === "localhost" ? "localhost" : req.hostname,
        userID: new TextEncoder().encode(user.id),
        userName: user.email,
        userDisplayName: user.name,
        attestationType: "none",
        excludeCredentials: existingAuthenticators.map(auth => ({
          id: auth.credentialId,
          type: "public-key",
          transports: auth.transports as any,
        })),
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "preferred",
          authenticatorAttachment: "platform", // Prefer built-in authenticators (Touch ID/Face ID)
        },
      });

      // Store the challenge in the session for verification
      req.session.webauthnChallenge = options.challenge;

      res.json(options);
    } catch (error) {
      console.error("WebAuthn registration begin error:", error);
      res.status(500).json({ error: "Failed to start registration" });
    }
  });

  app.post("/api/auth/webauthn/register/finish", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const { credential: registrationCredential, deviceName } = req.body;
      const expectedChallenge = req.session.webauthnChallenge;

      if (!expectedChallenge) {
        return res.status(400).json({ error: "No registration in progress" });
      }

      const verification = await verifyRegistrationResponse({
        response: registrationCredential,
        expectedChallenge,
        expectedOrigin: req.get("origin") || `${req.protocol}://${req.get("host")}`,
        expectedRPID: req.hostname === "localhost" ? "localhost" : req.hostname,
        requireUserVerification: false,
      });

      if (!verification.verified || !verification.registrationInfo) {
        return res.status(400).json({ error: "Registration verification failed" });
      }

      const { credential } = verification.registrationInfo;
      const credentialID = credential.id;
      const credentialPublicKey = credential.publicKey;
      const counter = credential.counter;

      // Save the authenticator to the database
      await storage.createAuthenticator({
        userId: user.id,
        credentialId: Buffer.from(credentialID).toString("base64url"),
        credentialPublicKey: Buffer.from(credentialPublicKey).toString("base64url"),
        counter,
        credentialDeviceType: "singleDevice",
        credentialBackedUp: false,
        transports: registrationCredential.response.transports,
        deviceName: deviceName || "Biometric Device",
      });

      // Clear the challenge
      delete req.session.webauthnChallenge;

      res.json({ verified: true, message: "Biometric authentication registered successfully" });
    } catch (error) {
      console.error("WebAuthn registration finish error:", error);
      res.status(500).json({ error: "Failed to complete registration" });
    }
  });

  app.post("/api/auth/webauthn/login/begin", async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const userAuthenticators = await storage.getUserAuthenticators(user.id);
      
      if (userAuthenticators.length === 0) {
        return res.status(400).json({ error: "No biometric authentication registered for this user" });
      }

      const options = await generateAuthenticationOptions({
        rpID: req.hostname === "localhost" ? "localhost" : req.hostname,
        allowCredentials: userAuthenticators.map(auth => ({
          id: auth.credentialId,
          type: "public-key",
          transports: auth.transports as any,
        })),
        userVerification: "preferred",
      });

      // Store challenge and user ID in session for verification
      req.session.webauthnChallenge = options.challenge;
      req.session.webauthnUserId = user.id;

      res.json(options);
    } catch (error) {
      console.error("WebAuthn authentication begin error:", error);
      res.status(500).json({ error: "Failed to start authentication" });
    }
  });

  app.post("/api/auth/webauthn/login/finish", async (req, res) => {
    try {
      const { credential } = req.body;
      const expectedChallenge = req.session.webauthnChallenge;
      const userId = req.session.webauthnUserId;

      if (!expectedChallenge || !userId) {
        return res.status(400).json({ error: "No authentication in progress" });
      }

      const authenticator = await storage.getAuthenticatorByCredentialId(
        Buffer.from(credential.id, "base64url").toString("base64url")
      );

      if (!authenticator || authenticator.userId !== userId) {
        return res.status(400).json({ error: "Authenticator not found" });
      }

      const verification = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge,
        expectedOrigin: req.get("origin") || `${req.protocol}://${req.get("host")}`,
        expectedRPID: req.hostname === "localhost" ? "localhost" : req.hostname,
        credential: {
          id: authenticator.credentialId,
          publicKey: Buffer.from(authenticator.credentialPublicKey, "base64url"),
          counter: authenticator.counter,
        },
        requireUserVerification: false,
      });

      if (!verification.verified) {
        // Log failed biometric attempt
        try {
          if (authenticator) {
            await storage.createLoginEvent({
              userId: authenticator.userId,
              type: "biometric_failure",
              method: "biometric",
              deviceName: authenticator.deviceName || (req.get("user-agent")?.includes("Mobile") ? "Mobile Device" : "Desktop"),
              userAgent: req.get("user-agent") || null,
              ipAddress: req.ip || req.connection.remoteAddress || null,
            });
          }
        } catch (error) {
          console.error("Failed to log biometric failure event:", error);
        }
        return res.status(400).json({ error: "Authentication verification failed" });
      }

      // Update the authenticator counter
      await storage.updateAuthenticator(authenticator.credentialId, {
        counter: verification.authenticationInfo.newCounter,
      });

      // Get the user and set up the session
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Set session
      req.session.userId = user.id;
      req.session.user = user;

      // Log biometric login event
      try {
        await storage.createLoginEvent({
          userId: user.id,
          type: "biometric_login",
          method: "biometric",
          deviceName: authenticator.deviceName || (req.get("user-agent")?.includes("Mobile") ? "Mobile Device" : "Desktop"),
          userAgent: req.get("user-agent") || null,
          ipAddress: req.ip || req.connection.remoteAddress || null,
        });
      } catch (error) {
        console.error("Failed to log biometric login event:", error);
      }
      
      // Clear WebAuthn session data
      delete req.session.webauthnChallenge;
      delete req.session.webauthnUserId;

      res.json({ 
        verified: true, 
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username
        },
        message: "Biometric authentication successful" 
      });
    } catch (error) {
      console.error("WebAuthn authentication finish error:", error);
      res.status(500).json({ error: "Failed to complete authentication" });
    }
  });

  // Get user's registered authenticators
  app.get("/api/auth/webauthn/authenticators", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const authenticators = await storage.getUserAuthenticators(userId);
      
      // Return safe authenticator info (no private keys)
      const safeAuthenticators = authenticators.map(auth => ({
        id: auth.credentialId, // Use credentialId as the identifier for deletion
        deviceName: auth.deviceName,
        createdAt: auth.createdAt,
        lastUsedAt: auth.lastUsedAt,
      }));

      res.json(safeAuthenticators);
    } catch (error) {
      console.error("Get authenticators error:", error);
      res.status(500).json({ error: "Failed to get authenticators" });
    }
  });

  // Delete an authenticator
  app.delete("/api/auth/webauthn/authenticators/:credentialId", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const { credentialId } = req.params;
      
      const authenticator = await storage.getAuthenticatorByCredentialId(credentialId);
      if (!authenticator || authenticator.userId !== userId) {
        return res.status(404).json({ error: "Authenticator not found" });
      }

      await storage.deleteAuthenticator(credentialId);
      res.json({ message: "Authenticator deleted successfully" });
    } catch (error) {
      console.error("Delete authenticator error:", error);
      res.status(500).json({ error: "Failed to delete authenticator" });
    }
  });

  // Mock user session - in production, use proper authentication
  const mockUserId = "9a002ca6-ee3c-4ebb-953f-c602fdb3ecbd";

  // Dashboard
  // Settings endpoints
  app.get("/api/settings", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      let settings = await storage.getUserSettings(userId);
      
      // Create default settings if none exist
      if (!settings) {
        const defaultSettings = {
          userId: userId,
          emailNotifications: true,
          morningBriefing: true,
          lunchReminder: false,
          endOfDaySummary: true,
          meetingReminders: true,
          taskDeadlineAlerts: true,
          aiInsights: true,
          workingHoursStart: "09:00",
          workingHoursEnd: "18:00",
          urgentOnly: false,
        };
        settings = await storage.createUserSettings(defaultSettings);
      }
      
      res.json(settings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.put("/api/profile", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const { email, name } = req.body;

      if (!email || !name) {
        return res.status(400).json({ error: "Email and name are required" });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Invalid email format" });
      }

      // Check if email is already taken by another user
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({ error: "Email is already in use by another account" });
      }

      // Update user profile
      const updatedUser = await storage.updateUser(userId, { email, name });

      // Update session with new user data
      req.session.user = {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        username: updatedUser.username
      };

      res.json({ 
        user: req.session.user,
        message: "Profile updated successfully" 
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.put("/api/settings", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const updatedSettings = await storage.updateUserSettings(userId, req.body);
      res.json(updatedSettings);
    } catch (error) {
      console.error("Error updating settings:", error);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  app.post("/api/settings/test-email", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const user = await storage.getUser(userId);
      const settings = await storage.getUserSettings(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      if (!settings?.emailNotifications) {
        return res.status(400).json({ 
          message: "Email notifications are disabled. Please enable them in settings first." 
        });
      }

      console.log(`📧 Sending test email to: ${user.email}`);
      await emailService.sendTestEmail(user.email);
      console.log(`✅ Test email sent successfully to: ${user.email}`);

      res.json({ 
        message: "Test email sent successfully",
        sentTo: user.email 
      });
    } catch (error: any) {
      console.error("❌ Error sending test email:", error);
      res.status(500).json({ 
        message: "Failed to send test email", 
        error: error.message 
      });
    }
  });

  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const stats = await storage.getDashboardStats(userId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  app.get("/api/dashboard/activity", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const limit = parseInt(req.query.limit as string) || 10;
      const activity = await storage.getRecentActivity(userId, limit);
      res.json(activity);
    } catch (error) {
      console.error("Recent activity error:", error);
      res.status(500).json({ message: "Failed to fetch recent activity" });
    }
  });

  app.get("/api/dashboard/todays-meetings", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const meetings = await storage.getTodaysMeetings(userId);
      res.json(meetings);
    } catch (error) {
      console.error("Today's meetings error:", error);
      res.status(500).json({ message: "Failed to fetch today's meetings" });
    }
  });

  // Projects
  app.get("/api/projects", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const projects = await storage.getProjects(userId);
      
      // Add task counts and ownership information for each project
      const projectsWithTaskCounts = await Promise.all(
        projects.map(async (project) => {
          const allTasks = await storage.getTasks(project.id);
          const myTasks = allTasks.filter(task => task.assigneeId === userId);
          const completedTasks = allTasks.filter(task => task.status === 'completed').length;
          const actualProgress = allTasks.length > 0 ? Math.round((completedTasks / allTasks.length) * 100) : 0;
          
          return {
            ...project,
            totalTasks: allTasks.length,
            completedTasks,
            myTasks: myTasks.length,
            actualProgress,
            isOwner: project.ownerId === userId // Add ownership flag
          };
        })
      );
      
      res.json(projectsWithTaskCounts);
    } catch (error) {
      console.error("Failed to fetch projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.post("/api/projects", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const projectData = insertProjectSchema.parse({ ...req.body, ownerId: userId });
      const project = await storage.createProject(projectData);
      res.json(project);
    } catch (error: any) {
      console.error("Project creation error:", error);
      res.status(400).json({ message: "Invalid project data", error: error.message });
    }
  });

  app.get("/api/projects/:id", requireAuth, async (req, res) => {
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

  app.get("/api/projects/:id/tasks", requireAuth, async (req, res) => {
    try {
      const tasks = await storage.getTasksByProject(req.params.id);
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch project tasks" });
    }
  });

  app.put("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      const updates = insertProjectSchema.partial().parse(req.body);
      const project = await storage.updateProject(req.params.id, updates);
      res.json(project);
    } catch (error: any) {
      console.error("Project update error:", error);
      res.status(400).json({ message: "Invalid project data", error: error.message });
    }
  });

  app.delete("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const projectId = req.params.id;
      
      // Verify user owns the project before deletion
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      if (project.ownerId !== userId) {
        return res.status(403).json({ message: "Only project owner can delete this project" });
      }
      
      // Delete project and all associated data (tasks, meetings, members, invitations)
      await storage.deleteProject(projectId);
      res.json({ message: "Project and all associated data deleted successfully" });
    } catch (error: any) {
      console.error("Project deletion error:", error);
      res.status(500).json({ 
        message: "Failed to delete project", 
        error: error.message || "Unknown error occurred"
      });
    }
  });

  // Project Members - Get all project members across all user's projects
  app.get("/api/project-members", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      // Get all projects the user owns or is a member of
      const userProjects = await storage.getProjects(userId);
      
      // Get members for all projects
      const allMembers = [];
      for (const project of userProjects) {
        const members = await storage.getProjectMembers(project.id);
        allMembers.push(...members);
        
        // Also add the project owner as a team member
        const owner = await storage.getUser(project.ownerId);
        if (owner) {
          // Check if owner is already in members list to avoid duplicates
          const ownerAlreadyInList = members.some(member => member.userId === owner.id);
          if (!ownerAlreadyInList) {
            allMembers.push({
              id: `owner-${project.id}`, // Unique ID for owner entry
              projectId: project.id,
              userId: owner.id,
              role: "owner",
              joinedAt: project.createdAt, // Use project creation date as join date
              user: owner
            });
          }
        }
      }
      
      res.json(allMembers);
    } catch (error) {
      console.error("Failed to fetch all project members:", error);
      res.status(500).json({ message: "Failed to fetch project members" });
    }
  });

  // Project Members - Get members for a specific project
  app.get("/api/projects/:id/members", requireAuth, async (req, res) => {
    try {
      const members = await storage.getProjectMembers(req.params.id);
      res.json(members);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch project members" });
    }
  });

  app.post("/api/projects/:id/invite", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const { email, role = "member" } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      // Check if user is project owner
      const project = await storage.getProject(req.params.id);
      if (!project || project.ownerId !== userId) {
        return res.status(403).json({ message: "Only project owners can invite members" });
      }

      // Check if user already exists and is already a member
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        const existingMembers = await storage.getProjectMembers(req.params.id);
        const isAlreadyMember = existingMembers.some(m => m.userId === existingUser.id);
        const isOwner = project.ownerId === existingUser.id;

        if (isOwner) {
          return res.status(400).json({ message: "User is already the project owner" });
        }

        if (isAlreadyMember) {
          return res.status(400).json({ message: "User is already a project member" });
        }
      }

      // Check if there's already a pending invitation
      const existingInvitations = await storage.getInvitationsByProject(req.params.id);
      const pendingInvitation = existingInvitations.find(
        inv => inv.inviteeEmail === email && inv.status === 'pending'
      );
      
      if (pendingInvitation) {
        return res.status(400).json({ message: "Invitation already sent to this email" });
      }

      // Get inviter info
      const inviter = await storage.getUser(userId);
      if (!inviter) {
        return res.status(400).json({ message: "Inviter not found" });
      }

      // Generate unique invitation token
      const token = randomBytes(32).toString('hex');
      
      // Set expiration date (7 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Create invitation record
      const invitation = await storage.createInvitation({
        projectId: req.params.id,
        inviterUserId: userId,
        inviteeEmail: email,
        role,
        token,
        expiresAt
      });

      // Create in-app notification for existing users
      if (existingUser) {
        await storage.createNotification({
          userId: existingUser.id,
          title: "Project Invitation",
          message: `${inviter.name} invited you to join "${project.name}" as a ${role}`,
          type: "invitation",
          data: { 
            invitationId: invitation.id,
            projectId: req.params.id, 
            projectName: project.name,
            inviterName: inviter.name,
            role,
            token
          }
        });
      }

      // Send invitation email
      try {
        await emailService.sendProjectInvitation(
          email,
          project.name,
          inviter.name,
          token,
          role
        );
      } catch (emailError) {
        console.error('Failed to send invitation email:', emailError);
        // Still continue - invitation is created even if email fails
      }

      res.json({ 
        message: "Invitation sent successfully", 
        invitation: {
          id: invitation.id,
          email,
          role,
          projectName: project.name,
          status: invitation.status,
          expiresAt: invitation.expiresAt
        }
      });
    } catch (error: any) {
      console.error("Invite member error:", error);
      res.status(500).json({ message: "Failed to send invitation", error: error.message });
    }
  });

  app.delete("/api/projects/:id/members/:userId", requireAuth, async (req, res) => {
    try {
      const currentUserId = getUserId(req as any, mockUserId);
      
      // Check if current user is project owner
      const project = await storage.getProject(req.params.id);
      if (!project || project.ownerId !== currentUserId) {
        return res.status(403).json({ message: "Only project owners can remove members" });
      }

      await storage.removeProjectMember(req.params.id, req.params.userId);
      res.json({ message: "Member removed successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to remove member" });
    }
  });

  // AI Insights
  app.get("/api/ai/project-insights/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Check if user has access to this project
      const userProjects = await storage.getProjects(userId);
      const hasAccess = userProjects.some(p => p.id === req.params.id);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied to this project" });
      }

      const tasks = await storage.getTasksByProject(req.params.id);
      const insights = await aiService.generateProjectInsights(project, tasks);
      
      res.json(insights);
    } catch (error: any) {
      console.error("AI insights error:", error);
      res.status(500).json({ message: "Failed to generate insights", error: error.message });
    }
  });

  // Smart Notifications
  app.get("/api/ai/notifications", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const projects = await storage.getProjects(userId);
      const tasks = await storage.getTasks(undefined, userId);
      const notifications = await aiService.generateSmartNotifications(projects, tasks, userId);
      
      res.json(notifications);
    } catch (error: any) {
      console.error("Smart notifications error:", error);
      res.status(500).json({ message: "Failed to generate notifications", error: error.message });
    }
  });

  // Daily Summary
  app.get("/api/ai/daily-summary", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const projects = await storage.getProjects(userId);
      const tasks = await storage.getTasks(undefined, userId);
      const summary = await aiService.generateDailySummary(projects, tasks, userId);
      
      res.json(summary);
    } catch (error: any) {
      console.error("Daily summary error:", error);
      res.status(500).json({ message: "Failed to generate daily summary", error: error.message });
    }
  });

  // Send notification email
  app.post("/api/ai/send-notification-email", async (req, res) => {
    try {
      const { type, email = "user@example.com", data } = req.body; // Default email for demo
      
      if (type === 'daily_summary') {
        const projects = await storage.getProjects(mockUserId);
        const tasks = await storage.getTasks();
        const summary = await aiService.generateDailySummary(projects, tasks, mockUserId);
        
        await emailService.sendDailySummary(email, summary);
        
        res.json({ 
          message: "Daily summary email sent", 
          summary,
          emailSent: !!process.env.RESEND_API_KEY,
          note: !process.env.RESEND_API_KEY ? "Email logged to console (Resend API key not configured)" : "Email sent via Resend"
        });
      } else if (type === 'test_email') {
        await emailService.sendTestEmail(email);
        res.json({ 
          message: "Test email sent", 
          emailSent: !!process.env.RESEND_API_KEY,
          note: !process.env.RESEND_API_KEY ? "Email logged to console (Resend API key not configured)" : "Email sent via Resend"
        });
      } else if (type === 'project_alert' && data) {
        await emailService.sendProjectAlert(email, data.projectName, data.alertType, data.message);
        res.json({ 
          message: "Project alert email sent",
          emailSent: !!process.env.RESEND_API_KEY 
        });
      } else if (type === 'deadline_alert' && data) {
        await emailService.sendTaskDeadlineAlert(email, data.taskTitle, data.projectName, data.dueDate);
        res.json({ 
          message: "Deadline alert email sent",
          emailSent: !!process.env.RESEND_API_KEY 
        });
      } else {
        res.status(400).json({ message: "Invalid notification type or missing data" });
      }
    } catch (error: any) {
      console.error("Email notification error:", error);
      res.status(500).json({ message: "Failed to send notification email", error: error.message });
    }
  });

  // Send emails to project members
  app.post("/api/ai/notify-project-members/:projectId", async (req, res) => {
    try {
      const { type, message } = req.body;
      const projectId = req.params.projectId;
      
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Get actual project members from the database
      const projectMembers = await storage.getProjectMembers(projectId);
      const owner = await storage.getUser(project.ownerId);
      
      // Collect all member emails (owner + collaborators)
      const memberEmails: string[] = [];
      if (owner?.email) {
        memberEmails.push(owner.email);
      }
      
      for (const member of projectMembers) {
        const memberUser = await storage.getUser(member.userId);
        if (memberUser?.email && !memberEmails.includes(memberUser.email)) {
          memberEmails.push(memberUser.email);
        }
      }
      
      const tasks = await storage.getTasksByProject(projectId);
      const insights = await aiService.generateProjectInsights(project, tasks);

      // Send notifications to all project members
      const emailPromises = memberEmails.map(email => {
        if (type === 'health_alert') {
          return emailService.sendProjectAlert(
            email, 
            project.name, 
            insights.healthScore < 40 ? 'urgent' : 'high',
            message || `Project health score is ${insights.healthScore}%. ${insights.riskFactors[0] || 'Needs attention'}`
          );
        } else if (type === 'deadline_reminder') {
          const upcomingTasks = tasks.filter(t => 
            t.dueDate && 
            new Date(t.dueDate) > new Date() && 
            new Date(t.dueDate) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          );
          
          return Promise.all(upcomingTasks.map(task => 
            emailService.sendTaskDeadlineAlert(email, task.title, project.name, task.dueDate!.toString())
          ));
        }
        return Promise.resolve();
      });

      await Promise.all(emailPromises);
      
      res.json({ 
        message: `Notifications sent to ${memberEmails.length} project members`,
        projectName: project.name,
        emailsSent: !!process.env.RESEND_API_KEY,
        recipients: memberEmails
      });
    } catch (error: any) {
      console.error("Project member notification error:", error);
      res.status(500).json({ message: "Failed to notify project members", error: error.message });
    }
  });

  // Tasks
  app.get("/api/tasks", requireAuth, async (req, res) => {
    try {
      const { projectId } = req.query;
      const userId = getUserId(req as any, "");
      
      if (projectId) {
        // Get tasks for a specific project
        const tasks = await storage.getTasks(projectId as string, userId);
        res.json(tasks);
      } else {
        // Get all tasks for the user across all their projects
        const userProjects = await storage.getProjects(userId);
        const allTasks = [];
        
        for (const project of userProjects) {
          const projectTasks = await storage.getTasks(project.id);
          allTasks.push(...projectTasks);
        }
        
        // Sort by creation date (newest first)
        allTasks.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        res.json(allTasks);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.post("/api/tasks", requireAuth, async (req, res) => {
    try {
      const taskData = insertTaskSchema.parse(req.body);
      const task = await storage.createTask(taskData);
      res.json(task);
    } catch (error: any) {
      console.error("Task creation error:", error);
      res.status(400).json({ message: "Invalid task data", error: error.message });
    }
  });

  app.put("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const updates = insertTaskSchema.partial().parse(req.body);
      const task = await storage.updateTask(req.params.id, updates, userId);
      res.json(task);
    } catch (error) {
      res.status(400).json({ message: "Invalid task data" });
    }
  });

  app.delete("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteTask(req.params.id);
      res.json({ message: "Task deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  // Batch delete tasks endpoint
  app.post("/api/tasks/batch-delete", requireAuth, async (req, res) => {
    try {
      const { taskIds } = req.body;
      
      if (!Array.isArray(taskIds) || taskIds.length === 0) {
        return res.status(400).json({ message: "Task IDs array is required" });
      }

        await storage.deleteTasks(taskIds);
      
      res.json({ 
        message: `${taskIds.length} tasks deleted successfully`,
        deletedCount: taskIds.length,
        taskIds: taskIds
      });
    } catch (error: any) {
      console.error("Batch delete tasks error:", error);
      res.status(500).json({ 
        message: "Failed to delete tasks", 
        error: error.message 
      });
    }
  });

  // Recalculate progress for a specific project
  app.post("/api/projects/:id/recalculate-progress", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const projectId = req.params.id;
      
      // Verify user has access to this project
      const userProjects = await storage.getProjects(userId);
      const hasAccess = userProjects.some(p => p.id === projectId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Not authorized to access this project" });
      }
      
      await storage.updateProjectProgress(projectId);
      const updatedProject = await storage.getProject(projectId);
      
      res.json({ 
        message: "Progress recalculated successfully",
        progress: updatedProject?.progress || 0
      });
    } catch (error: any) {
      console.error("Progress recalculation error:", error);
      res.status(500).json({ message: "Failed to recalculate progress", error: error.message });
    }
  });

  // Recalculate progress for all user's projects (admin/debugging endpoint)
  app.post("/api/projects/recalculate-all-progress", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const userProjects = await storage.getProjects(userId);
      
      let updated = 0;
      for (const project of userProjects) {
        await storage.updateProjectProgress(project.id);
        updated++;
      }
      
      res.json({ 
        message: `Progress recalculated for ${updated} projects`,
        projectsUpdated: updated
      });
    } catch (error: any) {
      console.error("Bulk progress recalculation error:", error);
      res.status(500).json({ message: "Failed to recalculate progress", error: error.message });
    }
  });

  // Meetings
  app.get("/api/meetings", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const { projectId } = req.query;
      const meetings = await storage.getMeetings(userId, projectId as string);
      
      // Return dates as ISO strings but preserve original timezone intent
      const fixedMeetings = meetings.map(meeting => ({
        ...meeting,
        scheduledAt: meeting.scheduledAt.toISOString()
      }));
      
      res.json(fixedMeetings);
    } catch (error) {
      console.error("Failed to fetch meetings:", error);
      res.status(500).json({ message: "Failed to fetch meetings" });
    }
  });

  app.post("/api/meetings", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      
      // Check for existing meeting with same recording ID to prevent duplicates
      if (req.body.recordingId) {
        const existingMeetings = await storage.getMeetings(userId);
        const duplicateMeeting = existingMeetings.find(meeting => 
          meeting.description && meeting.description.includes(`(ID: ${req.body.recordingId})`)
        );
        
        if (duplicateMeeting) {
          return res.json(duplicateMeeting);
        }
      }
      
      const meetingData = {
        ...req.body,
        createdById: userId,
        scheduledAt: req.body.scheduledAt ? new Date(req.body.scheduledAt) : new Date(),
      };
      
      // Remove recordingId from data as it's not part of the schema
      delete meetingData.recordingId;
      
      const meeting = await storage.createMeeting(meetingData);
      res.json(meeting);
    } catch (error: any) {
      console.error("Meeting creation error:", error);
      res.status(400).json({ message: "Invalid meeting data", error: error.message });
    }
  });

  // External Meetings API endpoints
  app.get("/api/external-meetings", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const { projectId } = req.query;
      const meetings = await storage.getExternalMeetings(userId, projectId as string);
      
      // Return dates as ISO strings for proper client handling
      const fixedMeetings = meetings.map(meeting => ({
        ...meeting,
        startTime: meeting.startTime.toISOString(),
        endTime: meeting.endTime.toISOString(),
        createdAt: meeting.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: meeting.updatedAt?.toISOString() || new Date().toISOString()
      }));
      
      res.json(fixedMeetings);
    } catch (error) {
      console.error("Failed to fetch external meetings:", error);
      res.status(500).json({ message: "Failed to fetch external meetings" });
    }
  });

  app.post("/api/external-meetings", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      
      const meetingData = {
        ...req.body,
        userId,
        startTime: new Date(req.body.startTime),
        endTime: new Date(req.body.endTime),
      };
      
      const meeting = await storage.createExternalMeeting(meetingData);
      res.json(meeting);
    } catch (error: any) {
      console.error("External meeting creation error:", error);
      res.status(400).json({ message: "Invalid external meeting data", error: error.message });
    }
  });

  app.put("/api/external-meetings/:id/link-project", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const meetingIdOrExternalId = req.params.id;
      const { projectId, meetingData } = req.body;
      
      // Check if this is an Outlook meeting that needs to be created first
      let meeting;
      if (meetingIdOrExternalId.startsWith('outlook-')) {
        const externalId = meetingIdOrExternalId.replace('outlook-', '');
        
        // Try to find existing external meeting by externalId
        meeting = await storage.getExternalMeetingByExternalId(externalId, userId);
        
        // If not found and we have meeting data, create it
        if (!meeting && meetingData) {
          meeting = await storage.createExternalMeeting({
            userId,
            externalId,
            title: meetingData.title,
            description: meetingData.description || '',
            startTime: new Date(meetingData.startTime),
            endTime: new Date(meetingData.endTime),
            location: meetingData.location || '',
            source: 'outlook',
            projectId: null // Will be set below
          });
        } else if (!meeting) {
          return res.status(400).json({ message: "Meeting data is required to link Outlook meetings" });
        }
      } else {
        // Regular UUID lookup
        meeting = await storage.getExternalMeeting(meetingIdOrExternalId);
        if (!meeting) {
          return res.status(404).json({ message: "External meeting not found" });
        }
      }
      
      if (!meeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }
      
      if (meeting.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to modify this meeting" });
      }
      
      // Verify project belongs to user if projectId is provided
      if (projectId) {
        const project = await storage.getProject(projectId);
        if (!project) {
          return res.status(404).json({ message: "Project not found" });
        }
        
        // Check if user has access to this project (owner or member)
        const userProjects = await storage.getProjects(userId);
        const hasAccess = userProjects.some(p => p.id === projectId);
        if (!hasAccess) {
          return res.status(403).json({ message: "Not authorized to link to this project" });
        }
      }
      
      const updatedMeeting = await storage.linkExternalMeetingToProject(meeting.id, projectId);
      
      // 🔄 CRITICAL: Update the cache with the new project link AND project name
      const cacheKey = `${userId}-`;
      let updatedCache = false;
      
      // Fetch project name if projectId exists
      let projectName: string | undefined;
      if (updatedMeeting.projectId) {
        try {
          const project = await storage.getProject(updatedMeeting.projectId);
          projectName = project?.name;
          console.log(`📂 Fetched project name: "${projectName}" for projectId: ${updatedMeeting.projectId}`);
        } catch (error) {
          console.error('Error fetching project name:', error);
        }
      }
      
      // Find and update existing cache entries with the new project link
      outlookEventCache.forEach((cacheData, key) => {
        if (key.startsWith(cacheKey)) {
          const updatedEvents = cacheData.events.map(event => {
            if (event.id === updatedMeeting.externalId) {
              console.log(`📝 Updating cached event "${event.title}" with projectId: ${updatedMeeting.projectId}, projectName: "${projectName}"`);
              return {
                ...event,
                projectId: updatedMeeting.projectId,
                projectName: projectName,
                dbId: updatedMeeting.id
              };
            }
            return event;
          });
          
          // Update the cache with the modified events
          outlookEventCache.set(key, {
            events: updatedEvents,
            timestamp: cacheData.timestamp
          });
          updatedCache = true;
          console.log(`✅ Cache updated for key: ${key}`);
        }
      });
      
      if (!updatedCache) {
        console.log(`⚠️ No cache found to update, clearing cache to force fresh fetch`);
        // If no cache exists, clear any stale entries
        const keysToDelete: string[] = [];
        outlookEventCache.forEach((value, key) => {
          if (key.startsWith(cacheKey)) {
            keysToDelete.push(key);
          }
        });
        keysToDelete.forEach(key => {
          outlookEventCache.delete(key);
          console.log(`🗑️ Deleted stale cache key: ${key}`);
        });
      }
      
      res.json(updatedMeeting);
    } catch (error: any) {
      console.error("Failed to link external meeting to project:", error);
      res.status(500).json({ message: "Failed to link meeting to project", error: error.message });
    }
  });

  app.delete("/api/external-meetings/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const meetingId = req.params.id;
      
      // Verify meeting belongs to user
      const meeting = await storage.getExternalMeeting(meetingId);
      if (!meeting) {
        return res.status(404).json({ message: "External meeting not found" });
      }
      
      if (meeting.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to delete this meeting" });
      }
      
      await storage.deleteExternalMeeting(meetingId);
      res.json({ message: "External meeting deleted successfully" });
    } catch (error: any) {
      console.error("Failed to delete external meeting:", error);
      res.status(500).json({ message: "Failed to delete external meeting", error: error.message });
    }
  });

  // Voice Recording & AI Processing
  // Update meeting endpoint
  app.put("/api/meetings/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, "");
      const meetingId = req.params.id;
      
      // Verify meeting belongs to user before updating
      const meeting = await storage.getMeeting(meetingId);
      if (!meeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }
      
      if (meeting.createdById !== userId) {
        return res.status(403).json({ message: "Not authorized to update this meeting" });
      }
      
      const updateData = {
        ...req.body,
        scheduledAt: req.body.scheduledAt ? new Date(req.body.scheduledAt) : undefined,
      };
      
      const updatedMeeting = await storage.updateMeeting(meetingId, updateData);
      res.json(updatedMeeting);
    } catch (error: any) {
      console.error("Failed to update meeting:", error);
      res.status(500).json({ message: "Failed to update meeting", error: error.message });
    }
  });

  // Batch delete meetings endpoint (must be BEFORE single delete to avoid route conflicts)
  app.delete("/api/meetings/batch", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, "");
      const { meetingIds } = req.body;
      
      if (!meetingIds || !Array.isArray(meetingIds) || meetingIds.length === 0) {
        return res.status(400).json({ message: "Meeting IDs are required" });
      }
      
      // Verify all meetings belong to the user
      const meetings = await Promise.all(
        meetingIds.map(async (id: string) => {
          try {
            return await storage.getMeeting(id);
          } catch {
            return null;
          }
        })
      );
      
      const validMeetings = meetings.filter(
        meeting => meeting && meeting.createdById === userId
      );
      
      if (validMeetings.length === 0) {
        return res.status(404).json({ message: "No valid meetings found to delete" });
      }
      
      // Delete all valid meetings
      await Promise.all(
        validMeetings.map(meeting => meeting && storage.deleteMeeting(meeting.id))
      );
      
      res.json({ 
        message: `Successfully deleted ${validMeetings.length} meeting(s)`,
        deletedCount: validMeetings.length,
        requestedCount: meetingIds.length
      });
    } catch (error: any) {
      console.error("Batch delete meetings error:", error);
      res.status(500).json({ 
        message: "Failed to delete meetings", 
        error: error.message 
      });
    }
  });

  // Delete meeting endpoint (must be AFTER batch delete to avoid conflicts)
  app.delete("/api/meetings/:id", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, "");
      const meetingId = req.params.id;
      
      // Verify meeting belongs to user before deleting
      const meeting = await storage.getMeeting(meetingId);
      if (!meeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }
      
      if (meeting.createdById !== userId) {
        return res.status(403).json({ message: "Not authorized to delete this meeting" });
      }
      
      await storage.deleteMeeting(meetingId);
      res.json({ message: "Meeting deleted successfully" });
    } catch (error) {
      console.error("Failed to delete meeting:", error);
      res.status(500).json({ message: "Failed to delete meeting" });
    }
  });

  app.post("/api/meetings/:id/process-recording", requireAuth, async (req, res) => {
    try {
      const { audioData, projectId } = req.body;
      const meetingId = req.params.id;
      const userId = getUserId(req as any, mockUserId);

      // Enhanced debugging with more diagnostics
      console.log(`🎙️ Processing voice recording for user ${userId}, meeting ${meetingId}`);
      console.log(`Audio data received: ${audioData ? `${audioData.length} characters` : 'null/undefined'}`);
      console.log(`Audio data type: ${typeof audioData}`);
      console.log(`Request body keys: ${Object.keys(req.body)}`);
      console.log(`Request content length: ${req.get('content-length')}`);
      console.log(`Request timestamp: ${new Date().toISOString()}`);

      if (!audioData) {
        console.error(`❌ No audio data provided for meeting ${meetingId}`);
        return res.status(400).json({ 
          message: "No audio data provided",
          diagnostics: {
            bodyKeys: Object.keys(req.body),
            contentLength: req.get('content-length'),
            timestamp: new Date().toISOString()
          }
        });
      }

      if (typeof audioData !== 'string' || audioData.length === 0) {
        console.error(`❌ Invalid audio data format for meeting ${meetingId}: type=${typeof audioData}, length=${audioData?.length}`);
        return res.status(400).json({ 
          message: "Invalid audio data format",
          diagnostics: {
            dataType: typeof audioData,
            dataLength: audioData?.length,
            timestamp: new Date().toISOString()
          }
        });
      }

      // 🚫 DUPLICATE PROCESSING PROTECTION - Check if meeting already processed
      const existingMeeting = await storage.getMeeting(meetingId);
      if (existingMeeting && existingMeeting.transcription && existingMeeting.transcription.trim().length > 0) {
        console.log(`⏭️ Meeting ${meetingId} already processed - returning existing data without reprocessing`);
        console.log(`✅ Preventing duplicate email notification for meeting "${existingMeeting.title}"`);
        
        // Return existing processed data instead of reprocessing
        return res.json({
          success: true,
          meeting: existingMeeting,
          tasksCreated: Array.isArray(existingMeeting.extractedTasks) ? existingMeeting.extractedTasks.length : 0,
          extractedTasks: existingMeeting.extractedTasks || [],
          transcription: existingMeeting.transcription,
          aiSummary: existingMeeting.aiSummary,
          alreadyProcessed: true // Flag to indicate this was already processed
        });
      }
      
      // Add timeout for processing large files (extended for 45+ minute recordings)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Recording processing timeout - file may be too large')), 900000); // 15 minute timeout for long recordings
      });

      // Get high-quality transcription with AssemblyAI (mobile-optimized) with timeout
      console.log("Using AssemblyAI for professional mobile transcription...");
      const { transcriptionService: ts } = await import("./services/transcription");
      const transcriptionResult = await Promise.race([
        ts.transcribeAudio(audioData),
        timeoutPromise
      ]) as any;
      const transcription = transcriptionResult.text;
      
      if (!transcription || transcription.trim().length === 0) {
        return res.status(400).json({ message: "No transcription generated from audio" });
      }
      
      // Extract tasks using AI
      const extractedTasks = await aiService.extractTasksFromText(transcription);
      
      // Generate meeting summary
      const summary = await aiService.generateMeetingSummary(transcription);

      // Update meeting with results
      const meeting = await storage.updateMeeting(meetingId, {
        transcription,
        aiSummary: summary,
        extractedTasks: extractedTasks,
      });

      // Create tasks with enhanced logic and duplicate prevention
      let createdTasks = [];
      if (projectId && extractedTasks && extractedTasks.length > 0) {
        // Get existing tasks for this project to check for duplicates
        const existingTasks = await storage.getTasks(projectId);
        
        for (const taskData of extractedTasks) {
          // Check for duplicate tasks using similarity matching
          const isDuplicate = existingTasks.some(existingTask => {
            // Exact title match (case insensitive)
            if (existingTask.title.toLowerCase().trim() === taskData.title.toLowerCase().trim()) {
              return true;
            }
            
            // High similarity check (80% similarity threshold)
            const similarity = calculateStringSimilarity(
              existingTask.title.toLowerCase(), 
              taskData.title.toLowerCase()
            );
            
            if (similarity > 0.8) {
              return true;
            }
            
            // Check description similarity if both exist
            if (existingTask.description && taskData.description) {
              const descSimilarity = calculateStringSimilarity(
                existingTask.description.toLowerCase(),
                taskData.description.toLowerCase()
              );
              if (descSimilarity > 0.85) {
                return true;
              }
            }
            
            return false;
          });
          
          if (isDuplicate) {
            console.log(`⏭️ Skipping duplicate task: "${taskData.title}"`);
            continue;
          }
          
          // Set due date: use AI-extracted date if available, otherwise default to 7 days from creation
          let dueDate = null;
          if (taskData.dueDate && !isNaN(Date.parse(taskData.dueDate))) {
            dueDate = new Date(taskData.dueDate);
          } else {
            // Auto-set 7-day due date for tasks generated from voice recordings
            dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 7);
          }

          const task = await storage.createTask({
            title: taskData.title,
            description: taskData.description || taskData.title,
            projectId,
            priority: taskData.priority || 'medium',
            assigneeId: userId,
            dueDate: dueDate,
          });
          createdTasks.push(task);
          console.log(`✅ Created new task: "${taskData.title}"`);
        }

        // Send intelligent email notification about the meeting
        const project = await storage.getProject(projectId);
        const user = await storage.getUser(userId);
        if (project && user?.email) {
          try {
            await (emailService as any).sendMeetingProcessedNotification(
              user.email,
              meeting.title || "Meeting",
              project.name,
              createdTasks.length,
              summary.substring(0, 200) + "..."
            );
          } catch (emailError) {
            console.log("Meeting notification email failed:", emailError);
          }
        }
      }

      res.json({ 
        success: true,
        meeting, 
        tasksCreated: createdTasks.length,
        extractedTasks: extractedTasks,
        transcription: transcription,
        aiSummary: summary
      });
    } catch (error: any) {
      console.error('Processing recording error:', error);
      res.status(500).json({ 
        message: "Failed to process recording", 
        error: error.message || "Unknown error"
      });
    }
  });

  // Meeting preparation endpoint - generates smart talking points
  app.post("/api/meetings/:id/preparation", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const meetingId = req.params.id;
      
      const meeting = await storage.getMeeting(meetingId);
      if (!meeting) {
        return res.status(404).json({ message: "Meeting not found" });
      }

      // Check if user has access to this meeting's project
      if (meeting.projectId) {
        const userProjects = await storage.getProjects(userId);
        const hasAccess = userProjects.some(p => p.id === meeting.projectId);
        if (!hasAccess) {
          return res.status(403).json({ message: "Not authorized to access this meeting" });
        }
      }

      const preparation = await aiService.generateMeetingPreparation(
        meeting,
        meeting.projectId!,
        userId,
        [] // Database meetings don't have attendee emails from calendar
      );

      res.json({ preparation });
    } catch (error: any) {
      console.error("Meeting preparation error:", error);
      res.status(500).json({ message: "Failed to generate meeting preparation", error: error.message });
    }
  });

  // Comprehensive meeting preparation endpoint - analyzes all projects and tasks
  app.post("/api/meetings/comprehensive-preparation", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      
      // Create a mock meeting object for comprehensive analysis
      const comprehensiveMeeting = {
        id: 'comprehensive',
        title: 'Overall Project Review',
        description: 'Comprehensive analysis of all projects and tasks',
        scheduledAt: new Date(),
        projectId: null
      };

      const preparation = await aiService.generateMeetingPreparation(
        comprehensiveMeeting,
        null, // null triggers comprehensive mode
        userId,
        [] // Comprehensive meetings don't have specific attendees
      );

      res.json({ preparation });
    } catch (error: any) {
      console.error("Comprehensive meeting preparation error:", error);
      res.status(500).json({ message: "Failed to generate comprehensive meeting preparation", error: error.message });
    }
  });

  // Project-specific meeting preparation endpoint
  app.post("/api/projects/:projectId/meeting-preparation", requireAuth, async (req, res) => {
    try {
      const { projectId } = req.params;
      const userId = getUserId(req as any, mockUserId);
      console.log(`🔍 Generating project meeting preparation for project: ${projectId}, user: ${userId}`);
      
      // Verify project belongs to user
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      // Check if user has access to this project
      const userProjects = await storage.getProjects(userId);
      const hasAccess = userProjects.some(p => p.id === projectId);
      if (!hasAccess) {
        return res.status(403).json({ message: "Not authorized to access this project" });
      }
      
      console.log(`🤖 Calling AI service for project-specific preparation...`);
      const { aiService } = await import('./services/ai');
      const preparation = await aiService.generateProjectMeetingPreparation(projectId, userId);
      
      console.log(`✅ Generated project preparation: ${preparation ? 'HAS_CONTENT' : 'EMPTY'}`);  
      res.json({ preparation });
    } catch (error: any) {
      console.error("Project meeting preparation error:", error);
      res.status(500).json({ message: "Failed to generate project meeting preparation", error: error.message });
    }
  });


  // ===== OUTLOOK MEETING PREPARATION - MUST BE FIRST =====
  app.post("/api/outlook/events/:eventId/preparation", async (req, res) => {
    console.log(`🎯 OUTLOOK PREPARATION ENDPOINT HIT for event: ${req.params.eventId}`);
    console.log(`🎯 ENDPOINT HIT: Outlook event preparation request starting...`);
    console.log(`🎯 Event ID: ${req.params.eventId}`);
    console.log(`🔐 Request headers:`, Object.keys(req.headers));
    console.log(`🔐 Session data:`, req.session?.userId ? 'HAS_SESSION' : 'NO_SESSION');
    try {
      // Get user ID with better error handling
      let userId: string;
      try {
        userId = getUserId(req as any, mockUserId);
        console.log(`🔐 User ID resolved:`, userId ? 'SUCCESS' : 'FAILED');
      } catch (error) {
        console.log(`❌ getUserId failed:`, error);
        return res.status(401).json({ preparation: "Authentication required" });
      }
      
      const eventId = req.params.eventId;
      
      console.log(`🎯 Meeting prep request RECEIVED for Outlook event: ${eventId} by user: ${userId}`);
      
      // Get user settings to check Outlook configuration
      console.log(`🔍 Checking user settings for Outlook configuration...`);
      const settings = await storage.getUserSettings(userId);
      console.log(`📋 User settings:`, settings ? 'FOUND' : 'NULL', settings?.outlookCalendarEnabled ? 'ENABLED' : 'NOT_ENABLED');
      
      if (!settings?.outlookCalendarEnabled || !settings?.outlookCalendarUrl) {
        console.log(`❌ Outlook not configured properly for user ${userId}`);
        return res.status(400).json({ message: "Outlook calendar not configured" });
      }

      // Get Outlook events for this user
      const { CalendarSyncService } = await import('./services/calendar-sync');
      const events = await CalendarSyncService.fetchOutlookEvents(settings.outlookCalendarUrl);
      
      // Find the specific event
      const event = events.find(e => e.id === eventId);
      if (!event) {
        return res.status(404).json({ message: "Outlook event not found" });
      }
      
      // First check if this external meeting is linked to a project
      let linkedProject = null;
      let matchedProject = null;
      
      console.log(`🔍 Checking for linked external meeting with eventId: ${eventId}`);
      console.log(`🔍 EventId length: ${eventId.length}, UserId: ${userId}`);
      const externalMeeting = await storage.getExternalMeetingByExternalId(eventId, userId);
      console.log(`🔍 External meeting lookup result:`, externalMeeting ? `FOUND (projectId: ${externalMeeting.projectId})` : 'NOT FOUND');
      
      if (externalMeeting && externalMeeting.projectId) {
        console.log(`🎯 Found linked external meeting! ProjectId: ${externalMeeting.projectId}`);
        linkedProject = await storage.getProject(externalMeeting.projectId);
        if (linkedProject) {
          console.log(`📋 Using linked project for meeting prep: ${linkedProject.name}`);
          matchedProject = linkedProject;
        }
      } else {
        console.log(`🔍 No linked external meeting found, trying project name matching...`);
        // Fallback: Try to match meeting title with existing projects for context
        const userProjects = await storage.getProjects(userId);
        
        // Look for project name in meeting title or description
        for (const project of userProjects) {
          const titleLower = event.title.toLowerCase();
          const projectNameLower = project.name.toLowerCase();
          
          if (titleLower.includes(projectNameLower) || 
              projectNameLower.includes(titleLower) ||
              (event.description && event.description.toLowerCase().includes(projectNameLower))) {
            matchedProject = project;
            console.log(`📎 Matched Outlook meeting "${event.title}" with project "${project.name}"`);
            break;
          }
        }
      }
      
      // Create a meeting-like object for the AI service
      const meetingLikeEvent = {
        id: event.id,
        title: event.title,
        description: event.description || '',
        scheduledAt: event.start.toISOString(),
        duration: Math.round((event.end.getTime() - event.start.getTime()) / (1000 * 60)),
        projectId: null, // Outlook events don't have project associations
        createdById: userId
      };
      
      // Generate meeting preparation using the AI service with matched project context
      const projectId = matchedProject ? matchedProject.id : null;
      console.log(`🔄 Calling AI service for ${projectId ? 'project-focused' : 'meeting-specific'} preparation...`);
      console.log(`📋 Event data:`, { 
        title: meetingLikeEvent.title, 
        userId, 
        matchedProject: matchedProject?.name || 'None',
        attendeeCount: event.attendees?.length || 0
      });
      
      const preparation = await aiService.generateMeetingPreparation(
        meetingLikeEvent,
        projectId, // Use matched project ID if found, null for meeting-specific (not comprehensive) mode
        userId,
        event.attendees || [] // Pass attendee emails for smart action item analysis
      );
      console.log(`✅ Preparation generated successfully, length: ${preparation?.length || 0}`);
      
      console.log(`🎯 AI service returned:`, typeof preparation, preparation ? preparation.length + ' chars' : 'NULL/EMPTY');
      console.log(`📤 Sending meeting prep response for event ${eventId}:`, { preparation: preparation ? 'HAS_CONTENT' : 'EMPTY' });
      console.log(`📋 Full preparation content preview:`, preparation?.substring(0, 100) + '...');
      
      // Ensure the response object is properly formed and send immediately
      if (!preparation) {
        console.log(`❌ No preparation content generated`);
        return res.json({ preparation: "No preparation content was generated. Please try again." });
      }
      
      console.log(`✅ Sending successful response with ${preparation.length} characters`);
      return res.status(200).json({ 
        preparation: preparation,
        success: true,
        length: preparation.length 
      });
    } catch (error: any) {
      console.error('❌ Outlook event preparation error:', error);
      console.error('❌ Error stack:', error.stack);
      return res.status(500).json({ 
        message: "Failed to generate meeting preparation for Outlook event", 
        error: error.message,
        preparation: "Error occurred while generating preparation. Please try again."
      });
    }
  });

  // Debug all outlook/events requests (after specific routes)
  app.use("/api/outlook/events/*", (req, res, next) => {
    console.log(`🔍 DEBUG: Unmatched outlook request - Method: ${req.method}, URL: ${req.originalUrl}`);
    next();
  });

  // AI Insights endpoints
  app.get("/api/ai/project-insights/:projectId", requireAuth, async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const project = await storage.getProject(projectId);
      const tasks = await storage.getTasks(projectId);
      
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const insights = await aiService.generateProjectInsights(project, tasks);
      res.json(insights);
    } catch (error: any) {
      console.error("AI insights error:", error);
      res.status(500).json({ message: error.message || "Failed to generate insights" });
    }
  });

  app.get("/api/ai/notifications", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const projects = await storage.getProjects(userId);
      const allTasks = [];
      
      for (const project of projects) {
        const projectTasks = await storage.getTasks(project.id);
        allTasks.push(...projectTasks);
      }
      
      const notifications = await aiService.generateSmartNotifications(projects, allTasks, userId);
      res.json(notifications);
    } catch (error: any) {
      console.error("AI notifications error:", error);
      res.status(500).json({ message: error.message || "Failed to generate notifications" });
    }
  });

  app.get("/api/ai/daily-summary", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const projects = await storage.getProjects(userId);
      const allTasks = [];
      
      for (const project of projects) {
        const projectTasks = await storage.getTasks(project.id);
        allTasks.push(...projectTasks);
      }
      
      const summary = await aiService.generateSmartDailyBriefing(projects, allTasks, userId);
      res.json(summary);
    } catch (error: any) {
      console.error("AI daily summary error:", error);
      res.status(500).json({ message: error.message || "Failed to generate daily summary" });
    }
  });

  app.get("/api/ai/overall-insights", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const projects = await storage.getProjects(userId);
      const allTasks = [];
      
      for (const project of projects) {
        const projectTasks = await storage.getTasks(project.id);
        allTasks.push(...projectTasks);
      }
      
      const completedTasks = allTasks.filter(t => t.status === 'completed').length;
      const totalTasks = allTasks.length;
      const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
      
      const upcomingDeadlines = allTasks.filter(task => {
        if (!task.dueDate) return false;
        const dueDate = new Date(task.dueDate);
        const daysUntilDue = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 3600 * 24));
        return daysUntilDue >= 0 && daysUntilDue <= 7;
      }).length;
      
      const overallInsights = {
        productivityTrend: Math.max(-50, Math.min(50, Math.round((completionRate - 50) / 2))),
        burnoutRisk: upcomingDeadlines > 5 ? "High" : upcomingDeadlines > 2 ? "Medium" : "Low",
        teamEfficiency: Math.round(completionRate),
        upcomingDeadlines
      };
      
      res.json(overallInsights);
    } catch (error: any) {
      console.error("AI overall insights error:", error);
      res.status(500).json({ message: error.message || "Failed to generate overall insights" });
    }
  });

  // Notifications
  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const notifications = await storage.getNotifications(userId);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.put("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      await storage.markNotificationRead(req.params.id);
      res.json({ message: "Notification marked as read" });
    } catch (error) {
      res.status(500).json({ message: "Failed to update notification" });
    }
  });

  // User Settings
  app.get("/api/settings", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const settings = await storage.getUserSettings(userId);
      res.json(settings || {});
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.put("/api/settings", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const settingsData = insertUserSettingsSchema.partial().parse(req.body);
      const settings = await storage.updateUserSettings(userId, settingsData);
      res.json(settings);
    } catch (error) {
      res.status(400).json({ message: "Invalid settings data" });
    }
  });

  app.post("/api/settings/test-email", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Send a test email using the email service
      await emailService.sendTestEmail(user.email);

      res.json({ 
        message: "Test email sent successfully",
        sentTo: user.email 
      });
    } catch (error: any) {
      console.error("Error sending test email:", error);
      res.status(500).json({ 
        message: "Failed to send test email", 
        error: error.message 
      });
    }
  });

  // AI-powered email endpoints
  app.post("/api/ai/send-notification-email", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const user = await storage.getUser(userId);
      const { type, email: requestedEmail } = req.body;
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const targetEmail = requestedEmail || user.email;
      
      if (type === 'daily_summary') {
        const projects = await storage.getProjects(userId);
        const allTasks = [];
        
        for (const project of projects) {
          const projectTasks = await storage.getTasks(project.id);
          allTasks.push(...projectTasks);
        }
        
        const summary = await aiService.generateDailySummary(projects, allTasks, userId);
        await emailService.sendDailySummary(targetEmail, summary);
        
        res.json({ 
          message: "Daily summary email sent successfully",
          sentTo: targetEmail
        });
      } else if (type === 'test_email') {
        await emailService.sendTestEmail(targetEmail);
        
        res.json({ 
          message: "Test email sent successfully",
          sentTo: targetEmail
        });
      } else {
        res.status(400).json({ message: "Invalid email type" });
      }
    } catch (error: any) {
      console.error("AI notification email error:", error);
      res.status(500).json({ 
        message: "Failed to send notification email",
        error: error.message 
      });
    }
  });
  
  app.post("/api/ai/notify-project-members/:projectId", requireAuth, async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const { type, message } = req.body;
      
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      const members = await storage.getProjectMembers(projectId);
      const emailsSent = [];
      
      // Notify project owner
      const owner = await storage.getUser(project.ownerId);
      if (owner?.email) {
        await emailService.sendProjectAlert(owner.email, project.name, type, message);
        emailsSent.push(owner.email);
      }
      
      // Notify all project members
      for (const member of members) {
        const memberUser = await storage.getUser(member.userId);
        if (memberUser?.email) {
          await emailService.sendProjectAlert(memberUser.email, project.name, type, message);
          emailsSent.push(memberUser.email);
        }
      }
      
      res.json({ 
        message: `Notifications sent to ${emailsSent.length} project members`,
        emailsSent: emailsSent.length,
        recipients: emailsSent
      });
    } catch (error: any) {
      console.error("Project member notification error:", error);
      res.status(500).json({ 
        message: "Failed to notify project members",
        error: error.message 
      });
    }
  });

  // ===============================================
  // ADVANCED ANALYTICS ENDPOINTS
  // ===============================================

  // Project Success Prediction
  app.get("/api/analytics/project-prediction/:projectId", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const projectId = req.params.projectId;
      
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      // Verify user has access to this project
      if (project.ownerId !== userId) {
        const members = await storage.getProjectMembers(projectId);
        const hasAccess = members.some(member => member.userId === userId);
        if (!hasAccess) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      const tasks = await storage.getTasks(projectId);
      const members = await storage.getProjectMembers(projectId);
      const teamMembers = [];
      
      // Get team member details
      for (const member of members) {
        const user = await storage.getUser(member.userId);
        if (user) teamMembers.push(user);
      }
      
      const prediction = await analyticsService.generateProjectSuccessPrediction(
        project, 
        tasks, 
        teamMembers
      );
      
      res.json(prediction);
    } catch (error: any) {
      console.error("Project prediction error:", error);
      res.status(500).json({ 
        message: "Failed to generate project prediction",
        error: error.message 
      });
    }
  });

  // Workload Analysis for User
  app.get("/api/analytics/workload-analysis", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const projects = await storage.getProjects(userId);
      
      // Get all tasks across all user projects
      const allTasks = [];
      for (const project of projects) {
        const projectTasks = await storage.getTasks(project.id);
        allTasks.push(...projectTasks);
      }
      
      const workloadAnalysis = await analyticsService.analyzeWorkload(
        userId,
        allTasks,
        projects
      );
      
      res.json(workloadAnalysis);
    } catch (error: any) {
      console.error("Workload analysis error:", error);
      res.status(500).json({ 
        message: "Failed to analyze workload",
        error: error.message 
      });
    }
  });

  // Team Resource Optimization
  app.get("/api/analytics/resource-optimization", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const projects = await storage.getProjects(userId);
      
      // Get all tasks and team members from user's projects
      const allTasks = [];
      const allUsers = new Set<string>();
      
      for (const project of projects) {
        const projectTasks = await storage.getTasks(project.id);
        const projectMembers = await storage.getProjectMembers(project.id);
        
        allTasks.push(...projectTasks);
        allUsers.add(project.ownerId);
        projectMembers.forEach(member => allUsers.add(member.userId));
      }
      
      // Get user details
      const teamMembers = [];
      for (const userId of Array.from(allUsers)) {
        const user = await storage.getUser(userId);
        if (user) teamMembers.push(user);
      }
      
      const optimization = await analyticsService.optimizeResourceAllocation(
        projects,
        allTasks,
        teamMembers
      );
      
      res.json(optimization);
    } catch (error: any) {
      console.error("Resource optimization error:", error);
      res.status(500).json({ 
        message: "Failed to optimize resources",
        error: error.message 
      });
    }
  });

  // Project Analytics Dashboard
  app.get("/api/analytics/project/:projectId", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const projectId = req.params.projectId;
      
      const project = await storage.getProject(projectId);
      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      // Verify user has access to this project
      if (project.ownerId !== userId) {
        const members = await storage.getProjectMembers(projectId);
        const hasAccess = members.some(member => member.userId === userId);
        if (!hasAccess) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      const tasks = await storage.getTasks(projectId);
      const analytics = await analyticsService.generateProjectAnalytics(project, tasks);
      
      res.json(analytics);
    } catch (error: any) {
      console.error("Project analytics error:", error);
      res.status(500).json({ 
        message: "Failed to generate project analytics",
        error: error.message 
      });
    }
  });

  // Overall Analytics Dashboard
  app.get("/api/analytics/dashboard", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const projects = await storage.getProjects(userId);
      
      const allTasks = [];
      const projectPredictions = [];
      
      // Generate analytics for each project
      for (const project of projects) {
        const projectTasks = await storage.getTasks(project.id);
        const members = await storage.getProjectMembers(project.id);
        const teamMembers = [];
        
        // Get team member details
        for (const member of members) {
          const user = await storage.getUser(member.userId);
          if (user) teamMembers.push(user);
        }
        
        allTasks.push(...projectTasks);
        
        // Generate success prediction for each project
        const prediction = await analyticsService.generateProjectSuccessPrediction(
          project,
          projectTasks,
          teamMembers
        );
        projectPredictions.push(prediction);
      }
      
      // Get workload analysis
      const workloadAnalysis = await analyticsService.analyzeWorkload(
        userId,
        allTasks,
        projects
      );
      
      // Calculate overall metrics
      const totalTasks = allTasks.length;
      const completedTasks = allTasks.filter(t => t.status === 'completed').length;
      const overdueTasks = allTasks.filter(t => 
        t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed'
      ).length;
      
      const avgSuccessProbability = projectPredictions.length > 0 
        ? Math.round(projectPredictions.reduce((sum, p) => sum + p.successProbability, 0) / projectPredictions.length)
        : 0;
      
      const dashboard = {
        overview: {
          totalProjects: projects.length,
          totalTasks,
          completedTasks,
          overdueTasks,
          completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
          avgSuccessProbability
        },
        workload: workloadAnalysis,
        projectPredictions: projectPredictions.slice(0, 5), // Top 5 projects
        riskAlerts: projectPredictions
          .filter(p => p.successProbability < 60)
          .map(p => ({
            projectId: p.projectId,
            projectName: projects.find(proj => proj.id === p.projectId)?.name || 'Unknown',
            risk: p.successProbability,
            factors: p.riskFactors.slice(0, 2)
          })),
        recommendations: [
          ...workloadAnalysis.recommendations,
          ...projectPredictions.flatMap(p => p.recommendations).slice(0, 3)
        ].slice(0, 5)
      };
      
      res.json(dashboard);
    } catch (error: any) {
      console.error("Analytics dashboard error:", error);
      res.status(500).json({ 
        message: "Failed to generate analytics dashboard",
        error: error.message 
      });
    }
  });

  // Burnout Risk Assessment
  app.get("/api/analytics/burnout-assessment/:userId?", requireAuth, async (req, res) => {
    try {
      const requesterId = getUserId(req as any, mockUserId);
      const targetUserId = req.params.userId || requesterId;
      
      // Only allow users to view their own burnout data unless they're a project owner
      if (targetUserId !== requesterId) {
        const projects = await storage.getProjects(requesterId);
        const isOwner = projects.length > 0; // Simplified - in production, check if requester owns projects with target user
        
        if (!isOwner) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
      
      const projects = await storage.getProjects(targetUserId);
      const allTasks = [];
      
      for (const project of projects) {
        const projectTasks = await storage.getTasks(project.id);
        allTasks.push(...projectTasks);
      }
      
      const workloadAnalysis = await analyticsService.analyzeWorkload(
        targetUserId,
        allTasks,
        projects
      );
      
      const burnoutAssessment = {
        userId: targetUserId,
        riskLevel: workloadAnalysis.burnoutRisk,
        workloadScore: workloadAnalysis.workloadScore,
        weeklyHours: workloadAnalysis.weeklyHours,
        recommendations: workloadAnalysis.recommendations,
        taskBreakdown: workloadAnalysis.taskDistribution,
        optimalCapacity: workloadAnalysis.optimalCapacity,
        interventionRequired: workloadAnalysis.burnoutRisk === 'High' || workloadAnalysis.burnoutRisk === 'Critical'
      };
      
      res.json(burnoutAssessment);
    } catch (error: any) {
      console.error("Burnout assessment error:", error);
      res.status(500).json({ 
        message: "Failed to assess burnout risk",
        error: error.message 
      });
    }
  });

  // Outlook Calendar Integration via Shared URL
  app.post("/api/outlook/configure", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const { calendarUrl, enabled } = req.body;
      
      // Handle disconnect case (when enabled is false and no calendarUrl provided)
      if (enabled === false) {
        console.log(`📅 Disconnecting calendar sync for user ${userId}`);
        
        // Clear all cached events for this user
        const keysToDelete: string[] = [];
        outlookEventCache.forEach((value, key) => {
          if (key.startsWith(`${userId}-`)) {
            keysToDelete.push(key);
          }
        });
        keysToDelete.forEach(key => outlookEventCache.delete(key));
        
        console.log(`🗑️ Cleared ${keysToDelete.length} cached calendar entries`);
        
        // Update settings to disable calendar sync
        const settings = await storage.updateUserSettings(userId, {
          outlookCalendarEnabled: false,
          // Optionally clear the URL when disconnecting
          outlookCalendarUrl: null,
        });

        return res.json({
          message: "Calendar sync disconnected successfully",
          settings: {
            outlookCalendarUrl: settings.outlookCalendarUrl,
            outlookCalendarEnabled: settings.outlookCalendarEnabled,
          }
        });
      }
      
      if (!calendarUrl || typeof calendarUrl !== 'string') {
        return res.status(400).json({ message: "Calendar URL is required" });
      }

      const { CalendarSyncService } = await import('./services/calendar-sync');
      
      // Auto-fix common URL issues
      const fixedUrl = CalendarSyncService.fixCalendarUrl(calendarUrl);
      
      if (!CalendarSyncService.isValidCalendarUrl(fixedUrl)) {
        return res.status(400).json({ 
          message: "Invalid calendar URL format. Make sure it's an Outlook calendar URL ending with .ics" 
        });
      }

      // Clear any existing cached events when reconfiguring
      const existingCacheKeys: string[] = [];
      outlookEventCache.forEach((value, key) => {
        if (key.startsWith(`${userId}-`)) {
          existingCacheKeys.push(key);
        }
      });
      existingCacheKeys.forEach(key => outlookEventCache.delete(key));
      
      console.log(`🔄 Cleared ${existingCacheKeys.length} old cache entries for calendar reconfiguration`);

      const settings = await storage.updateUserSettings(userId, {
        outlookCalendarUrl: fixedUrl,
        outlookCalendarEnabled: enabled !== false,
      });

      res.json({
        message: fixedUrl !== calendarUrl ? 
          "Outlook calendar configured successfully (URL auto-corrected to .ics format)" : 
          "Outlook calendar configured successfully",
        settings: {
          outlookCalendarUrl: settings.outlookCalendarUrl,
          outlookCalendarEnabled: settings.outlookCalendarEnabled,
        }
      });
    } catch (error) {
      console.error('Outlook configure error:', error);
      res.status(500).json({ message: "Failed to configure Outlook calendar" });
    }
  });

  app.post("/api/outlook/test", requireAuth, async (req, res) => {
    try {
      const { calendarUrl } = req.body;
      
      if (!calendarUrl) {
        return res.status(400).json({ message: "Calendar URL is required" });
      }

      const { CalendarSyncService } = await import('./services/calendar-sync');
      
      const events = await CalendarSyncService.fetchOutlookEvents(calendarUrl);
      
      res.json({
        success: true,
        eventCount: events.length,
        preview: events.slice(0, 3).map(e => ({
          title: e.title,
          start: e.start,
          location: e.location
        }))
      });
    } catch (error) {
      console.error('Outlook test error:', error);
      res.status(400).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to test calendar URL" 
      });
    }
  });

  // ICS File Upload endpoint  
  app.post("/api/calendar/upload-ics", requireAuth, async (req, res) => {
    try {
      const { fileContent, fileName } = req.body;
      
      if (!fileContent || typeof fileContent !== 'string') {
        return res.status(400).json({ message: "ICS file content is required" });
      }

      const { IcsParserService } = await import('./services/ics-parser');
      
      // Validate ICS file format
      if (!IcsParserService.validateIcsFile(fileContent)) {
        return res.status(400).json({ 
          message: "Invalid ICS file format. Please make sure you uploaded a valid calendar file." 
        });
      }

      // Parse events from ICS file
      const events = IcsParserService.parseIcsContent(fileContent);
      const stats = IcsParserService.getFileStats(fileContent);
      
      if (events.length === 0) {
        return res.status(400).json({ 
          message: "No events found in the calendar file." 
        });
      }

      // Store the parsed events (in a real app, you'd save these to the database)
      // For now, we'll just return the stats
      res.json({
        message: "Calendar file processed successfully!",
        stats: {
          fileName: fileName || 'calendar.ics',
          eventCount: stats.eventCount,
          dateRange: stats.dateRange,
          sampleEvents: events.slice(0, 3).map(e => ({
            title: e.title,
            start: e.start,
            location: e.location
          }))
        }
      });
    } catch (error) {
      console.error('ICS upload error:', error);
      res.status(500).json({ message: "Failed to process calendar file" });
    }
  });

  // OAuth connection endpoint (preview/placeholder)
  app.post("/api/outlook/oauth/connect", requireAuth, async (req, res) => {
    try {
      // This is a placeholder for OAuth functionality
      // In a real implementation, this would:
      // 1. Generate OAuth authorization URL
      // 2. Redirect to Microsoft's OAuth endpoint
      // 3. Handle the callback with authorization code
      // 4. Exchange code for access tokens
      
      res.status(501).json({ 
        message: "OAuth connection coming soon! This feature will be available in the next update.",
        authUrl: null
      });
    } catch (error) {
      console.error('OAuth connection error:', error);
      res.status(500).json({ message: "OAuth setup not available yet" });
    }
  });

  // Simple cache for Outlook events to avoid resyncing every page load
  const outlookEventCache = new Map<string, { events: any[], timestamp: number }>();
  const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

  app.get("/api/outlook/events", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const settings = await storage.getUserSettings(userId);
      
      if (!settings?.outlookCalendarUrl || !settings.outlookCalendarEnabled) {
        return res.json([]);
      }

      const forceRefresh = req.query.refresh === 'true';
      const cacheKey = `${userId}-${settings.outlookCalendarUrl}`;
      const now = Date.now();
      
      // Check if we have cached data that's still valid
      const cached = outlookEventCache.get(cacheKey);
      if (!forceRefresh && cached && (now - cached.timestamp) < CACHE_DURATION) {
        console.log(`Serving cached Outlook events (${cached.events.length} events, cache age: ${Math.round((now - cached.timestamp) / 1000 / 60)} minutes)`);
        return res.json(cached.events);
      }

      const { CalendarSyncService } = await import('./services/calendar-sync');
      
      try {
        const events = await CalendarSyncService.fetchOutlookEvents(settings.outlookCalendarUrl);
        console.log(`Successfully synced ${events.length} Outlook events - updating cache`);
        
        // 🚀 OPTIMIZED: Batch database operations for better performance
        console.log(`⚡ Optimizing sync: Processing ${events.length} events with batch operations`);
        
        // Fetch ALL existing meetings in one query instead of individual lookups
        const existingMeetings = await storage.getExternalMeetings(userId);
        const existingMap = new Map();
        existingMeetings.forEach(meeting => {
          existingMap.set(meeting.externalId, meeting);
        });
        
        // Fetch ALL projects for this user to map projectIds to project names
        const userProjects = await storage.getProjects(userId);
        const projectMap = new Map();
        userProjects.forEach(project => {
          projectMap.set(project.id, project.name);
        });
        
        console.log(`📊 Found ${existingMeetings.length} existing meetings in database`);
        
        const processedEvents = [];
        const meetingsToUpdate = [];
        const meetingsToCreate = [];
        
        // Categorize events: update vs create
        for (const event of events) {
          const existingMeeting = existingMap.get(event.id);
          
          if (existingMeeting) {
            // Queue for batch update (preserve projectId!)
            meetingsToUpdate.push({
              id: existingMeeting.id,
              updates: {
                title: event.title,
                description: event.description,
                startTime: event.start,
                endTime: event.end,
                location: event.location,
                attendees: event.attendees || [],
                // CRITICAL: Preserve existing projectId link
                projectId: existingMeeting.projectId
              },
              event,
              projectId: existingMeeting.projectId
            });
          } else {
            // Queue for batch create
            meetingsToCreate.push({
              externalId: event.id,
              userId: userId,
              projectId: null,
              title: event.title,
              description: event.description,
              startTime: event.start,
              endTime: event.end,
              location: event.location,
              attendees: event.attendees || [],
              source: 'outlook',
              event
            });
          }
        }
        
        console.log(`🔄 Updating ${meetingsToUpdate.length} existing meetings, creating ${meetingsToCreate.length} new ones`);
        
        // Process updates (still individual but only for meetings that exist)
        for (const item of meetingsToUpdate) {
          try {
            await storage.updateExternalMeeting(item.id, item.updates);
            processedEvents.push({
              ...item.event,
              projectId: item.projectId,
              projectName: item.projectId ? projectMap.get(item.projectId) : undefined,
              dbId: item.id
            });
          } catch (error) {
            console.error(`Error updating meeting ${item.event.title}:`, error);
            processedEvents.push(item.event);
          }
        }
        
        // Process creates (batch these for better performance)
        for (const meetingData of meetingsToCreate) {
          try {
            const newMeeting = await storage.createExternalMeeting(meetingData);
            processedEvents.push({
              ...meetingData.event,
              projectId: null,
              dbId: newMeeting.id
            });
          } catch (error) {
            console.error(`Error creating meeting ${meetingData.title}:`, error);
            processedEvents.push(meetingData.event);
          }
        }
        
        // Add project names to ALL events before caching
        const eventsWithProjectNames = processedEvents.map((event: any) => {
          if (event.projectId && !event.projectName) {
            const projectName = projectMap.get(event.projectId);
            return {
              ...event,
              projectName: projectName
            };
          }
          return event;
        });
        
        // Cache the processed events with project names
        outlookEventCache.set(cacheKey, {
          events: eventsWithProjectNames,
          timestamp: now
        });
        
        console.log(`✅ Processed ${processedEvents.length} Outlook events with database persistence`);
        res.json(processedEvents);
      } catch (syncError) {
        console.error('Calendar sync failed:', syncError);
        // If we have cached data, serve it even if expired
        if (cached) {
          console.log(`Calendar sync failed, serving stale cached data (${cached.events.length} events)`);
          // Also try to serve from database as fallback
          try {
            const dbMeetings = await storage.getExternalMeetings(userId);
            if (dbMeetings.length > 0) {
              console.log(`📁 Serving ${dbMeetings.length} meetings from database as backup`);
              
              // Fetch projects for project names in fallback
              const userProjects = await storage.getProjects(userId);
              const fallbackProjectMap = new Map();
              userProjects.forEach(project => {
                fallbackProjectMap.set(project.id, project.name);
              });
              
              const dbEvents = dbMeetings.map(meeting => ({
                id: meeting.externalId,
                title: meeting.title,
                description: meeting.description,
                start: meeting.startTime,
                end: meeting.endTime,
                location: meeting.location,
                attendees: meeting.attendees as string[] || [],
                source: meeting.source,
                projectId: meeting.projectId,
                projectName: meeting.projectId ? fallbackProjectMap.get(meeting.projectId) : undefined,
                dbId: meeting.id
              }));
              return res.json(dbEvents);
            }
          } catch (dbError) {
            console.error('Database fallback failed:', dbError);
          }
          return res.json(cached.events);
        }
        // Try database as final fallback
        try {
          const dbMeetings = await storage.getExternalMeetings(userId);
          console.log(`📁 No cache available, serving ${dbMeetings.length} meetings from database`);
          const dbEvents = dbMeetings.map(meeting => ({
            id: meeting.externalId,
            title: meeting.title,
            description: meeting.description,
            start: meeting.startTime,
            end: meeting.endTime,
            location: meeting.location,
            attendees: meeting.attendees as string[] || [],
            source: meeting.source,
            projectId: meeting.projectId,
            dbId: meeting.id
          }));
          res.json(dbEvents);
        } catch (dbError) {
          console.error('Database fallback failed:', dbError);
          res.json([]);
        }
      }
    } catch (error) {
      console.error('Outlook events error:', error);
      res.status(500).json({ message: "Failed to fetch Outlook events" });
    }
  });

  app.post("/api/outlook/events/sync", requireAuth, async (req, res) => {
    try {
      const accessToken = req.headers.authorization?.replace('Bearer ', '');
      
      if (!accessToken) {
        return res.status(401).json({ message: "Outlook not connected" });
      }

      const event = await OutlookService.createCalendarEvent(accessToken, req.body);
      res.json(event);
    } catch (error) {
      console.error('Outlook create event error:', error);
      res.status(500).json({ message: "Failed to create Outlook event" });
    }
  });

  // Invitation acceptance endpoints (no auth required - token-based)
  app.get("/api/invitations/accept/:token", async (req, res) => {
    try {
      const { token } = req.params;

      // Get invitation details
      const invitation = await storage.getInvitation(token);
      
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found or invalid" });
      }

      if (invitation.status !== 'pending') {
        return res.status(400).json({ 
          message: `Invitation already ${invitation.status}`,
          status: invitation.status 
        });
      }

      if (new Date() > invitation.expiresAt) {
        await storage.updateInvitation(token, { 
          status: 'expired', 
          respondedAt: new Date() 
        });
        return res.status(400).json({ message: "Invitation has expired" });
      }

      // Check if user exists
      const existingUser = await storage.getUserByEmail(invitation.inviteeEmail);
      
      if (!existingUser) {
        // User doesn't exist - redirect to registration with token
        return res.redirect(`/register?invitation=${token}`);
      }

      // User exists - check if they're logged in via session
      const currentUserId = req.session?.userId;
      
      if (!currentUserId || currentUserId !== existingUser.id) {
        // User not logged in or logged in as different user
        return res.redirect(`/login?invitation=${token}`);
      }

      // User is logged in and valid - add to project
      const existingMembers = await storage.getProjectMembers(invitation.project.id);
      const isAlreadyMember = existingMembers.some(m => m.userId === existingUser.id);
      
      if (!isAlreadyMember) {
        await storage.addProjectMember({
          projectId: invitation.project.id,
          userId: existingUser.id,
          role: invitation.role
        });
      }

      // Mark invitation as accepted
      await storage.updateInvitation(token, { 
        status: 'accepted', 
        respondedAt: new Date() 
      });

      // Create notification for the user
      await storage.createNotification({
        userId: existingUser.id,
        title: "Project Invitation Accepted",
        message: `Welcome to "${invitation.project.name}"! You've been added as a ${invitation.role}.`,
        type: "project",
        data: { projectId: invitation.project.id, projectName: invitation.project.name }
      });

      // Redirect to the project
      res.redirect(`/projects/${invitation.project.id}`);
    } catch (error: any) {
      console.error("Accept invitation error:", error);
      res.status(500).json({ message: "Failed to accept invitation", error: error.message });
    }
  });

  app.get("/api/invitations/decline/:token", async (req, res) => {
    try {
      const { token } = req.params;

      // Get invitation details
      const invitation = await storage.getInvitation(token);
      
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found or invalid" });
      }

      if (invitation.status !== 'pending') {
        return res.status(400).json({ 
          message: `Invitation already ${invitation.status}`,
          status: invitation.status 
        });
      }

      // Mark invitation as declined
      await storage.updateInvitation(token, { 
        status: 'declined', 
        respondedAt: new Date() 
      });

      // Return a simple HTML response
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invitation Declined</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; }
            .container { background: #f9f9f9; padding: 30px; border-radius: 12px; border-left: 4px solid #6B7280; }
            h1 { color: #374151; margin: 0 0 20px 0; }
            p { color: #6B7280; line-height: 1.6; margin: 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>❌ Invitation Declined</h1>
            <p>You have declined the invitation to join "${invitation.project.name}".</p>
            <p style="margin-top: 15px;">If you change your mind, please contact ${invitation.inviter.name} directly.</p>
          </div>
        </body>
        </html>
      `);
    } catch (error: any) {
      console.error("Decline invitation error:", error);
      res.status(500).json({ message: "Failed to decline invitation", error: error.message });
    }
  });

  // API endpoint to get invitation details (for frontend)
  app.get("/api/invitations/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const invitation = await storage.getInvitation(token);
      
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found or invalid" });
      }

      if (invitation.status !== 'pending') {
        return res.status(400).json({ 
          message: `Invitation already ${invitation.status}`,
          status: invitation.status 
        });
      }

      if (new Date() > invitation.expiresAt) {
        return res.status(400).json({ message: "Invitation has expired" });
      }

      // Return invitation details (without sensitive info)
      res.json({
        projectName: invitation.project.name,
        inviterName: invitation.inviter.name,
        role: invitation.role,
        inviteeEmail: invitation.inviteeEmail,
        expiresAt: invitation.expiresAt
      });
    } catch (error: any) {
      console.error("Get invitation error:", error);
      res.status(500).json({ message: "Failed to get invitation details" });
    }
  });

  // Get pending invitations for current user
  app.get("/api/my-invitations", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const invitations = await storage.getInvitationsByEmail(user.email);
      
      // Filter to only pending, non-expired invitations
      const pendingInvitations = invitations.filter(inv => 
        inv.status === 'pending' && new Date() < inv.expiresAt
      );

      res.json(pendingInvitations);
    } catch (error: any) {
      console.error("Get my invitations error:", error);
      res.status(500).json({ message: "Failed to get invitations" });
    }
  });

  // Accept invitation from within the app
  app.post("/api/invitations/:id/accept", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const { id } = req.params;
      
      // Find invitation by ID
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const userInvitations = await storage.getInvitationsByEmail(user.email);
      const invitation = userInvitations.find(inv => inv.id === id);
      
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      if (invitation.status !== 'pending') {
        return res.status(400).json({ 
          message: `Invitation already ${invitation.status}` 
        });
      }

      if (new Date() > invitation.expiresAt) {
        await storage.updateInvitation(invitation.token, { 
          status: 'expired', 
          respondedAt: new Date() 
        });
        return res.status(400).json({ message: "Invitation has expired" });
      }

      // Check if user is already a member
      const existingMembers = await storage.getProjectMembers(invitation.project.id);
      const isAlreadyMember = existingMembers.some(m => m.userId === userId);
      
      if (!isAlreadyMember) {
        await storage.addProjectMember({
          projectId: invitation.project.id,
          userId: userId,
          role: invitation.role
        });
      }

      // Mark invitation as accepted
      await storage.updateInvitation(invitation.token, { 
        status: 'accepted', 
        respondedAt: new Date() 
      });

      // Create success notification
      await storage.createNotification({
        userId: userId,
        title: "Invitation Accepted",
        message: `Welcome to "${invitation.project.name}"! You've been added as a ${invitation.role}.`,
        type: "project",
        data: { projectId: invitation.project.id, projectName: invitation.project.name }
      });

      res.json({ 
        message: "Invitation accepted successfully",
        projectId: invitation.project.id,
        projectName: invitation.project.name
      });
    } catch (error: any) {
      console.error("Accept invitation error:", error);
      res.status(500).json({ message: "Failed to accept invitation", error: error.message });
    }
  });

  // Decline invitation from within the app
  app.post("/api/invitations/:id/decline", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const { id } = req.params;
      
      // Find invitation by ID
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const userInvitations = await storage.getInvitationsByEmail(user.email);
      const invitation = userInvitations.find(inv => inv.id === id);
      
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      if (invitation.status !== 'pending') {
        return res.status(400).json({ 
          message: `Invitation already ${invitation.status}` 
        });
      }

      // Mark invitation as declined
      await storage.updateInvitation(invitation.token, { 
        status: 'declined', 
        respondedAt: new Date() 
      });

      res.json({ 
        message: "Invitation declined",
        projectName: invitation.project.name
      });
    } catch (error: any) {
      console.error("Decline invitation error:", error);
      res.status(500).json({ message: "Failed to decline invitation", error: error.message });
    }
  });

  // Manual daily briefing for current user
  app.post("/api/daily-briefing/send", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      const user = await storage.getUser(userId);
      
      if (!user?.email) {
        return res.status(400).json({ message: "User email not found" });
      }

      // Get user's projects and tasks
      const projects = await storage.getProjects(userId);
      const tasks = await storage.getTasks(undefined, userId);
      
      // Generate AI-powered daily briefing
      const summary = await aiService.generateSmartDailyBriefing(projects, tasks, userId);
      
      // Send the briefing email using verified domain
      await emailService.sendDailySummary(user.email, summary);
      console.log(`Manual daily briefing sent to: ${user.email}`);
      
      res.json({ 
        message: "Daily briefing sent successfully to your email",
        email: user.email,
        summary: summary,
        emailSent: true
      });
    } catch (error: any) {
      console.error("Manual daily briefing error:", error);
      res.status(500).json({ message: "Failed to send daily briefing", error: error.message });
    }
  });

  // Enable daily briefings for current user
  app.post("/api/daily-briefing/enable", requireAuth, async (req, res) => {
    try {
      const userId = getUserId(req as any, mockUserId);
      
      let settings = await storage.getUserSettings(userId);
      
      if (!settings) {
        // Create new settings with daily briefing enabled
        settings = await storage.createUserSettings({
          userId,
          emailNotifications: true,
          morningBriefing: true,
          taskDeadlineAlerts: true,
          endOfDaySummary: true,
          urgentOnly: false,
          workingHoursStart: '09:00',
          workingHoursEnd: '18:00'
        });
      } else {
        // Update existing settings to enable briefings
        settings = await storage.updateUserSettings(userId, {
          ...settings,
          emailNotifications: true,
          morningBriefing: true
        });
      }
      
      res.json({ 
        message: "Daily briefings enabled successfully",
        settings: settings
      });
    } catch (error: any) {
      console.error("Enable daily briefing error:", error);
      res.status(500).json({ message: "Failed to enable daily briefings", error: error.message });
    }
  });

  // Test endpoints to trigger automated emails manually  
  app.post("/api/test/morning-briefing", requireAuth, async (req, res) => {
    try {
      const { scheduler } = await import("./scheduler");
      await scheduler.sendMorningBriefings();
      res.json({ message: "Morning briefings triggered successfully" });
    } catch (error: any) {
      console.error("Failed to trigger morning briefings:", error);
      res.status(500).json({ message: "Failed to trigger morning briefings", error: error.message });
    }
  });

  app.post("/api/test/lunch-reminder", requireAuth, async (req, res) => {
    try {
      const { scheduler } = await import("./scheduler");
      await scheduler.sendLunchReminders();
      res.json({ message: "Lunch reminders triggered successfully" });
    } catch (error: any) {
      console.error("Failed to trigger lunch reminders:", error);
      res.status(500).json({ message: "Failed to trigger lunch reminders", error: error.message });
    }
  });

  app.post("/api/test/end-of-day", requireAuth, async (req, res) => {
    try {
      const { scheduler } = await import("./scheduler");
      await scheduler.sendEndOfDaySummary();
      res.json({ message: "End-of-day summaries triggered successfully" });
    } catch (error: any) {
      console.error("Failed to trigger end-of-day summaries:", error);
      res.status(500).json({ message: "Failed to trigger end-of-day summaries", error: error.message });
    }
  });

  // Debug endpoint to check user count and trigger test briefing
  app.get("/api/debug/users-count", async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const usersWithEmails = allUsers.filter(u => u.email);
      
      res.json({
        totalUsers: allUsers.length,
        usersWithEmails: usersWithEmails.length,
        users: usersWithEmails.map(u => ({
          id: u.id,
          email: u.email,
          name: u.name
        }))
      });
    } catch (error) {
      console.error('Debug users count error:', error);
      res.status(500).json({ error: 'Failed to get users count' });
    }
  });

  // Debug endpoint to manually trigger morning briefing
  app.post("/api/debug/trigger-briefing", async (req, res) => {
    try {
      const { scheduler } = await import("./scheduler");
      await scheduler.sendMorningBriefings();
      res.json({ message: 'Morning briefing triggered manually', timestamp: new Date().toISOString() });
    } catch (error) {
      console.error('Debug briefing trigger error:', error);
      res.status(500).json({ error: 'Failed to trigger briefing' });
    }
  });

  // Debug endpoint to test lunch briefings (no auth)
  app.post("/api/debug/test-lunch-briefings", async (req, res) => {
    try {
      const { scheduler } = await import("./scheduler");
      console.log('🥗 TESTING: Manual lunch briefings triggered');
      await scheduler.sendLunchReminders();
      res.json({ 
        message: 'Lunch briefings test completed - check logs',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Test lunch briefings error:', error);
      res.status(500).json({ error: 'Failed to test lunch briefings' });
    }
  });

  // Debug endpoint to fix existing users' settings
  app.post("/api/debug/fix-user-settings", async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      let fixedCount = 0;
      
      for (const user of allUsers) {
        const settings = await storage.getUserSettings(user.id);
        
        if (settings) {
          // Update existing settings to include missing fields
          const updates: any = {};
          
          if (settings.lunchReminder === undefined || settings.lunchReminder === null) {
            updates.lunchReminder = true;
            fixedCount++;
          }
          
          if (Object.keys(updates).length > 0) {
            await storage.updateUserSettings(user.id, updates);
            console.log(`Fixed settings for ${user.email}: ${JSON.stringify(updates)}`);
          }
        }
      }
      
      res.json({ 
        message: `Fixed settings for ${fixedCount} users`,
        totalUsers: allUsers.length,
        fixedCount,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Fix user settings error:', error);
      res.status(500).json({ error: 'Failed to fix user settings' });
    }
  });

  // Debug endpoint (no auth) to test email system 
  app.post("/api/debug/test-emails", async (req, res) => {
    try {
      console.log('🧪 DEBUG: Manual email test triggered');
      const { scheduler } = await import("./scheduler");
      
      // Test all automated email types
      console.log('Testing end-of-day summaries...');
      await scheduler.sendEndOfDaySummary();
      
      console.log('Testing urgent notifications (task deadlines)...');
      await scheduler.checkUrgentNotifications();
      
      console.log('Testing project health alerts...');
      await scheduler.checkProjectHealth();
      
      res.json({ 
        message: "Debug email test completed - check server logs for results",
        time: new Date().toLocaleString()
      });
    } catch (error: any) {
      console.error("Debug email test failed:", error);
      res.status(500).json({ 
        message: "Debug email test failed", 
        error: error.message,
        time: new Date().toLocaleString()
      });
    }
  });

  // Emergency trigger for morning briefings (no auth) - for fixing missed emails
  app.post("/api/debug/trigger-morning-briefings", async (req, res) => {
    try {
      console.log('📧 EMERGENCY: Manual morning briefing triggered for all users');
      const { scheduler } = await import("./scheduler");
      
      console.log('📧 Starting morning briefings...');
      await scheduler.sendMorningBriefings();
      console.log('📧 Morning briefings completed');
      
      res.json({ 
        message: "Emergency morning briefings triggered successfully",
        time: new Date().toLocaleString()
      });
    } catch (error: any) {
      console.error("Emergency morning briefing failed:", error);
      res.status(500).json({ 
        message: "Emergency morning briefing failed", 
        error: error.message,
        time: new Date().toLocaleString()
      });
    }
  });

  // AI Voice Assistant Routes
  const { aiRoutes } = await import("./routes/ai");
  for (const route of aiRoutes) {
    if (route.method === "GET") {
      app.get(`/api/ai${route.path}`, requireAuth, route.handler);
    } else if (route.method === "POST") {
      app.post(`/api/ai${route.path}`, requireAuth, route.handler);
    } else if (route.method === "PUT") {
      app.put(`/api/ai${route.path}`, requireAuth, route.handler);
    } else if (route.method === "DELETE") {
      app.delete(`/api/ai${route.path}`, requireAuth, route.handler);
    }
  }

  const httpServer = createServer(app);
  return httpServer;
}
