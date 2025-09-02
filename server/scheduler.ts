import { storage } from './storage';
import { aiService } from './services/ai';
import { emailService } from './services/email';

class NotificationScheduler {
  private intervals: NodeJS.Timeout[] = [];
  private lastDailySummaryDate: string = '';
  private lastLunchReminderDate: string = '';
  private lastEndOfDayDate: string = '';
  private lastResetDate: string = ''; // Track when we last reset alerts
  private sentDeadlineAlerts: Set<string> = new Set(); // Track sent alerts per day
  private sentProjectHealthAlerts: Set<string> = new Set(); // Track project health alerts per day
  
  private async getAllUsers() {
    try {
      const users = await storage.getAllUsers();
      return users.map(user => user.id);
    } catch (error) {
      console.error('Failed to get users for notifications:', error);
      return [];
    }
  }

  // Helper function to get all collaborators for a project (owner + members)
  private async getProjectCollaborators(projectId: string): Promise<string[]> {
    try {
      // Get project owner
      const project = await storage.getProject(projectId);
      if (!project) return [];
      
      const collaboratorIds = [project.ownerId]; // Start with owner
      
      // Get all project members
      const members = await storage.getProjectMembers(projectId);
      members.forEach(member => {
        if (!collaboratorIds.includes(member.userId)) {
          collaboratorIds.push(member.userId);
        }
      });
      
      return collaboratorIds;
    } catch (error) {
      console.error('Failed to get project collaborators:', error);
      return [];
    }
  }

  start() {
    console.log('Starting AI notification scheduler...');
    
    // Check for urgent notifications every 5 minutes
    const urgentCheck = setInterval(async () => {
      await this.checkUrgentNotifications();
    }, 5 * 60 * 1000);

    // Reset sent alerts daily at midnight UTC to allow daily reminders
    const resetAlertsCheck = setInterval(() => {
      const now = new Date();
      const utcHour = now.getUTCHours();
      const utcMinutes = now.getUTCMinutes();
      
      // Reset at midnight UTC (only once per day)
      if (utcHour === 0 && utcMinutes >= 0 && utcMinutes < 5) {
        const today = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
        
        if (this.lastResetDate !== today) {
          const previousSize = this.sentDeadlineAlerts.size;
          this.sentDeadlineAlerts.clear();
          this.sentProjectHealthAlerts.clear();
          this.lastResetDate = today;
          console.log(`🔄 Reset alert trackers for new day ${today} - cleared ${previousSize} deadline alerts`);
        }
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

    // Send daily briefings at the correct times matching UI: 7 AM, 12 PM, 5 PM
    const briefingCheck = setInterval(async () => {
      // Use Eastern Time (automatically handles EST/EDT)
      const now = new Date();
      const easternTime = new Date(now.toLocaleString("en-US", {timeZone: "America/New_York"}));
      const today = easternTime.toISOString().split('T')[0]; // YYYY-MM-DD format
      const hour = easternTime.getHours();
      const minutes = easternTime.getMinutes();
      
      
      // Morning Briefing: 7:00-7:05 AM (matches UI)
      if (hour === 7 && minutes >= 0 && minutes <= 5) {
        if (this.lastDailySummaryDate !== today) {
          console.log(`🌅 Triggering morning briefings for ${today} at 7 AM`);
          this.lastDailySummaryDate = today;
          await this.sendMorningBriefings();
        }
      }
      
      // Lunch Reminder: 12:00-12:05 PM (matches UI)
      if (hour === 12 && minutes >= 0 && minutes <= 5) {
        if (!this.lastLunchReminderDate || this.lastLunchReminderDate !== today) {
          console.log(`🥗 Triggering lunch reminders for ${today} at 12 PM`);
          this.lastLunchReminderDate = today;
          await this.sendLunchReminders();
        }
      }
      
      // End of Day Summary: 5:00-5:05 PM (matches UI) 
      if (hour === 17 && minutes >= 0 && minutes <= 5) {
        if (this.lastEndOfDayDate !== today) {
          console.log(`🌇 Triggering end-of-day summaries for ${today} at 5 PM`);
          this.lastEndOfDayDate = today;
          await this.sendEndOfDaySummary();
        }
      }
    }, 60 * 1000); // Check every minute

    // Check project health every hour
    const healthCheck = setInterval(async () => {
      await this.checkProjectHealth();
    }, 60 * 60 * 1000);

    this.intervals.push(urgentCheck, resetAlertsCheck, briefingCheck, healthCheck);
  }

  stop() {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
    console.log('Stopped AI notification scheduler');
  }

  async checkUrgentNotifications() {
    try {
      const userIds = await this.getAllUsers();
      
      for (const userId of userIds) {
        const tasks = await storage.getTasks(undefined, userId);
        const now = new Date();
        
        for (const task of tasks) {
          if (task.dueDate && task.status !== 'completed') {
            const dueDate = new Date(task.dueDate);
            const hoursUntilDue = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);
            
            // Send alert if task is due within 4 hours or overdue (but not more than 7 days overdue)
            if (hoursUntilDue <= 4 && hoursUntilDue >= -168) { // Extended to 7 days overdue
              // Use consistent UTC date to avoid timezone issues
              const utcDate = new Date();
              const today = `${utcDate.getUTCFullYear()}-${String(utcDate.getUTCMonth() + 1).padStart(2, '0')}-${String(utcDate.getUTCDate()).padStart(2, '0')}`;
              // Create unique identifier for this alert per day - only use task ID and today's date
              const alertId = `${task.id}_${today}`;
              
              // Skip if alert already sent today
              if (this.sentDeadlineAlerts.has(alertId)) {
                console.log(`⏭️ Deadline alert already sent today for task "${task.title}" (alert ID: ${alertId}, current alerts: ${this.sentDeadlineAlerts.size})`);
                continue;
              }

              console.log(`🔍 Processing deadline alert for task "${task.title}" - hours until due: ${hoursUntilDue.toFixed(1)}, alert ID: ${alertId}`);

              const project = await storage.getProject(task.projectId);
              if (!project) continue;
              
              // Get ALL project collaborators (owner + members)
              const collaboratorIds = await this.getProjectCollaborators(task.projectId);
              
              let alertSentToAnyUser = false;
              
              // Send alert to all collaborators who have deadline alerts enabled
              for (const collaboratorId of collaboratorIds) {
                const settings = await storage.getUserSettings(collaboratorId);
                
                // Check if user has enabled task deadline alerts
                if (!settings?.emailNotifications || !settings?.taskDeadlineAlerts) {
                  continue;
                }

                // Skip non-urgent notifications if user has urgent-only setting enabled
                if (settings.urgentOnly && hoursUntilDue > 0) {
                  continue;
                }

                const collaborator = await storage.getUser(collaboratorId);
                if (collaborator?.email) {
                  // Customize message based on whether task is overdue
                  const isOverdue = hoursUntilDue < 0;
                  const daysOverdue = Math.abs(Math.floor(hoursUntilDue / 24));
                  
                  await emailService.sendTaskDeadlineAlert(
                    collaborator.email,
                    task.title,
                    project.name,
                    task.dueDate.toString(),
                    isOverdue,
                    daysOverdue,
                    task.projectId,  // Pass projectId for direct link
                    task.id         // Pass taskId for direct link
                  );
                  
                  const alertType = isOverdue ? 'OVERDUE' : 'DEADLINE';
                  console.log(`⏰ ${alertType} alert sent for task "${task.title}" to ${collaborator.email} (daily reminder)`);
                  alertSentToAnyUser = true;
                }
              }
              
              // Mark alert as sent if at least one collaborator received it
              if (alertSentToAnyUser) {
                this.sentDeadlineAlerts.add(alertId);
                console.log(`✅ Marked deadline alert as sent for today: ${alertId} (total tracked alerts: ${this.sentDeadlineAlerts.size})`);
              } else {
                console.log(`⚠️ No alerts sent for task "${task.title}" - no eligible collaborators found`);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Urgent notifications check failed:', error);
    }
  }

  async sendMorningBriefings() {
    try {
      const userIds = await this.getAllUsers();
      console.log(`Daily summary check - found ${userIds.length} users`);
      
      for (const userId of userIds) {
        const user = await storage.getUser(userId);
        console.log(`Processing daily summary for user: ${user?.email || userId}`);
        
        let settings = await storage.getUserSettings(userId);
        
        // Create default settings if user doesn't have any
        if (!settings) {
          console.log(`Creating default settings for user: ${user?.email}`);
          settings = await storage.createUserSettings({
            userId,
            emailNotifications: true,
            morningBriefing: true,
            lunchReminder: true,
            taskDeadlineAlerts: true,
            endOfDaySummary: true,
            urgentOnly: false,
            workingHoursStart: '09:00',
            workingHoursEnd: '18:00'
          });
        }
        
        // Check if user has enabled daily email summaries
        if (!settings?.emailNotifications || !settings?.morningBriefing) {
          console.log(`Daily summary skipped for ${user?.email} - user preferences disabled`);
          continue;
        }

        // Morning briefings are sent at 7 AM regardless of working hours
        // (Working hours check is not applicable for morning briefings as they prepare you for the day)

        const projects = await storage.getProjects(userId);
        const tasks = await storage.getTasks(undefined, userId);
        const summary = await aiService.generateSmartDailyBriefing(projects, tasks, userId, user?.name);
        if (user?.email) {
          console.log(`Generating daily summary for: ${user.email}`);
          try {
            await emailService.sendDailySummary(user.email, summary);
            console.log(`✅ Daily summary sent successfully to: ${user.email}`);
          } catch (error: any) {
            console.error(`❌ Daily summary failed for ${user.email}:`, error?.message || error);
            
            // Log production email issues clearly
            if (error?.message?.includes('verify a domain') || error?.message?.includes('testing emails')) {
              console.error('🔧 PRODUCTION FIX NEEDED: Email domain not verified - check Resend dashboard');
            }
            
            // Continue processing other users even if one fails
          }
        } else {
          console.log(`Skipping daily summary - no email for user: ${userId}`);
        }
      }
      
      console.log('Morning briefings sent successfully');
    } catch (error) {
      console.error('Morning briefing failed:', error);
    }
  }

  // New lunch reminder functionality
  async sendLunchReminders() {
    try {
      const userIds = await this.getAllUsers();
      console.log(`Lunch reminder check - found ${userIds.length} users`);
      
      for (const userId of userIds) {
        const settings = await storage.getUserSettings(userId);
        
        // Check if user has enabled lunch reminders
        if (!settings?.emailNotifications || !settings?.lunchReminder) {
          console.log(`Lunch briefing skipped for ${userId} - user preferences disabled`);
          continue;
        }

        const user = await storage.getUser(userId);
        if (user?.email) {
          // Generate intelligent lunch briefing with afternoon preview
          const projects = await storage.getProjects(userId);
          const tasks = await storage.getTasks(undefined, userId);
          const lunchBriefing = await aiService.generateLunchBriefing(projects, tasks, userId);
          
          try {
            await emailService.sendLunchBriefing(user.email, lunchBriefing);
            console.log(`✅ Lunch briefing sent successfully to: ${user.email}`);
          } catch (error: any) {
            console.error(`❌ Lunch briefing failed for ${user.email}:`, error?.message || error);
          }
        }
      }
      
      console.log('Lunch briefings sent successfully');
    } catch (error) {
      console.error('Lunch briefing failed:', error);
    }
  }

  async sendEndOfDaySummary() {
    try {
      const userIds = await this.getAllUsers();
      
      for (const userId of userIds) {
        const settings = await storage.getUserSettings(userId);
        
        // Check if user has enabled end of day summaries
        if (!settings?.emailNotifications || !settings?.endOfDaySummary) {
          console.log('End of day summary skipped - user preferences disabled');
          continue;
        }

        const stats = await storage.getDashboardStats(userId);
        const tasks = await storage.getTasks(undefined, userId);
        const projects = await storage.getProjects(userId);

        const today = new Date();
        const todayString = today.toDateString();
        
        // Get tasks completed today
        const completedToday = tasks.filter(task => 
          task.status === 'completed' && 
          task.updatedAt && 
          new Date(task.updatedAt).toDateString() === todayString
        );

        // Get pending high-priority tasks for tomorrow 
        const tomorrowsPriorities = tasks.filter(task => 
          task.status !== 'completed' && 
          (task.priority === 'high' || task.priority === 'urgent')
        ).map(task => task.title).slice(0, 3);

        const summary = {
          date: today.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          }),
          completedTasks: completedToday.length, // Fixed field name to match email template
          activeProjects: projects.length,
          productivityScore: Math.round((completedToday.length / Math.max(tasks.length, 1)) * 100),
          accomplishments: completedToday.filter(task => 
            task.priority === 'high' || task.priority === 'urgent'
          ).map(task => task.title).slice(0, 3),
          tomorrowsPriorities: tomorrowsPriorities, // Added missing field
          message: completedToday.length > 0 
            ? `Great work today! You completed ${completedToday.length} tasks across ${projects.length} projects.`
            : `Ready for tomorrow! You have ${projects.length} active projects to focus on.`
        };
        
        const user = await storage.getUser(userId);
        if (user?.email) {
          await emailService.sendEndOfDaySummary(user.email, summary);
        }
      }
      
      console.log('End of day summary sent successfully');
    } catch (error) {
      console.error('End of day summary failed:', error);
    }
  }

  async checkProjectHealth() {
    try {
      const userIds = await this.getAllUsers();
      const checkedProjects = new Set<string>(); // Track projects to avoid duplicate checks
      
      for (const userId of userIds) {
        const projects = await storage.getProjects(userId);
        
        for (const project of projects) {
          // Skip if we already checked this project
          if (checkedProjects.has(project.id)) {
            continue;
          }
          checkedProjects.add(project.id);
          
          // Project health analysis - simplified for now
          const insights = { healthScore: 75, riskFactors: ['Minor delays detected'] };
          
          if (insights.healthScore < 60) {
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
            // Create unique identifier for this project health alert per day (allows daily reminders)
            const healthAlertId = `${project.id}_health_${today}`;
            
            // Skip if health alert already sent today for this project
            if (this.sentProjectHealthAlerts.has(healthAlertId)) {
              continue;
            }
            
            // Get ALL project collaborators (owner + members) 
            const collaboratorIds = await this.getProjectCollaborators(project.id);
            
            let healthAlertSentToAnyUser = false;
            
            // Send project health alert to all collaborators
            for (const collaboratorId of collaboratorIds) {
              const settings = await storage.getUserSettings(collaboratorId);
              
              // Check if user has enabled email notifications (project health uses general notifications)
              if (!settings?.emailNotifications) {
                continue;
              }

              const collaborator = await storage.getUser(collaboratorId);
              if (collaborator?.email) {
                await emailService.sendProjectAlert(
                  collaborator.email,
                  project.name,
                  'health_warning',
                  `Project health score is low (${insights.healthScore}%). ${insights.riskFactors.join(', ')} - Daily reminder until resolved.`
                );
                console.log(`🚨 Project health alert sent for "${project.name}" to ${collaborator.email} (daily reminder)`);
                healthAlertSentToAnyUser = true;
              }
            }
            
            // Mark health alert as sent today if at least one collaborator received it
            if (healthAlertSentToAnyUser) {
              this.sentProjectHealthAlerts.add(healthAlertId);
            }
          }
        }
      }
      
      console.log('Project health check completed');
    } catch (error) {
      console.error('Project health check failed:', error);
    }
  }
}

export const scheduler = new NotificationScheduler();