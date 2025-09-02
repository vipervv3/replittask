import {
  users,
  projects,
  tasks,
  meetings,
  projectMembers,
  meetingParticipants,
  notifications,
  userSettings,
  invitations,
  authenticators,
  loginEvents,
  externalMeetings,
  type User,
  type InsertUser,
  type Project,
  type InsertProject,
  type Task,
  type InsertTask,
  type Meeting,
  type InsertMeeting,
  type ProjectMember,
  type InsertProjectMember,
  type Notification,
  type InsertNotification,
  type UserSettings,
  type InsertUserSettings,
  type Invitation,
  type InsertInvitation,
  type Authenticator,
  type InsertAuthenticator,
  type LoginEvent,
  type InsertLoginEvent,
  type ExternalMeeting,
  type InsertExternalMeeting,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, count, sql, gte, lt, asc, inArray } from "drizzle-orm";

export interface IStorage {
  // Users
  getAllUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User>;

  // Projects
  getProjects(userId: string): Promise<(Project & { memberCount: number })[]>;
  getProjectMemberCount(projectId: string): Promise<number>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, updates: Partial<InsertProject>): Promise<Project>;
  deleteProject(id: string): Promise<void>;

  // Tasks
  getTasks(projectId?: string, userId?: string): Promise<Task[]>;
  getTasksByProject(projectId: string): Promise<Task[]>;
  getTask(id: string): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, updates: Partial<InsertTask>, userId?: string): Promise<Task>;
  deleteTask(id: string): Promise<void>;
  deleteTasks(ids: string[]): Promise<void>;

  // Meetings
  getMeetings(userId: string, projectId?: string): Promise<Meeting[]>;
  getMeeting(id: string): Promise<Meeting | undefined>;
  createMeeting(meeting: InsertMeeting): Promise<Meeting>;
  updateMeeting(id: string, updates: Partial<InsertMeeting>): Promise<Meeting>;

  // External Meetings (Outlook, Google Calendar, etc.)
  getExternalMeetings(userId: string, projectId?: string): Promise<ExternalMeeting[]>;
  getExternalMeeting(id: string): Promise<ExternalMeeting | undefined>;
  getExternalMeetingByExternalId(externalId: string, userId: string): Promise<ExternalMeeting | undefined>;
  createExternalMeeting(meeting: InsertExternalMeeting): Promise<ExternalMeeting>;
  updateExternalMeeting(id: string, updates: Partial<InsertExternalMeeting>): Promise<ExternalMeeting>;
  linkExternalMeetingToProject(externalMeetingId: string, projectId: string | null): Promise<ExternalMeeting>;
  deleteExternalMeeting(id: string): Promise<void>;

  // Project Members
  getProjectMembers(projectId: string): Promise<(ProjectMember & { user: User })[]>;
  addProjectMember(member: InsertProjectMember): Promise<ProjectMember>;
  removeProjectMember(projectId: string, userId: string): Promise<void>;

  // Notifications
  getNotifications(userId: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationRead(id: string): Promise<void>;

  // User Settings
  getUserSettings(userId: string): Promise<UserSettings | undefined>;
  createUserSettings(data: InsertUserSettings): Promise<UserSettings>;
  updateUserSettings(userId: string, settings: Partial<InsertUserSettings>): Promise<UserSettings>;
  
  // Project progress calculation
  updateProjectProgress(projectId: string): Promise<void>;

  // Dashboard Stats
  getDashboardStats(userId: string): Promise<{
    totalProjects: number;
    activeTasks: number;
    completedTasks: number;
    teamMembers: number;
  }>;
  
  // Recent Activity
  getRecentActivity(userId: string, limit?: number): Promise<{
    id: string;
    type: string;
    user: string;
    action: string;
    target: string | null;
    time: Date;
    createdAt: Date;
  }[]>;
  
  // Today's Schedule
  getTodaysMeetings(userId: string): Promise<(Meeting & { 
    project?: { name: string }; 
    creator: { name: string } 
  })[]>;
  
  // Invitations
  createInvitation(invitation: InsertInvitation): Promise<Invitation>;
  getInvitation(token: string): Promise<(Invitation & { project: Project; inviter: User }) | undefined>;
  getInvitationsByEmail(email: string): Promise<(Invitation & { project: Project; inviter: User })[]>;
  getInvitationsByProject(projectId: string): Promise<(Invitation & { inviter: User })[]>;
  updateInvitation(token: string, updates: Partial<Pick<Invitation, 'status' | 'respondedAt'>>): Promise<Invitation>;
  deleteInvitation(token: string): Promise<void>;
  cleanupExpiredInvitations(): Promise<void>;

  // WebAuthn Authenticators
  getUserAuthenticators(userId: string): Promise<Authenticator[]>;
  getAuthenticatorByCredentialId(credentialId: string): Promise<Authenticator | undefined>;
  createAuthenticator(authenticator: InsertAuthenticator): Promise<Authenticator>;
  updateAuthenticator(credentialId: string, updates: Partial<InsertAuthenticator>): Promise<Authenticator>;
  deleteAuthenticator(credentialId: string): Promise<void>;

  // Login Events for Security Analytics
  createLoginEvent(event: InsertLoginEvent): Promise<LoginEvent>;
  getLoginEvents(userId: string, limit?: number): Promise<LoginEvent[]>;
  getLoginEventsByDateRange(userId: string, startDate: Date, endDate: Date): Promise<LoginEvent[]>;
  getSecurityAnalytics(userId: string): Promise<{
    totalLogins: number;
    biometricLogins: number;
    passwordLogins: number;
    failedAttempts: number;
    uniqueDevices: number;
    lastLogin: Date | null;
    averageSessionDuration: number;
    loginFrequency: { date: string; count: number; method: string }[];
    deviceBreakdown: { deviceName: string; count: number; lastUsed: Date }[];
    recentEvents: LoginEvent[];
  }>;
}

export class DatabaseStorage implements IStorage {
  async getAllUsers(): Promise<User[]> {
    const allUsers = await db.select().from(users);
    return allUsers;
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  async getProjects(userId: string): Promise<(Project & { memberCount: number })[]> {
    // First get all projects user has access to
    const result = await db
      .select({ projects })
      .from(projects)
      .leftJoin(projectMembers, eq(projects.id, projectMembers.projectId))
      .where(or(eq(projects.ownerId, userId), eq(projectMembers.userId, userId)))
      .orderBy(desc(projects.updatedAt));
    
    const userProjects = result.map(r => r.projects);
    
    // Then get member counts for each project
    const projectsWithCounts = await Promise.all(
      userProjects.map(async (project) => {
        const memberCount = await this.getProjectMemberCount(project.id);
        return { ...project, memberCount };
      })
    );
    
    return projectsWithCounts;
  }

  async getProjectMemberCount(projectId: string): Promise<number> {
    // Count owner + project members
    const project = await this.getProject(projectId);
    if (!project) return 0;
    
    const [memberCount] = await db
      .select({ count: count() })
      .from(projectMembers)
      .where(eq(projectMembers.projectId, projectId));
    
    // Add 1 for the owner (who isn't in projectMembers table)
    return (memberCount?.count || 0) + 1;
  }

  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project || undefined;
  }

  async createProject(project: InsertProject): Promise<Project> {
    const [newProject] = await db.insert(projects).values(project).returning();
    return newProject;
  }

  async updateProject(id: string, updates: Partial<InsertProject>): Promise<Project> {
    const [project] = await db
      .update(projects)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return project;
  }

  async deleteProject(id: string): Promise<void> {
    // Delete all related data in the correct order (child tables first)
    
    // 1. Delete all tasks associated with this project
    await db.delete(tasks).where(eq(tasks.projectId, id));
    
    // 2. Delete all meetings associated with this project
    await db.delete(meetings).where(eq(meetings.projectId, id));
    
    // 3. Delete all project members
    await db.delete(projectMembers).where(eq(projectMembers.projectId, id));
    
    // 4. Delete all invitations for this project
    await db.delete(invitations).where(eq(invitations.projectId, id));
    
    // 5. Finally delete the project itself
    await db.delete(projects).where(eq(projects.id, id));
  }

  async getTasks(projectId?: string, userId?: string): Promise<Task[]> {
    if (projectId && userId) {
      return await db.select().from(tasks)
        .where(and(eq(tasks.projectId, projectId), eq(tasks.assigneeId, userId)))
        .orderBy(desc(tasks.createdAt));
    } else if (projectId) {
      return await db.select().from(tasks)
        .where(eq(tasks.projectId, projectId))
        .orderBy(desc(tasks.createdAt));
    } else if (userId) {
      return await db.select().from(tasks)
        .where(eq(tasks.assigneeId, userId))
        .orderBy(desc(tasks.createdAt));
    }

    return await db.select().from(tasks).orderBy(desc(tasks.createdAt));
  }

  async getTasksByProject(projectId: string): Promise<Task[]> {
    return await db.select().from(tasks)
      .where(eq(tasks.projectId, projectId))
      .orderBy(desc(tasks.createdAt));
  }

  async getTask(id: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task || undefined;
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [newTask] = await db.insert(tasks).values(task).returning();
    
    // Update project progress when new task is created
    if (newTask.projectId) {
      await this.updateProjectProgress(newTask.projectId);
    }
    
    return newTask;
  }

  async updateTask(id: string, updates: Partial<InsertTask>, userId?: string): Promise<Task> {
    const [task] = await db
      .update(tasks)
      .set({ 
        ...updates, 
        updatedAt: new Date(),
        updatedBy: userId || updates.updatedBy
      })
      .where(eq(tasks.id, id))
      .returning();
    
    // Update project progress when task status changes
    if (updates.status && task.projectId) {
      await this.updateProjectProgress(task.projectId);
    }
    
    return task;
  }

  async deleteTask(id: string): Promise<void> {
    // Get task before deleting to access projectId
    const taskToDelete = await this.getTask(id);
    await db.delete(tasks).where(eq(tasks.id, id));
    
    // Update project progress when task is deleted
    if (taskToDelete?.projectId) {
      await this.updateProjectProgress(taskToDelete.projectId);
    }
  }

  async deleteTasks(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    
    // Get tasks before deleting to access projectIds
    const tasksToDelete = await Promise.all(ids.map(id => this.getTask(id)));
    
    // Delete all tasks
    await db.delete(tasks).where(inArray(tasks.id, ids));
    
    // Update project progress for affected projects
    const projectIds = Array.from(new Set(tasksToDelete
      .filter(task => task?.projectId)
      .map(task => task!.projectId)
    ));
    
    await Promise.all(projectIds.map(projectId => this.updateProjectProgress(projectId)));
  }

  async getMeetings(userId: string, projectId?: string): Promise<Meeting[]> {
    if (projectId) {
      const result = await db.select({ meetings }).from(meetings)
        .leftJoin(meetingParticipants, eq(meetings.id, meetingParticipants.meetingId))
        .where(
          and(
            eq(meetings.projectId, projectId),
            or(eq(meetings.createdById, userId), eq(meetingParticipants.userId, userId))
          )
        )
        .orderBy(desc(meetings.scheduledAt));
      return result.map(r => r.meetings);
    } else {
      const result = await db.select({ meetings }).from(meetings)
        .leftJoin(meetingParticipants, eq(meetings.id, meetingParticipants.meetingId))
        .where(
          or(eq(meetings.createdById, userId), eq(meetingParticipants.userId, userId))
        )
        .orderBy(desc(meetings.scheduledAt));
      return result.map(r => r.meetings);
    }
  }

  async getMeeting(id: string): Promise<Meeting | undefined> {
    const [meeting] = await db.select().from(meetings).where(eq(meetings.id, id));
    return meeting || undefined;
  }

  async createMeeting(meeting: InsertMeeting): Promise<Meeting> {
    // Convert recurrenceEndDate string to Date if present
    const processedMeeting = {
      ...meeting,
      recurrenceEndDate: meeting.recurrenceEndDate ? new Date(meeting.recurrenceEndDate) : null
    };
    
    const [newMeeting] = await db.insert(meetings).values([processedMeeting]).returning();
    
    // If it's a recurring meeting, generate instances
    if (meeting.isRecurring && meeting.recurrenceType) {
      await this.generateRecurringInstances(newMeeting);
    }
    
    return newMeeting;
  }

  private async generateRecurringInstances(parentMeeting: Meeting): Promise<void> {
    if (!parentMeeting.isRecurring || !parentMeeting.recurrenceType || !parentMeeting.scheduledAt) {
      return;
    }

    const startDate = new Date(parentMeeting.scheduledAt);
    const endDate = parentMeeting.recurrenceEndDate ? new Date(parentMeeting.recurrenceEndDate) : null;
    const interval = parentMeeting.recurrenceInterval || 1;
    const maxInstances = 100; // Limit to prevent infinite loops
    
    let currentDate = new Date(startDate);
    let instanceCount = 0;

    while (instanceCount < maxInstances && (!endDate || currentDate <= endDate)) {
      // Skip the first instance as that's the parent meeting itself
      if (instanceCount > 0) {
        // Check for weekly pattern restrictions
        let shouldCreateInstance = true;
        
        if (parentMeeting.recurrenceType === 'weekly' && parentMeeting.recurrencePattern) {
          const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
          shouldCreateInstance = parentMeeting.recurrencePattern.includes(dayOfWeek.toString());
        }

        if (shouldCreateInstance) {
          // Create the recurring instance directly with db.insert to bypass schema validation
          await db.insert(meetings).values({
            title: parentMeeting.title,
            description: parentMeeting.description,
            scheduledAt: new Date(currentDate),
            duration: parentMeeting.duration,
            createdById: parentMeeting.createdById,
            projectId: parentMeeting.projectId,
            recordingUrl: parentMeeting.recordingUrl,
            isRecurring: false,
            recurrenceType: null,
            recurrenceInterval: null,
            recurrenceEndDate: null,
            recurringParentId: parentMeeting.id,
            recurrencePattern: null,
          });
        }
      }

      // Calculate next occurrence
      switch (parentMeeting.recurrenceType) {
        case 'daily':
          currentDate.setDate(currentDate.getDate() + interval);
          break;
        case 'weekly':
          currentDate.setDate(currentDate.getDate() + (7 * interval));
          break;
        case 'monthly':
          currentDate.setMonth(currentDate.getMonth() + interval);
          break;
        case 'yearly':
          currentDate.setFullYear(currentDate.getFullYear() + interval);
          break;
      }

      instanceCount++;
      
      // Stop after 2 years if no end date specified
      if (!endDate && instanceCount > 104) { // ~2 years of weekly meetings
        break;
      }
    }

    // Individual instances are already created in the loop above
  }

  async updateMeeting(id: string, updates: Partial<InsertMeeting>): Promise<Meeting> {
    // Convert recurrenceEndDate string to Date if present for database storage
    const processedUpdates: any = { ...updates };
    if (updates.recurrenceEndDate && typeof updates.recurrenceEndDate === 'string') {
      processedUpdates.recurrenceEndDate = new Date(updates.recurrenceEndDate);
    }
    
    const [meeting] = await db
      .update(meetings)
      .set(processedUpdates)
      .where(eq(meetings.id, id))
      .returning();
    return meeting;
  }

  async deleteMeeting(id: string): Promise<void> {
    await db.delete(meetings).where(eq(meetings.id, id));
  }

  // External Meetings Implementation
  async getExternalMeetings(userId: string, projectId?: string): Promise<ExternalMeeting[]> {
    if (projectId) {
      return await db.select().from(externalMeetings)
        .where(and(eq(externalMeetings.userId, userId), eq(externalMeetings.projectId, projectId)))
        .orderBy(desc(externalMeetings.startTime));
    } else {
      return await db.select().from(externalMeetings)
        .where(eq(externalMeetings.userId, userId))
        .orderBy(desc(externalMeetings.startTime));
    }
  }

  async getExternalMeeting(id: string): Promise<ExternalMeeting | undefined> {
    const [meeting] = await db.select().from(externalMeetings).where(eq(externalMeetings.id, id));
    return meeting || undefined;
  }

  async getExternalMeetingByExternalId(externalId: string, userId: string): Promise<ExternalMeeting | undefined> {
    const [meeting] = await db.select().from(externalMeetings)
      .where(and(eq(externalMeetings.externalId, externalId), eq(externalMeetings.userId, userId)));
    return meeting || undefined;
  }

  async createExternalMeeting(meeting: InsertExternalMeeting): Promise<ExternalMeeting> {
    const [newMeeting] = await db.insert(externalMeetings).values(meeting).returning();
    return newMeeting;
  }

  async updateExternalMeeting(id: string, updates: Partial<InsertExternalMeeting>): Promise<ExternalMeeting> {
    const [meeting] = await db
      .update(externalMeetings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(externalMeetings.id, id))
      .returning();
    return meeting;
  }

  async linkExternalMeetingToProject(externalMeetingId: string, projectId: string | null): Promise<ExternalMeeting> {
    const [meeting] = await db
      .update(externalMeetings)
      .set({ projectId, updatedAt: new Date() })
      .where(eq(externalMeetings.id, externalMeetingId))
      .returning();
    return meeting;
  }

  async deleteExternalMeeting(id: string): Promise<void> {
    await db.delete(externalMeetings).where(eq(externalMeetings.id, id));
  }

  async getProjectMembers(projectId: string): Promise<(ProjectMember & { user: User })[]> {
    const result = await db
      .select()
      .from(projectMembers)
      .leftJoin(users, eq(projectMembers.userId, users.id))
      .where(eq(projectMembers.projectId, projectId));

    return result.map(r => ({
      ...r.project_members,
      user: r.users!,
    }));
  }

  async addProjectMember(member: InsertProjectMember): Promise<ProjectMember> {
    const [newMember] = await db.insert(projectMembers).values(member).returning();
    return newMember;
  }

  async removeProjectMember(projectId: string, userId: string): Promise<void> {
    await db.delete(projectMembers).where(
      and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId))
    );
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(50);
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await db.insert(notifications).values(notification).returning();
    return newNotification;
  }

  async markNotificationRead(id: string): Promise<void> {
    await db.update(notifications).set({ read: true }).where(eq(notifications.id, id));
  }

  async getUserSettings(userId: string): Promise<UserSettings | undefined> {
    const [settings] = await db.select().from(userSettings).where(eq(userSettings.userId, userId));
    return settings || undefined;
  }

  async createUserSettings(data: InsertUserSettings): Promise<UserSettings> {
    const [settings] = await db.insert(userSettings).values(data).returning();
    return settings;
  }

  async updateUserSettings(userId: string, settings: Partial<InsertUserSettings>): Promise<UserSettings> {
    const existing = await this.getUserSettings(userId);
    
    if (existing) {
      const [updated] = await db
        .update(userSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(userSettings.userId, userId))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(userSettings)
        .values({ userId, ...settings })
        .returning();
      return created;
    }
  }

  async getDashboardStats(userId: string): Promise<{
    totalProjects: number;
    activeTasks: number;
    completedTasks: number;
    teamMembers: number;
  }> {
    // Optimized: Use parallel queries that work with Drizzle ORM
    const [projectsResult, activeTasksResult, completedTasksResult] = await Promise.all([
      // Get total projects count
      db
        .select({ count: count() })
        .from(projects)
        .leftJoin(projectMembers, eq(projects.id, projectMembers.projectId))
        .where(or(eq(projects.ownerId, userId), eq(projectMembers.userId, userId))),
      
      // Get active tasks count
      db
        .select({ count: count() })
        .from(tasks)
        .where(
          and(
            eq(tasks.assigneeId, userId),
            or(eq(tasks.status, 'todo'), eq(tasks.status, 'in_progress'))
          )
        ),
      
      // Get completed tasks count
      db
        .select({ count: count() })
        .from(tasks)
        .where(
          and(
            eq(tasks.assigneeId, userId),
            eq(tasks.status, 'completed')
          )
        )
    ]);

    // Get team members separately to avoid complex joins
    const userProjectIds = await db
      .select({ projectId: projects.id })
      .from(projects)
      .leftJoin(projectMembers, eq(projects.id, projectMembers.projectId))
      .where(or(eq(projects.ownerId, userId), eq(projectMembers.userId, userId)));

    const projectIds = userProjectIds.map(p => p.projectId);

    let teamMemberCount = 0;
    if (projectIds.length > 0) {
      // Get unique team members from user's projects
      const uniqueMembers = await db
        .selectDistinct({ userId: projectMembers.userId })
        .from(projectMembers)
        .where(inArray(projectMembers.projectId, projectIds));
      
      // Add project owners to the count (they're not in projectMembers table)
      const projectOwners = await db
        .selectDistinct({ ownerId: projects.ownerId })
        .from(projects)
        .where(inArray(projects.id, projectIds));
      
      // Combine and deduplicate member IDs
      const allMemberIds = new Set([
        ...uniqueMembers.map(m => m.userId).filter(Boolean),
        ...projectOwners.map(o => o.ownerId).filter(Boolean)
      ]);
      
      teamMemberCount = allMemberIds.size;
    }

    return {
      totalProjects: projectsResult[0]?.count || 0,
      activeTasks: activeTasksResult[0]?.count || 0,
      completedTasks: completedTasksResult[0]?.count || 0,
      teamMembers: teamMemberCount,
    };
  }

  async getRecentActivity(userId: string, limit: number = 10): Promise<{
    id: string;
    type: string;
    user: string;
    action: string;
    target: string | null;
    time: Date;
    createdAt: Date;
  }[]> {
    const activities: any[] = [];

    // Get user's projects for filtering
    const userProjects = await db
      .select({ id: projects.id })
      .from(projects)
      .leftJoin(projectMembers, eq(projects.id, projectMembers.projectId))
      .where(or(eq(projects.ownerId, userId), eq(projectMembers.userId, userId)));
    
    const projectIds = userProjects.map(p => p.id);

    if (projectIds.length === 0) {
      return [];
    }

    // Get recent project creations
    const recentProjects = await db
      .select({
        id: projects.id,
        name: projects.name,
        createdAt: projects.createdAt,
        ownerId: projects.ownerId
      })
      .from(projects)
      .leftJoin(projectMembers, eq(projects.id, projectMembers.projectId))
      .where(or(eq(projects.ownerId, userId), eq(projectMembers.userId, userId)))
      .orderBy(desc(projects.createdAt))
      .limit(5);

    for (const project of recentProjects) {
      const owner = await this.getUser(project.ownerId);
      activities.push({
        id: `project_${project.id}`,
        type: 'created',
        user: owner?.name || 'Someone',
        action: 'created project',
        target: project.name,
        time: project.createdAt,
        createdAt: project.createdAt,
      });
    }

    // Get recent task updates
    const recentTasks = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        updatedAt: tasks.updatedAt,
        assigneeId: tasks.assigneeId,
        projectId: tasks.projectId
      })
      .from(tasks)
      .where(sql`${tasks.projectId} IN (${sql.join(projectIds.map(id => sql`${id}`), sql`, `)})`)
      .orderBy(desc(tasks.updatedAt))
      .limit(5);

    for (const task of recentTasks) {
      const assignee = task.assigneeId ? await this.getUser(task.assigneeId) : null;
      const action = task.status === 'completed' ? 'completed task' : 'updated task';
      const type = task.status === 'completed' ? 'completed' : 'updated';
      
      activities.push({
        id: `task_${task.id}`,
        type,
        user: assignee?.name || 'Someone',
        action,
        target: task.title,
        time: task.updatedAt,
        createdAt: task.updatedAt,
      });
    }

    // Get recent meetings
    const recentMeetings = await db
      .select({
        id: meetings.id,
        title: meetings.title,
        createdAt: meetings.createdAt,
        createdById: meetings.createdById
      })
      .from(meetings)
      .where(sql`${meetings.projectId} IN (${sql.join(projectIds.map(id => sql`${id}`), sql`, `)})`)
      .orderBy(desc(meetings.createdAt))
      .limit(3);

    for (const meeting of recentMeetings) {
      const creator = await this.getUser(meeting.createdById);
      activities.push({
        id: `meeting_${meeting.id}`,
        type: 'ai',
        user: creator?.name || 'Someone',
        action: 'recorded meeting',
        target: meeting.title,
        time: meeting.createdAt,
        createdAt: meeting.createdAt,
      });
    }

    // Sort all activities by creation time and limit
    return activities
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, limit);
  }

  async getTodaysMeetings(userId: string): Promise<(Meeting & { 
    project?: { name: string }; 
    creator: { name: string } 
  })[]> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    // Get user's projects for filtering
    const userProjects = await db
      .select({ id: projects.id })
      .from(projects)
      .leftJoin(projectMembers, eq(projects.id, projectMembers.projectId))
      .where(or(eq(projects.ownerId, userId), eq(projectMembers.userId, userId)));
    
    const projectIds = userProjects.map(p => p.id);

    if (projectIds.length === 0) {
      return [];
    }

    // Get today's meetings
    const todaysMeetings = await db
      .select({
        meeting: meetings,
        projectName: projects.name,
        creatorName: users.name
      })
      .from(meetings)
      .leftJoin(projects, eq(meetings.projectId, projects.id))
      .leftJoin(users, eq(meetings.createdById, users.id))
      .where(
        and(
          sql`${meetings.projectId} IN (${sql.join(projectIds.map(id => sql`${id}`), sql`, `)})`,
          gte(meetings.scheduledAt, startOfDay),
          lt(meetings.scheduledAt, endOfDay)
        )
      )
      .orderBy(asc(meetings.scheduledAt));

    return todaysMeetings.map(row => ({
      ...row.meeting,
      project: row.projectName ? { name: row.projectName } : undefined,
      creator: { name: row.creatorName || 'Unknown' }
    }));
  }

  // Invitation methods
  async createInvitation(invitation: InsertInvitation): Promise<Invitation> {
    const [newInvitation] = await db.insert(invitations).values(invitation).returning();
    return newInvitation;
  }

  async getInvitation(token: string): Promise<(Invitation & { project: Project; inviter: User }) | undefined> {
    const [result] = await db
      .select({
        invitation: invitations,
        project: projects,
        inviter: users
      })
      .from(invitations)
      .leftJoin(projects, eq(invitations.projectId, projects.id))
      .leftJoin(users, eq(invitations.inviterUserId, users.id))
      .where(eq(invitations.token, token));
    
    if (!result || !result.project || !result.inviter) {
      return undefined;
    }
    
    return {
      ...result.invitation,
      project: result.project,
      inviter: result.inviter
    };
  }

  async getInvitationsByEmail(email: string): Promise<(Invitation & { project: Project; inviter: User })[]> {
    const results = await db
      .select({
        invitation: invitations,
        project: projects,
        inviter: users
      })
      .from(invitations)
      .leftJoin(projects, eq(invitations.projectId, projects.id))
      .leftJoin(users, eq(invitations.inviterUserId, users.id))
      .where(eq(invitations.inviteeEmail, email))
      .orderBy(desc(invitations.createdAt));
    
    return results
      .filter(r => r.project && r.inviter)
      .map(r => ({
        ...r.invitation,
        project: r.project!,
        inviter: r.inviter!
      }));
  }

  async getInvitationsByProject(projectId: string): Promise<(Invitation & { inviter: User })[]> {
    const results = await db
      .select({
        invitation: invitations,
        inviter: users
      })
      .from(invitations)
      .leftJoin(users, eq(invitations.inviterUserId, users.id))
      .where(eq(invitations.projectId, projectId))
      .orderBy(desc(invitations.createdAt));
    
    return results
      .filter(r => r.inviter)
      .map(r => ({
        ...r.invitation,
        inviter: r.inviter!
      }));
  }

  async updateInvitation(token: string, updates: Partial<Pick<Invitation, 'status' | 'respondedAt'>>): Promise<Invitation> {
    const [invitation] = await db
      .update(invitations)
      .set(updates)
      .where(eq(invitations.token, token))
      .returning();
    return invitation;
  }

  async deleteInvitation(token: string): Promise<void> {
    await db.delete(invitations).where(eq(invitations.token, token));
  }

  async cleanupExpiredInvitations(): Promise<void> {
    await db.delete(invitations).where(lt(invitations.expiresAt, new Date()));
  }

  // WebAuthn Authenticator methods
  async getUserAuthenticators(userId: string): Promise<Authenticator[]> {
    return await db.select().from(authenticators).where(eq(authenticators.userId, userId));
  }

  async getAuthenticatorByCredentialId(credentialId: string): Promise<Authenticator | undefined> {
    const [authenticator] = await db.select().from(authenticators).where(eq(authenticators.credentialId, credentialId));
    return authenticator || undefined;
  }

  async createAuthenticator(authenticator: InsertAuthenticator): Promise<Authenticator> {
    const [newAuthenticator] = await db.insert(authenticators).values(authenticator).returning();
    return newAuthenticator;
  }

  async updateAuthenticator(credentialId: string, updates: Partial<InsertAuthenticator>): Promise<Authenticator> {
    const [updatedAuthenticator] = await db
      .update(authenticators)
      .set({ ...updates, lastUsedAt: new Date() })
      .where(eq(authenticators.credentialId, credentialId))
      .returning();
    return updatedAuthenticator;
  }

  async deleteAuthenticator(credentialId: string): Promise<void> {
    await db.delete(authenticators).where(eq(authenticators.credentialId, credentialId));
  }

  // Login Events for Security Analytics
  async createLoginEvent(event: InsertLoginEvent): Promise<LoginEvent> {
    const [newEvent] = await db.insert(loginEvents).values(event).returning();
    return newEvent;
  }

  async getLoginEvents(userId: string, limit = 50): Promise<LoginEvent[]> {
    return await db.select()
      .from(loginEvents)
      .where(eq(loginEvents.userId, userId))
      .orderBy(desc(loginEvents.createdAt))
      .limit(limit);
  }

  async getLoginEventsByDateRange(userId: string, startDate: Date, endDate: Date): Promise<LoginEvent[]> {
    return await db.select()
      .from(loginEvents)
      .where(and(
        eq(loginEvents.userId, userId),
        gte(loginEvents.createdAt, startDate),
        lt(loginEvents.createdAt, endDate)
      ))
      .orderBy(desc(loginEvents.createdAt));
  }

  async getSecurityAnalytics(userId: string): Promise<{
    totalLogins: number;
    biometricLogins: number;
    passwordLogins: number;
    failedAttempts: number;
    uniqueDevices: number;
    lastLogin: Date | null;
    averageSessionDuration: number;
    loginFrequency: { date: string; count: number; method: string }[];
    deviceBreakdown: { deviceName: string; count: number; lastUsed: Date }[];
    recentEvents: LoginEvent[];
  }> {
    // Get all login events for the user from the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const allEvents = await this.getLoginEventsByDateRange(userId, thirtyDaysAgo, new Date());
    const successfulLogins = allEvents.filter(e => e.type === 'login_success' || e.type === 'biometric_login');
    const failedLogins = allEvents.filter(e => e.type === 'login_failure' || e.type === 'biometric_failure');
    
    const totalLogins = successfulLogins.length;
    const biometricLogins = successfulLogins.filter(e => e.method === 'biometric').length;
    const passwordLogins = successfulLogins.filter(e => e.method === 'password').length;
    const failedAttempts = failedLogins.length;
    
    // Unique devices
    const uniqueDevices = new Set(successfulLogins.filter(e => e.deviceName).map(e => e.deviceName)).size;
    
    // Last login
    const lastLogin = successfulLogins.length > 0 ? successfulLogins[0].createdAt : null;
    
    // Average session duration (only for events with session duration)
    const sessionsWithDuration = allEvents.filter(e => e.sessionDuration && e.sessionDuration > 0);
    const averageSessionDuration = sessionsWithDuration.length > 0 
      ? Math.round(sessionsWithDuration.reduce((sum, e) => sum + (e.sessionDuration || 0), 0) / sessionsWithDuration.length)
      : 0;
    
    // Login frequency by date and method
    const frequencyMap = new Map<string, { password: number; biometric: number }>();
    successfulLogins.forEach(event => {
      if (!event.createdAt) return;
      const date = event.createdAt.toISOString().split('T')[0];
      if (!frequencyMap.has(date)) {
        frequencyMap.set(date, { password: 0, biometric: 0 });
      }
      const dayData = frequencyMap.get(date)!;
      if (event.method === 'biometric') {
        dayData.biometric++;
      } else {
        dayData.password++;
      }
    });
    
    const loginFrequency: { date: string; count: number; method: string }[] = [];
    frequencyMap.forEach((counts, date) => {
      if (counts.password > 0) {
        loginFrequency.push({ date, count: counts.password, method: 'password' });
      }
      if (counts.biometric > 0) {
        loginFrequency.push({ date, count: counts.biometric, method: 'biometric' });
      }
    });
    
    // Device breakdown
    const deviceMap = new Map<string, { count: number; lastUsed: Date }>();
    successfulLogins.forEach(event => {
      if (event.deviceName && event.createdAt) {
        if (!deviceMap.has(event.deviceName)) {
          deviceMap.set(event.deviceName, { count: 0, lastUsed: event.createdAt });
        }
        const deviceData = deviceMap.get(event.deviceName)!;
        deviceData.count++;
        if (event.createdAt > deviceData.lastUsed) {
          deviceData.lastUsed = event.createdAt;
        }
      }
    });
    
    const deviceBreakdown = Array.from(deviceMap.entries()).map(([deviceName, data]) => ({
      deviceName,
      count: data.count,
      lastUsed: data.lastUsed
    }));
    
    // Recent events (last 10)
    const recentEvents = allEvents.slice(0, 10);
    
    return {
      totalLogins,
      biometricLogins,
      passwordLogins,
      failedAttempts,
      uniqueDevices,
      lastLogin,
      averageSessionDuration,
      loginFrequency: loginFrequency.sort((a, b) => a.date.localeCompare(b.date)),
      deviceBreakdown: deviceBreakdown.sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime()),
      recentEvents
    };
  }

  // Calculate and update project progress based on completed tasks
  async updateProjectProgress(projectId: string): Promise<void> {
    try {
      const projectTasks = await this.getTasksByProject(projectId);
      
      if (projectTasks.length === 0) {
        // No tasks = 0% progress
        await db.update(projects)
          .set({ progress: 0, updatedAt: new Date() })
          .where(eq(projects.id, projectId));
        return;
      }
      
      const completedTasks = projectTasks.filter(task => task.status === 'completed').length;
      const progressPercentage = Math.round((completedTasks / projectTasks.length) * 100);
      
      await db.update(projects)
        .set({ progress: progressPercentage, updatedAt: new Date() })
        .where(eq(projects.id, projectId));
        
      console.log(`Updated project ${projectId} progress: ${completedTasks}/${projectTasks.length} tasks = ${progressPercentage}%`);
    } catch (error) {
      console.error(`Failed to update project progress for ${projectId}:`, error);
    }
  }
}

export const storage = new DatabaseStorage();
