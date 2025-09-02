import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("member"),
  avatar: text("avatar"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"), // active, completed, paused
  progress: integer("progress").notNull().default(0), // 0-100
  ownerId: uuid("owner_id").references(() => users.id).notNull(),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("todo"), // todo, in_progress, completed
  priority: text("priority").notNull().default("medium"), // low, medium, high, urgent
  projectId: uuid("project_id").references(() => projects.id).notNull(),
  assigneeId: uuid("assignee_id").references(() => users.id),
  updatedBy: uuid("updated_by").references(() => users.id),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const meetings = pgTable("meetings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  projectId: uuid("project_id").references(() => projects.id),
  scheduledAt: timestamp("scheduled_at").notNull(),
  duration: integer("duration").notNull(), // in minutes
  recordingUrl: text("recording_url"),
  transcription: text("transcription"),
  aiSummary: text("ai_summary"),
  extractedTasks: jsonb("extracted_tasks"),
  createdById: uuid("created_by_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  // Recurring meeting fields
  isRecurring: boolean("is_recurring").notNull().default(false),
  recurrenceType: text("recurrence_type"), // daily, weekly, monthly, yearly
  recurrenceInterval: integer("recurrence_interval").default(1), // every N days/weeks/months
  recurrenceEndDate: timestamp("recurrence_end_date"),
  recurringParentId: uuid("recurring_parent_id"), // Links to parent recurring series
  recurrencePattern: text("recurrence_pattern"), // Additional pattern info (e.g., weekdays, specific dates)
});

export const projectMembers = pgTable("project_members", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: uuid("project_id").references(() => projects.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  role: text("role").notNull().default("member"), // owner, admin, member
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const invitations = pgTable("invitations", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: uuid("project_id").references(() => projects.id).notNull(),
  inviterUserId: uuid("inviter_user_id").references(() => users.id).notNull(),
  inviteeEmail: text("invitee_email").notNull(),
  role: text("role").notNull().default("member"), // admin, member, collaborator
  status: text("status").notNull().default("pending"), // pending, accepted, declined, expired
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  respondedAt: timestamp("responded_at"),
});

export const meetingParticipants = pgTable("meeting_participants", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  meetingId: uuid("meeting_id").references(() => meetings.id).notNull(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull(), // meeting, task, project, ai_insight
  read: boolean("read").notNull().default(false),
  data: jsonb("data"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userSettings = pgTable("user_settings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull().unique(),
  emailNotifications: boolean("email_notifications").notNull().default(true),
  morningBriefing: boolean("morning_briefing").notNull().default(true),
  lunchReminder: boolean("lunch_reminder").notNull().default(true),
  endOfDaySummary: boolean("end_of_day_summary").notNull().default(true),
  meetingReminders: boolean("meeting_reminders").notNull().default(true),
  taskDeadlineAlerts: boolean("task_deadline_alerts").notNull().default(true),
  aiInsights: boolean("ai_insights").notNull().default(true),
  workingHoursStart: text("working_hours_start").notNull().default("09:00"),
  workingHoursEnd: text("working_hours_end").notNull().default("18:00"),
  urgentOnly: boolean("urgent_only").notNull().default(false),
  outlookCalendarUrl: text("outlook_calendar_url"),
  outlookCalendarEnabled: boolean("outlook_calendar_enabled").notNull().default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// External meetings from calendar systems (Outlook, Google, etc.)
export const externalMeetings = pgTable("external_meetings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  externalId: text("external_id").notNull(), // ID from external system (Outlook event ID)
  userId: uuid("user_id").references(() => users.id).notNull(),
  projectId: uuid("project_id").references(() => projects.id), // Optional project association
  title: text("title").notNull(),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  location: text("location"),
  attendees: jsonb("attendees"), // Array of attendee emails
  source: text("source").notNull().default("outlook"), // outlook, google, etc.
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  ownedProjects: many(projects),
  assignedTasks: many(tasks),
  createdMeetings: many(meetings),
  projectMemberships: many(projectMembers),
  meetingParticipations: many(meetingParticipants),
  notifications: many(notifications),
  settings: many(userSettings),
  sentInvitations: many(invitations),
  authenticators: many(authenticators),
  loginEvents: many(loginEvents),
  externalMeetings: many(externalMeetings),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, { fields: [projects.ownerId], references: [users.id] }),
  tasks: many(tasks),
  meetings: many(meetings),
  members: many(projectMembers),
  invitations: many(invitations),
  externalMeetings: many(externalMeetings),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
  assignee: one(users, { fields: [tasks.assigneeId], references: [users.id] }),
  updatedByUser: one(users, { fields: [tasks.updatedBy], references: [users.id] }),
}));

export const meetingsRelations = relations(meetings, ({ one, many }) => ({
  project: one(projects, { fields: [meetings.projectId], references: [projects.id] }),
  createdBy: one(users, { fields: [meetings.createdById], references: [users.id] }),
  participants: many(meetingParticipants),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, { fields: [projectMembers.projectId], references: [projects.id] }),
  user: one(users, { fields: [projectMembers.userId], references: [users.id] }),
}));

export const meetingParticipantsRelations = relations(meetingParticipants, ({ one }) => ({
  meeting: one(meetings, { fields: [meetingParticipants.meetingId], references: [meetings.id] }),
  user: one(users, { fields: [meetingParticipants.userId], references: [users.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const userSettingsRelations = relations(userSettings, ({ one }) => ({
  user: one(users, { fields: [userSettings.userId], references: [users.id] }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  project: one(projects, { fields: [invitations.projectId], references: [projects.id] }),
  inviter: one(users, { fields: [invitations.inviterUserId], references: [users.id] }),
}));

export const externalMeetingsRelations = relations(externalMeetings, ({ one }) => ({
  user: one(users, { fields: [externalMeetings.userId], references: [users.id] }),
  project: one(projects, { fields: [externalMeetings.projectId], references: [projects.id] }),
}));

// WebAuthn Authenticators table
export const authenticators = pgTable("authenticators", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  credentialId: text("credential_id").notNull().unique(),
  credentialPublicKey: text("credential_public_key").notNull(),
  counter: integer("counter").notNull().default(0),
  credentialDeviceType: text("credential_device_type").notNull(), // singleDevice, multiDevice
  credentialBackedUp: boolean("credential_backed_up").notNull().default(false),
  transports: jsonb("transports"), // Array of transport methods (usb, nfc, ble, internal)
  deviceName: text("device_name"), // User-friendly name for the device
  createdAt: timestamp("created_at").defaultNow(),
  lastUsedAt: timestamp("last_used_at"),
});

export const authenticatorsRelations = relations(authenticators, ({ one }) => ({
  user: one(users, { fields: [authenticators.userId], references: [users.id] }),
}));

// Login Events tracking table for security analytics
export const loginEvents = pgTable("login_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(), // login_success, login_failure, logout, biometric_login, biometric_failure
  method: text("method").notNull(), // password, biometric
  deviceName: text("device_name"),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  location: text("location"), // Optional: City, Country if IP geolocation is available
  sessionDuration: integer("session_duration"), // Duration in minutes, set on logout
  createdAt: timestamp("created_at").defaultNow(),
});

export const loginEventsRelations = relations(loginEvents, ({ one }) => ({
  user: one(users, { fields: [loginEvents.userId], references: [users.id] }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  dueDate: z.string().optional().nullable().transform(val => val ? new Date(val) : null),
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  dueDate: z.string().optional().nullable().transform(val => val ? new Date(val) : null),
}).partial({ dueDate: true });

export const insertMeetingSchema = createInsertSchema(meetings).omit({
  id: true,
  createdAt: true,
  recurringParentId: true, // This gets set automatically
}).extend({
  // Transform date fields for form handling
  scheduledAt: z.date(),
  // Include recurring fields explicitly
  isRecurring: z.boolean().default(false),
  recurrenceType: z.enum(["daily", "weekly", "monthly", "yearly"]).optional(),
  recurrenceInterval: z.number().min(1).max(99).optional(),
  recurrenceEndDate: z.string().optional(),
  recurrencePattern: z.string().optional(),
});

export const insertProjectMemberSchema = createInsertSchema(projectMembers).omit({
  id: true,
  joinedAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertUserSettingsSchema = createInsertSchema(userSettings).omit({
  id: true,
  updatedAt: true,
});

export const insertInvitationSchema = createInsertSchema(invitations).omit({
  id: true,
  createdAt: true,
  respondedAt: true,
}).extend({
  expiresAt: z.string().transform(val => new Date(val)),
});

export const insertAuthenticatorSchema = createInsertSchema(authenticators).omit({
  id: true,
  createdAt: true,
  lastUsedAt: true,
});

export const insertLoginEventSchema = createInsertSchema(loginEvents).omit({
  id: true,
  createdAt: true,
});

export const insertExternalMeetingSchema = createInsertSchema(externalMeetings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  startTime: z.string().transform(val => new Date(val)),
  endTime: z.string().transform(val => new Date(val)),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Meeting = typeof meetings.$inferSelect;
export type InsertMeeting = z.infer<typeof insertMeetingSchema>;
export type ProjectMember = typeof projectMembers.$inferSelect;
export type InsertProjectMember = z.infer<typeof insertProjectMemberSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type Invitation = typeof invitations.$inferSelect;
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type Authenticator = typeof authenticators.$inferSelect;
export type InsertAuthenticator = z.infer<typeof insertAuthenticatorSchema>;
export type LoginEvent = typeof loginEvents.$inferSelect;
export type InsertLoginEvent = z.infer<typeof insertLoginEventSchema>;
export type ExternalMeeting = typeof externalMeetings.$inferSelect;
export type InsertExternalMeeting = z.infer<typeof insertExternalMeetingSchema>;
