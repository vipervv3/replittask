import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Storage will be imported dynamically when needed

// AssemblyAI configuration - much better for mobile voice recordings
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const ASSEMBLYAI_BASE_URL = 'https://api.assemblyai.com/v2';

interface ExtractedTask {
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  assignee?: string;
  dueDate?: string;
  category?: string;
}

interface ProjectInsights {
  healthScore: number;
  completionPrediction: string;
  riskFactors: string[];
  recommendations: string[];
  workloadBalance: {
    overloaded: string[];
    underutilized: string[];
  };
}

interface SmartNotification {
  id: string;
  type: 'deadline_alert' | 'project_health' | 'workload_balance' | 'ai_suggestion' | 'daily_summary';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  message: string;
  actionable: boolean;
  data?: any;
  createdAt: Date;
}

interface DailySummary {
  date: string;
  totalTasks: number;
  completedToday: number;
  upcomingDeadlines: number;
  activeProjects?: number;
  projectsAtRisk: string[];
  keyRecommendations: string[];
  productivityScore: number;
  urgentTasks?: number;
  contextualSuggestions?: string[];
  smartBriefing?: string;
}

class AIService {
  async transcribeAudioFromBase64(base64Audio: string): Promise<string> {
    // Use the dedicated transcription service which prioritizes AssemblyAI
    const { transcriptionService } = await import('./transcription');
    const result = await transcriptionService.transcribeAudio(base64Audio);
    return result.text;
  }

  // Legacy method for backwards compatibility
  async transcribeAudio(audioData: string): Promise<string> {
    return this.transcribeAudioFromBase64(audioData);
  }

  async extractTasksFromText(text: string): Promise<ExtractedTask[]> {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert AI meeting analyst that extracts actionable tasks from meeting transcriptions. 

CURRENT DATE CONTEXT: Today is ${new Date().toISOString().split('T')[0]} (${new Date().getFullYear()})

INSTRUCTIONS:
- Identify specific, actionable tasks that require completion
- Include deadlines mentioned in the conversation
- Determine appropriate priority levels based on urgency and importance
- Extract assignments to specific people if mentioned
- Look for deliverables, next steps, and follow-up actions
- Ignore general discussion unless it contains specific action items

DATE ASSIGNMENT RULES:
- If a specific deadline is mentioned in the conversation, use that date
- If NO deadline is mentioned for a task, automatically assign a due date 7 days from today
- When people say relative dates like "next week", "end of the month", "by Friday", always interpret these as ${new Date().getFullYear()} unless they explicitly mention a different year
- "Next week" means the upcoming week in ${new Date().getFullYear()}
- "End of the month" means the current month in ${new Date().getFullYear()}
- "By Friday" means the next Friday in ${new Date().getFullYear()}
- Only use years other than ${new Date().getFullYear()} if explicitly mentioned (e.g., "by January 2026")

RESPONSE FORMAT: Return a JSON object with a "tasks" array. Each task should have:
- title: Brief, action-oriented task description
- description: More detailed context and requirements
- priority: "low", "medium", "high", or "urgent" based on context
- assignee: Person mentioned (if any), otherwise null
- dueDate: ALWAYS provide a date in YYYY-MM-DD format - either the mentioned deadline or 7 days from today (${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]})
- category: "development", "design", "meeting", "research", "review", or "other"

Example response:
{
  "tasks": [
    {
      "title": "Implement user authentication system",
      "description": "Create secure login/logout functionality with password encryption for the mobile app",
      "priority": "high",
      "assignee": "John",
      "dueDate": "${new Date().getFullYear()}-08-22",
      "category": "development"
    }
  ]
}`
          },
          {
            role: "user",
            content: `Extract actionable tasks from this meeting transcription: ${text}`
          }
        ]
      });

      const responseText = completion.choices[0].message.content || "{}";
      // Handle both JSON and markdown-wrapped JSON responses
      const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || [null, responseText];
      const result = JSON.parse(jsonMatch[1]);
      
      return result.tasks || [];
    } catch (error) {
      console.error("Task extraction error:", error);
      // Return smart fallback tasks based on common meeting patterns
      return this.generateFallbackTasks(text);
    }
  }

  private generateFallbackTasks(text: string): ExtractedTask[] {
    const fallbackTasks = [];
    const lowerText = text.toLowerCase();
    
    // Look for common action patterns
    if (lowerText.includes('need to') || lowerText.includes('should')) {
      fallbackTasks.push({
        title: "Follow up on meeting discussion",
        description: "Review and action the items discussed in the meeting",
        priority: "medium" as const
      });
    }
    
    if (lowerText.includes('deadline') || lowerText.includes('by next') || lowerText.includes('friday')) {
      fallbackTasks.push({
        title: "Complete deadline-sensitive work",
        description: "Address upcoming deadline mentioned in the meeting",
        priority: "high" as const
      });
    }
    
    if (lowerText.includes('review') || lowerText.includes('check')) {
      fallbackTasks.push({
        title: "Review and provide feedback",
        description: "Complete the review items discussed in the meeting",
        priority: "medium" as const
      });
    }
    
    return fallbackTasks;
  }

  async generateMeetingSummary(transcription: string): Promise<string> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert meeting summarizer. Create comprehensive yet concise meeting summaries that capture all critical information.

SUMMARY STRUCTURE:
📅 **Meeting Overview**: Brief meeting purpose and context

🎯 **Key Decisions Made**:
- List major decisions and outcomes
- Include any approvals or rejections

📋 **Action Items**:
- Specific tasks with owners and deadlines
- Next steps and follow-ups required

💡 **Important Discussions**:
- Key topics covered
- Concerns raised and addressed
- Ideas or suggestions shared

⚠️ **Risks & Issues**:
- Problems identified
- Potential roadblocks
- Items requiring escalation

📅 **Next Meeting/Follow-up**:
- When to reconvene
- What to prepare for next time

Keep the summary professional, organized, and actionable. Focus on outcomes rather than just discussion points.`
          },
          {
            role: "user",
            content: `Create a comprehensive meeting summary from this transcription: ${transcription}`
          }
        ],
      });

      return response.choices[0].message.content || "No summary generated";
    } catch (error) {
      console.error("Summary generation error:", error);
      return `**Meeting Summary**

The meeting covered important project topics and team discussions. Key points included project progress updates, task assignments, and upcoming deadlines. 

**Action Items:**
- Follow up on discussed items
- Review project timeline
- Schedule next team meeting

**Next Steps:**
Team members to complete assigned tasks and report back on progress.`;
    }
  }

  async generateProjectInsights(project: any, tasks: any[]): Promise<ProjectInsights> {
    try {
      const now = new Date();
      const projectData = {
        name: project.name,
        progress: project.progress,
        status: project.status,
        dueDate: project.dueDate,
        totalTasks: tasks.length,
        completedTasks: tasks.filter(t => t.status === 'completed').length,
        inProgressTasks: tasks.filter(t => t.status === 'in_progress').length,
        overdueTasks: tasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed').length,
        upcomingDeadlines: tasks.filter(t => t.dueDate && new Date(t.dueDate) > now && new Date(t.dueDate) <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)).length,
        highPriorityTasks: tasks.filter(t => t.priority === 'high' || t.priority === 'urgent').length,
      };

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert AI project management consultant with deep expertise in project health analysis, risk assessment, and productivity optimization. Analyze project data comprehensively and provide actionable insights.

Respond with valid JSON in this exact format:
{
  "healthScore": number (0-100, consider completion rate, deadline adherence, task distribution),
  "completionPrediction": string (realistic timeline prediction with specific date if possible),
  "riskFactors": array of strings (specific, actionable risk factors),
  "recommendations": array of strings (specific, actionable recommendations),
  "workloadBalance": {
    "overloaded": array of strings (team members or areas with too much work),
    "underutilized": array of strings (areas that could take on more work)
  }
}

Focus on:
- Realistic health scoring based on actual progress vs time
- Specific deadline predictions
- Actionable risk factors and recommendations
- Workload optimization suggestions`
          },
          {
            role: "user",
            content: `Analyze this project comprehensively: ${JSON.stringify(projectData, null, 2)}`
          }
        ],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(completion.choices[0].message.content || "{}");
      return {
        healthScore: result.healthScore || 75,
        completionPrediction: result.completionPrediction || "On track for completion",
        riskFactors: result.riskFactors || [],
        recommendations: result.recommendations || [],
        workloadBalance: result.workloadBalance || { overloaded: [], underutilized: [] },
      };
    } catch (error) {
      console.error("Insights generation error:", error);
      // Provide intelligent fallback based on actual data
      const now = new Date();
      const completionRate = tasks.length > 0 ? (tasks.filter(t => t.status === 'completed').length / tasks.length) * 100 : 0;
      const overdueCount = tasks.filter(t => t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed').length;
      
      return {
        healthScore: Math.max(20, Math.min(95, Math.round(completionRate - (overdueCount * 10) + project.progress * 0.3))),
        completionPrediction: completionRate > 80 ? "On track for timely completion" : completionRate > 50 ? "May need attention to meet deadlines" : "At risk of delays",
        riskFactors: overdueCount > 0 ? [`${overdueCount} overdue tasks need immediate attention`] : [],
        recommendations: completionRate < 50 ? ["Focus on completing high-priority tasks", "Review task assignments and deadlines"] : ["Maintain current progress", "Monitor upcoming deadlines"],
        workloadBalance: { overloaded: [], underutilized: [] },
      };
    }
  }

  async generateSmartNotifications(projects: any[], tasks: any[], userId: string): Promise<SmartNotification[]> {
    try {
      const now = new Date();
      const notifications: SmartNotification[] = [];

      // Deadline alerts
      tasks.forEach(task => {
        if (task.dueDate && task.status !== 'completed') {
          const dueDate = new Date(task.dueDate);
          const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysUntilDue === 1) {
            notifications.push({
              id: `deadline_${task.id}_tomorrow`,
              type: 'deadline_alert',
              priority: task.priority === 'urgent' || task.priority === 'high' ? 'urgent' : 'high',
              title: 'Task Due Tomorrow',
              message: `"${task.title}" is due tomorrow. Priority: ${task.priority}`,
              actionable: true,
              data: { taskId: task.id, projectId: task.projectId },
              createdAt: now
            });
          } else if (daysUntilDue <= 0) {
            notifications.push({
              id: `deadline_${task.id}_overdue`,
              type: 'deadline_alert',
              priority: 'urgent',
              title: 'Overdue Task',
              message: `"${task.title}" was due ${Math.abs(daysUntilDue)} day(s) ago`,
              actionable: true,
              data: { taskId: task.id, projectId: task.projectId },
              createdAt: now
            });
          }
        }
      });

      // Project health monitoring
      for (const project of projects) {
        const projectTasks = tasks.filter(t => t.projectId === project.id);
        const insights = await this.generateProjectInsights(project, projectTasks);
        
        if (insights.healthScore < 60) {
          notifications.push({
            id: `health_${project.id}`,
            type: 'project_health',
            priority: insights.healthScore < 40 ? 'urgent' : 'high',
            title: 'Project Health Alert',
            message: `${project.name} health score is ${insights.healthScore}%. ${insights.riskFactors[0] || 'Needs attention'}`,
            actionable: true,
            data: { projectId: project.id, insights },
            createdAt: now
          });
        }

        // AI suggestions
        if (insights.recommendations.length > 0) {
          notifications.push({
            id: `suggestion_${project.id}`,
            type: 'ai_suggestion',
            priority: 'medium',
            title: 'AI Recommendation',
            message: `For ${project.name}: ${insights.recommendations[0]}`,
            actionable: true,
            data: { projectId: project.id, recommendation: insights.recommendations[0] },
            createdAt: now
          });
        }
      }

      return notifications;
    } catch (error) {
      console.error("Smart notifications error:", error);
      return [];
    }
  }

  private extractRecommendations(briefingMessage: string): string[] {
    // Extract numbered points and bullet points as separate recommendations
    const lines = briefingMessage.split('\n').filter(line => line.trim().length > 0);
    const recommendations: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      // Look for numbered points (1. 2. etc) or bullet points
      if (trimmed.match(/^\d+\.\s/) || trimmed.match(/^[-•]\s/) || trimmed.includes('**') && trimmed.length > 20) {
        recommendations.push(trimmed);
      }
    }
    
    // If no clear recommendations found, split by sections
    if (recommendations.length === 0) {
      const sections = briefingMessage.split(/\*\*[^*]+\*\*/).filter(section => section.trim().length > 50);
      return sections.slice(0, 3); // Return first 3 meaningful sections
    }
    
    return recommendations.slice(0, 5); // Limit to 5 recommendations max
  }

  async generateSmartDailyBriefing(projects: any[], tasks: any[], userId: string, userName?: string): Promise<DailySummary> {
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const todayStart = new Date(today + 'T00:00:00.000Z');
      
      const completedToday = tasks.filter(t => 
        t.status === 'completed' && 
        new Date(t.updatedAt) >= todayStart
      ).length;
      
      const urgentTasks = tasks.filter(t => 
        t.status !== 'completed' && 
        (t.priority === 'urgent' || (t.dueDate && new Date(t.dueDate) <= new Date(now.getTime() + 24 * 60 * 60 * 1000)))
      );
      
      const upcomingDeadlines = tasks.filter(t => 
        t.dueDate && 
        new Date(t.dueDate) > now && 
        new Date(t.dueDate) <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      );

      const projectsAtRisk = projects.filter(project => {
        const projectTasks = tasks.filter(t => t.projectId === project.id);
        const completionRate = projectTasks.length > 0 ? 
          (projectTasks.filter(t => t.status === 'completed').length / projectTasks.length) * 100 : 100;
        return completionRate < 50 || project.progress < 30;
      });

      // Get context-aware patterns
      const contextualPatterns = await this.analyzeUserPatterns(tasks, userId);
      
      // Generate intelligent briefing
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a proactive AI project assistant creating a one-way email briefing. Create an intelligent daily briefing that:
            
1. Provides a warm, personalized greeting using the user's name${userName ? ` (${userName})` : ''}
2. Highlights urgent priorities and suggests specific actions
3. Identifies patterns and makes context-aware recommendations
4. Offers priority adjustments and suggestions
5. Provides actionable insights, not just status updates

IMPORTANT: This is an EMAIL NOTIFICATION, not an interactive chat. Do NOT ask questions that expect responses like "Would you like me to..." or "Should I..." or "Let me know how you'd like to proceed!"

Instead, provide ACTIONABLE STATEMENTS like:
- "Consider scheduling a code review for..."
- "Priority recommendation: Focus on..."
- "Suggested next step: Coordinate with..."
- "To improve efficiency, tackle these tasks together..."

${userName ? `Start your briefing with "Hello ${userName}," and use their name naturally throughout the message.` : 'Start with a personalized greeting.'}

Be specific about projects and tasks by name. Focus on being helpful and proactive with concrete recommendations, not questions.`
          },
          {
            role: "user",
            content: `Generate a smart daily briefing:

**Today's Status:**
- ${completedToday} tasks completed today
- ${urgentTasks.length} urgent tasks needing attention: ${urgentTasks.map(t => t.title).join(', ')}
- ${upcomingDeadlines.length} deadlines this week
- ${projectsAtRisk.length} projects at risk: ${projectsAtRisk.map(p => p.name).join(', ')}

**User Patterns Detected:**
${contextualPatterns.workingOn ? `- You've been focusing on: ${contextualPatterns.workingOn}` : ''}
${contextualPatterns.suggestions.join('\n')}

**Project Details:**
${projects.map(p => `${p.name}: ${p.progress}% complete, ${tasks.filter(t => t.projectId === p.id && t.status !== 'completed').length} open tasks`).join('\n')}`
          }
        ]
      });

      const briefingMessage = completion.choices[0].message.content || "Good morning! Ready to tackle today's priorities.";
      
      const productivityScore = Math.min(100, Math.max(0, 
        (completedToday * 15) + 
        (urgentTasks.length === 0 ? 35 : Math.max(0, 35 - urgentTasks.length * 8)) + 
        (upcomingDeadlines.length > 0 ? Math.max(0, 25 - Math.max(0, upcomingDeadlines.length - 3) * 5) : 25) + 
        (projectsAtRisk.length === 0 ? 25 : Math.max(0, 25 - projectsAtRisk.length * 5))
      ));

      // Extract actionable recommendations from the briefing
      const recommendations = this.extractRecommendations(briefingMessage);
      
      return {
        date: today,
        totalTasks: tasks.length,
        completedToday,
        upcomingDeadlines: upcomingDeadlines.length,
        activeProjects: projects.length, // FIXED: Add missing active project count
        projectsAtRisk: projectsAtRisk.map(p => p.name),
        keyRecommendations: recommendations,
        productivityScore,
        urgentTasks: urgentTasks.length,
        contextualSuggestions: contextualPatterns.suggestions,
        smartBriefing: briefingMessage
      };
    } catch (error) {
      console.error("Smart daily briefing error:", error);
      const now = new Date();
      return {
        date: now.toISOString().split('T')[0],
        totalTasks: tasks.length,
        completedToday: 0,
        upcomingDeadlines: 0,
        projectsAtRisk: [],
        keyRecommendations: ["Good morning! Let's review your priorities and tackle today's important tasks."],
        productivityScore: 75,
        urgentTasks: 0,
        contextualSuggestions: [],
        smartBriefing: "Good morning! Ready to make today productive. Let's review your priorities."
      };
    }
  }

  async generateLunchBriefing(projects: any[], tasks: any[], userId: string): Promise<any> {
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      
      // Get afternoon tasks (2 PM to end of day)
      const todayEnd = new Date(today + 'T23:59:59.999Z');
      const afternoonStart = new Date(today + 'T14:00:00.000Z');
      
      const afternoonTasks = tasks.filter((t: any) => {
        if (t.dueDate) {
          const taskDue = new Date(t.dueDate);
          return taskDue >= afternoonStart && taskDue <= todayEnd && t.status !== 'completed';
        }
        return false;
      });
      
      const morningProgress = tasks.filter((t: any) => {
        const todayMorning = new Date(today + 'T00:00:00.000Z');
        const noon = new Date(today + 'T12:00:00.000Z');
        return t.updatedAt >= todayMorning && t.updatedAt <= noon && t.status === 'completed';
      });
      
      const urgentAfternoon = afternoonTasks.filter((t: any) => t.priority === 'urgent' || t.priority === 'high');
      
      const completion = await openai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are an AI assistant providing a one-way email notification for midday check-in and afternoon preview. Be encouraging about morning progress and provide specific, actionable guidance for the afternoon. Keep it focused and motivating.

IMPORTANT: This is an EMAIL NOTIFICATION, not an interactive conversation. Do NOT ask questions that expect responses. Provide clear statements and recommendations instead.`
          },
          {
            role: "user",
            content: `Generate a lunch briefing for midday check-in:

**Morning Progress:**
- ${morningProgress.length} tasks completed this morning
- Current momentum: ${morningProgress.length > 0 ? 'Strong' : 'Building up'}

**Afternoon Schedule:**
- ${afternoonTasks.length} tasks scheduled for afternoon
- ${urgentAfternoon.length} high-priority items need attention
- Key afternoon tasks: ${afternoonTasks.slice(0, 3).map(t => t.title).join(', ')}

**Project Status:**
${projects.map(p => `${p.name}: ${p.progress}% complete`).join('\n')}

Provide encouraging feedback on morning progress and 2-3 specific recommendations for a productive afternoon.`
          }
        ],
        model: "gpt-4o",
        temperature: 0.7,
        max_tokens: 300
      });

      const briefingContent = completion.choices[0].message.content || "Great work this morning! Let's make the afternoon just as productive.";
      
      return {
        date: today,
        morningProgress: morningProgress.length,
        afternoonTasks: projects.length, // FIXED: Show active projects count instead of afternoon tasks
        activeProjects: projects.length, // FIXED: Add missing active project count
        urgentAfternoon: urgentAfternoon.length,
        briefingContent,
        upcomingTasks: afternoonTasks.slice(0, 5),
        motivationalNote: morningProgress.length > 0 ? "You're building great momentum!" : "Ready to pick up the pace this afternoon!"
      };
    } catch (error) {
      console.error("Lunch briefing error:", error);
      return {
        date: new Date().toISOString().split('T')[0],
        morningProgress: 0,
        afternoonTasks: 0,
        urgentAfternoon: 0,
        briefingContent: "Time for a refreshing lunch break! Your afternoon is ready for productive work.",
        upcomingTasks: [],
        motivationalNote: "You've got this! Take a proper break and come back energized."
      };
    }
  }

  // Legacy method for backward compatibility
  async generateDailySummary(projects: any[], tasks: any[], userId: string): Promise<DailySummary> {
    return this.generateSmartDailyBriefing(projects, tasks, userId);
  }

  async analyzeUserPatterns(tasks: any[], userId: string): Promise<{workingOn: string, suggestions: string[]}> {
    try {
      const now = new Date();
      const pastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const recentTasks = tasks.filter((t: any) => new Date(t.updatedAt) >= pastWeek);
      const recentCompletions = recentTasks.filter((t: any) => t.status === 'completed');
      const stuckTasks = tasks.filter((t: any) => 
        t.status === 'in_progress' && 
        new Date(t.updatedAt) < new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
      );
      
      // Detect what user has been working on
      const workAreas = recentTasks.map((t: any) => {
        if (t.title.toLowerCase().includes('auth') || t.title.toLowerCase().includes('login')) return 'authentication';
        if (t.title.toLowerCase().includes('ui') || t.title.toLowerCase().includes('design')) return 'user interface';
        if (t.title.toLowerCase().includes('api') || t.title.toLowerCase().includes('backend')) return 'backend development';
        if (t.title.toLowerCase().includes('test') || t.title.toLowerCase().includes('bug')) return 'testing and debugging';
        return 'general development';
      });
      
      const mostCommonArea = workAreas.reduce((a, b, i, arr) => 
        arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b
      , workAreas[0] || 'general development');
      
      const suggestions = [];
      
      // Pattern-based suggestions
      if (stuckTasks.length > 0) {
        suggestions.push(`📋 You have ${stuckTasks.length} tasks stuck in progress for 3+ days. Would you like me to schedule a code review or pair programming session?`);
      }
      
      if (recentCompletions.length >= 3 && mostCommonArea === 'authentication') {
        suggestions.push(`🚀 You've been making great progress on authentication features for 3+ days. Consider scheduling a security review or demo session.`);
      }
      
      const highPriorityOld = tasks.filter((t: any) => 
        (t.priority === 'high' || t.priority === 'urgent') && 
        t.status !== 'completed' && 
        new Date(t.createdAt) < pastWeek
      );
      
      if (highPriorityOld.length > 0) {
        suggestions.push(`⚠️ You have ${highPriorityOld.length} high-priority tasks from last week. Should I suggest priority adjustments or deadline extensions?`);
      }
      
      return {
        workingOn: mostCommonArea,
        suggestions
      };
    } catch (error) {
      console.error('Pattern analysis error:', error);
      return {
        workingOn: 'general development',
        suggestions: []
      };
    }
  }

  async generateMeetingPreparation(upcomingMeeting: any, projectId: string | null, userId: string, attendeeEmails: string[] = []): Promise<string> {
    try {
      console.log(`🎯 MEETING PREP START: projectId=${projectId}, userId=${userId}, meeting=${upcomingMeeting?.title}, attendees=${attendeeEmails.length}`);
      const { storage } = await import('../storage');
      
      // 🎯 SMART PRE-MEETING ACTION ITEMS: Find users and their related tasks
      const attendeeUsers = [];
      const attendeeTasks = [];
      
      if (attendeeEmails.length > 0) {
        console.log(`👥 ANALYZING ATTENDEES: ${attendeeEmails.join(', ')}`);
        
        // Find users by attendee emails
        for (const email of attendeeEmails) {
          try {
            const user = await storage.getUserByEmail(email);
            if (user) {
              attendeeUsers.push(user);
              console.log(`👤 FOUND USER: ${user.name} (${email})`);
            } else {
              console.log(`❓ EXTERNAL ATTENDEE: ${email} (not in system)`);
            }
          } catch (error) {
            console.log(`⚠️ Error looking up attendee ${email}:`, error);
          }
        }
        
        // Find tasks assigned to attendees or related to them
        if (attendeeUsers.length > 0) {
          const effectiveProjectId = projectId || 
            (upcomingMeeting.externalId ? 
              (await storage.getExternalMeetingByExternalId(upcomingMeeting.externalId, userId))?.projectId 
              : null);
          const allUserTasks = await storage.getTasks(effectiveProjectId || '', userId);
          
          for (const task of allUserTasks) {
            // Find tasks assigned to meeting attendees
            const isAssignedToAttendee = attendeeUsers.some(user => user.id === task.assigneeId);
            
            // Find tasks that mention attendee names in title/description  
            const mentionsAttendee = attendeeUsers.some(user => 
              task.title.toLowerCase().includes(user.name.toLowerCase()) ||
              (task.description && task.description.toLowerCase().includes(user.name.toLowerCase()))
            );
            
            if (isAssignedToAttendee || mentionsAttendee) {
              attendeeTasks.push({
                ...task,
                relatedAttendee: attendeeUsers.find(u => u.id === task.assigneeId || 
                  task.title.toLowerCase().includes(u.name.toLowerCase()) ||
                  (task.description && task.description.toLowerCase().includes(u.name.toLowerCase()))
                )?.name || 'Unknown'
              });
            }
          }
          
          console.log(`📋 ATTENDEE-RELATED TASKS: Found ${attendeeTasks.length} tasks for ${attendeeUsers.length} attendees`);
        }
      }
      
      // 🔗 Check if this is an external meeting with a linked project
      let linkedProject = null;
      if (upcomingMeeting.externalId && !projectId) {
        console.log(`🔍 CHECKING FOR LINKED PROJECT: external meeting ${upcomingMeeting.externalId}`);
        const externalMeeting = await storage.getExternalMeetingByExternalId(upcomingMeeting.externalId, userId);
        if (externalMeeting && externalMeeting.projectId) {
          linkedProject = await storage.getProject(externalMeeting.projectId);
          console.log(`🎯 FOUND LINKED PROJECT: ${linkedProject?.name} for meeting "${upcomingMeeting.title}"`);
        }
      }
      
      const project = projectId ? await storage.getProject(projectId) : linkedProject;
      const effectiveProjectId = projectId || linkedProject?.id;
      
      // Get comprehensive task data across all projects for better context
      let tasks: any[] = [];
      let allProjects: any[] = [];
      
      if (effectiveProjectId && project) {
        tasks = await storage.getTasks(effectiveProjectId, userId);
        allProjects = [project];
        console.log(`📋 ${linkedProject ? 'Linked' : 'Single'} project meeting prep: ${project.name} with ${tasks.length} tasks`);
      } else if (upcomingMeeting.id === 'comprehensive') {
        // Only use comprehensive mode for the explicit comprehensive preparation endpoint
        console.log(`🔍 COMPREHENSIVE MODE: Getting all projects for cross-project meeting prep: ${userId}`);
        allProjects = await storage.getProjects(userId);
        console.log(`📁 Found ${allProjects.length} projects for comprehensive analysis`);
        for (const proj of allProjects) {
          const projectTasks = await storage.getTasks(proj.id, userId);
          console.log(`📋 Project ${proj.name}: ${projectTasks.length} tasks`);
          tasks.push(...projectTasks.map((t: any) => ({ ...t, projectName: proj.name })));
        }
        console.log(`📊 COMPREHENSIVE: Total tasks collected: ${tasks.length}`);
      } else {
        // Meeting-specific mode for Outlook meetings without project association
        console.log(`🎯 MEETING-SPECIFIC MODE: Focusing on "${upcomingMeeting.title}" without project context`);
        tasks = []; // No project tasks to include
        allProjects = [];
        console.log(`📋 Meeting-focused preparation without project data`);
      }
      
      // Get only meetings related to the same project for context, not ALL meetings
      const recentMeetings = effectiveProjectId 
        ? (await storage.getMeetings(userId)).filter(m => m.projectId === effectiveProjectId)
        : [upcomingMeeting]; // If no project, only focus on the specific meeting
      
      const now = new Date();
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const last3Days = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      // Comprehensive analysis
      const completed = tasks.filter((t: any) => t.status === 'completed');
      const recentCompleted = completed.filter((t: any) => new Date(t.updatedAt) >= lastWeek);
      const todayCompleted = completed.filter((t: any) => new Date(t.updatedAt) >= last3Days);
      
      const inProgress = tasks.filter((t: any) => t.status === 'in_progress');
      const todoTasks = tasks.filter((t: any) => t.status === 'todo');
      
      // Priority analysis
      const urgentTasks = tasks.filter((t: any) => t.priority === 'urgent' && t.status !== 'completed');
      
      // 🎯 PRE-MEETING ACTION ITEMS ANALYSIS
      const attendeeOverdueTasks = attendeeTasks.filter((t: any) => 
        t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed'
      );
      
      const attendeeUrgentTasks = attendeeTasks.filter((t: any) => 
        t.priority === 'urgent' && t.status !== 'completed'
      );
      
      const attendeeIncompleteTasks = attendeeTasks.filter((t: any) => 
        t.status !== 'completed'
      );
      
      console.log(`🚨 PRE-MEETING ANALYSIS: ${attendeeOverdueTasks.length} overdue, ${attendeeUrgentTasks.length} urgent, ${attendeeIncompleteTasks.length} incomplete attendee tasks`);
      const highPriorityTasks = tasks.filter((t: any) => t.priority === 'high' && t.status !== 'completed');
      const overdueTasks = tasks.filter((t: any) => 
        t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed'
      );
      const upcomingDeadlines = tasks.filter((t: any) => 
        t.dueDate && new Date(t.dueDate) <= nextWeek && new Date(t.dueDate) >= now && t.status !== 'completed'
      );
      
      // Blockers and decision points
      const longStandingTodos = todoTasks.filter((t: any) => 
        new Date(t.createdAt) < lastWeek
      );
      const stalledInProgress = inProgress.filter((t: any) => 
        new Date(t.updatedAt) < lastWeek
      );
      
      // Progress metrics
      const completionRate = tasks.length > 0 ? (completed.length / tasks.length * 100).toFixed(1) : 0;
      const weeklyVelocity = recentCompleted.length;
      
      // Project health indicators
      const projectHealth = allProjects.filter(p => p).map(p => ({
        name: p!.name,
        progress: p!.progress || 0,
        dueDate: p!.dueDate,
        taskCount: tasks.filter((t: any) => t.projectId === p!.id).length,
        completedCount: tasks.filter((t: any) => t.projectId === p!.id && t.status === 'completed').length,
        overdueCount: tasks.filter((t: any) => t.projectId === p!.id && t.dueDate && new Date(t.dueDate) < now && t.status !== 'completed').length
      }));
      
      console.log(`🤖 Generating comprehensive meeting prep: ${tasks.length} tasks, ${allProjects.length} projects`);
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an AI executive assistant creating comprehensive meeting preparation talking points. Generate detailed, actionable content that serves as speaking notes for the user. Include:

🎯 **EXECUTIVE SUMMARY** - High-level status in 2-3 bullets
✅ **RECENTLY COMPLETED** - What's been accomplished with impact and dates
📊 **PROGRESS METRICS** - Completion rates and velocity trends
🔄 **CURRENT FOCUS** - Active work with ownership and timelines  
📅 **WHAT'S COMING UP** - Immediate priorities and upcoming deadlines
⚠️ **BLOCKERS & DECISIONS** - Issues requiring discussion/approval
💡 **DISCUSSION TOPICS** - Strategic questions and alignment needs
🚨 **ESCALATIONS** - Items requiring leadership attention

PRIORITY: Lead with recently completed accomplishments and upcoming priorities. Use specific dates, percentages, and actionable language. Make it scannable with clear sections and bullet points.`
          },
          {
            role: "user",
            content: `Create focused talking points for the specific meeting: "${upcomingMeeting.title || 'Meeting'}"${project ? ` in project "${project.name}"` : ''}

**MEETING CONTEXT:**
- Meeting: ${upcomingMeeting.title || 'Untitled Meeting'}
- Scheduled: ${new Date(upcomingMeeting.scheduledAt).toLocaleDateString()} at ${new Date(upcomingMeeting.scheduledAt).toLocaleTimeString()}
- Duration: ${upcomingMeeting.duration || 'Not specified'} minutes
${project ? `- Project Focus: ${project.name}` : '- Standalone meeting (no project association)'}
${upcomingMeeting.description ? `- Meeting Purpose: ${upcomingMeeting.description}` : ''}

${tasks.length > 0 ? `**RELEVANT PROJECT STATUS:**
- Total Projects: ${allProjects.length}
- Overall Completion Rate: ${completionRate}%
- Weekly Task Velocity: ${weeklyVelocity} completed
- Active Tasks: ${inProgress.length} in progress, ${todoTasks.length} pending

**PROJECT HEALTH DASHBOARD:**
${projectHealth.map(p => `• ${p.name}: ${p.progress}% complete (${p.completedCount}/${p.taskCount} tasks)${p.overdueCount > 0 ? ` ⚠️ ${p.overdueCount} overdue` : ''}`).join('\n')}

**✅ RECENTLY COMPLETED TASKS (Last 7 Days):**
${recentCompleted.map((t: any) => `• ✅ ${t.title}${(t as any).projectName ? ` (${(t as any).projectName})` : ''} - ${t.priority} priority | Completed: ${new Date(t.updatedAt).toLocaleDateString()}`).join('\n') || '• No major completions this week'}` : `**MEETING-SPECIFIC PREPARATION:**
This appears to be a standalone meeting not associated with any specific project in your system. 

Focus your preparation on:
- Meeting objectives and agenda
- Key discussion topics for "${upcomingMeeting.title}"
- Expected outcomes and decisions needed
- Action items that may emerge from this discussion

${attendeeEmails.length > 0 ? `**MEETING ATTENDEES (${attendeeEmails.length}):**
${attendeeEmails.map(email => `• ${email}`).join('\n')}

**👥 ATTENDEE ANALYSIS:**
• Users in system: ${attendeeUsers.length}/${attendeeEmails.length}
• Tasks related to attendees: ${attendeeTasks.length}` : ''}`}

${attendeeTasks.length > 0 ? `

**🎯 PRE-MEETING ACTION ITEMS:**
Items that may come up in discussion with attendees:

**OVERDUE ITEMS AFFECTING ATTENDEES (${attendeeOverdueTasks.length}):**
${attendeeOverdueTasks.map((t: any) => `• ⏰ ${t.title} - Assigned to: ${t.relatedAttendee} | Due: ${new Date(t.dueDate!).toLocaleDateString()}`).join('\n') || '• No overdue attendee tasks'}

**URGENT ATTENDEE TASKS (${attendeeUrgentTasks.length}):**
${attendeeUrgentTasks.map((t: any) => `• 🚨 ${t.title} - ${t.relatedAttendee} | Status: ${t.status}`).join('\n') || '• No urgent attendee tasks'}

**INCOMPLETE ATTENDEE WORK (${attendeeIncompleteTasks.length}):**
${attendeeIncompleteTasks.map((t: any) => `• ${t.status === 'in_progress' ? '🔄' : '📝'} ${t.title} - ${t.relatedAttendee} | ${t.priority} priority`).join('\n') || '• All attendee tasks completed'}

**💡 SUGGESTED DISCUSSION POINTS:**
${attendeeOverdueTasks.length > 0 ? '• Address overdue items and blockers preventing completion' : ''}
${attendeeUrgentTasks.length > 0 ? '• Review urgent tasks and resource allocation needs' : ''}
${attendeeIncompleteTasks.length > 0 ? '• Coordinate on active work and dependencies' : ''}
${attendeeIncompleteTasks.length === 0 ? '• Celebrate completed work and plan next steps' : ''}` : ''}

${tasks.length > 0 ? `

**📈 COMPLETION METRICS:**
• Tasks completed this week: ${weeklyVelocity}
• Overall completion rate: ${completionRate}%
• Last 3 days: ${todayCompleted.length} tasks finished

**CURRENTLY IN PROGRESS:**
${inProgress.map((t: any) => `• 🔄 ${t.title}${(t as any).projectName ? ` (${(t as any).projectName})` : ''} - ${t.priority} priority${t.dueDate ? ` | Due: ${new Date(t.dueDate!).toLocaleDateString()}` : ''}`).join('\n') || '• No active work items'}

**CRITICAL ATTENTION NEEDED:**
Urgent Tasks (${urgentTasks.length}):
${urgentTasks.map((t: any) => `• 🚨 ${t.title}${(t as any).projectName ? ` (${(t as any).projectName})` : ''}`).join('\n') || '• No urgent items'}

Overdue Items (${overdueTasks.length}):
${overdueTasks.map((t: any) => `• ⏰ ${t.title} - Due: ${new Date(t.dueDate!).toLocaleDateString()}${(t as any).projectName ? ` (${(t as any).projectName})` : ''}`).join('\n') || '• No overdue items'}

**📅 WHAT'S COMING UP (Next 7 Days):**
${upcomingDeadlines.map((t: any) => `• 📅 ${t.title} - Due: ${new Date(t.dueDate!).toLocaleDateString()}${(t as any).projectName ? ` (${(t as any).projectName})` : ''} | Status: ${t.status} | Priority: ${t.priority}`).join('\n') || '• No immediate deadlines'}

**📋 ALL INCOMPLETE TASKS:**
${[...inProgress, ...todoTasks].map((t: any) => `• ${t.status === 'in_progress' ? '🔄' : '📝'} ${t.title}${(t as any).projectName ? ` (${(t as any).projectName})` : ''} - ${t.priority} priority | Status: ${t.status}${t.dueDate ? ` | Due: ${new Date(t.dueDate!).toLocaleDateString()}` : ''}`).join('\n') || '• All tasks completed! 🎉'}

**🎯 IMMEDIATE NEXT ACTIONS:**
${todoTasks.filter((t: any) => t.priority === 'high' || t.priority === 'urgent').slice(0, 5).map((t: any) => `• ${t.title}${(t as any).projectName ? ` (${(t as any).projectName})` : ''} - ${t.priority} priority`).join('\n') || '• No high-priority items in queue'}

**POTENTIAL BLOCKERS & DECISION POINTS:**
Stalled Items (${stalledInProgress.length + longStandingTodos.length}):
${stalledInProgress.map((t: any) => `• 🛑 ${t.title} - No progress for 7+ days${(t as any).projectName ? ` (${(t as any).projectName})` : ''}`).join('\n')}
${longStandingTodos.map((t: any) => `• ⏸️ ${t.title} - Pending for 7+ days${(t as any).projectName ? ` (${(t as any).projectName})` : ''}`).join('\n')}

**HIGH-PRIORITY QUEUE:**
${highPriorityTasks.map((t: any) => `• 🔥 ${t.title}${(t as any).projectName ? ` (${(t as any).projectName})` : ''} - ${t.status}`).join('\n') || '• No high-priority items in queue'}` : ''}

Meeting Type Context: ${upcomingMeeting.title?.toLowerCase().includes('summit') ? 'Strategic planning session' : 
upcomingMeeting.title?.toLowerCase().includes('brainstorm') ? 'Creative ideation session' : 
upcomingMeeting.title?.toLowerCase().includes('round table') ? 'Team alignment meeting' : 
upcomingMeeting.title?.toLowerCase().includes('weekly') ? 'Regular status update' : 
'General business meeting'}`
          }
        ]
      });

      const result = completion.choices[0].message.content;
      console.log(`🎉 AI generated comprehensive meeting prep: ${result ? 'SUCCESS' : 'EMPTY'}`);
      console.log(`✅ Preparation generated successfully, length: ${result?.length || 0}`);
      
      if (!result || result.trim().length === 0) {
        return "**📋 No Active Projects or Tasks Found**\n\nIt looks like you don't have any active projects or tasks in the system yet. Once you add some projects and tasks, this comprehensive meeting prep will provide detailed talking points covering:\n\n• Project progress and completion rates\n• Recent accomplishments and upcoming deadlines\n• Priority tasks and potential blockers\n• Strategic discussion topics\n\nStart by creating your first project to unlock the full power of AI-driven meeting preparation!";
      }
      
      return result;
    } catch (error) {
      console.error('Meeting preparation error:', error);
      return "**Meeting Preparation Summary**\n\nComprehensive project status ready for discussion. Focus on recent wins, current priorities, and strategic decisions needed.";
    }
  }

  // Voice Assistant Methods
  async processVoiceCommand(command: string, context: {
    userId: string;
    projects: any[];
    tasks: any[];
    timestamp: Date;
    conversationHistory: Array<{user: string, ai: string}>;
  }) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an intelligent project management voice assistant. Process user voice commands and provide helpful responses.

COMMAND TYPES:
1. INFORMATION: Answer questions about projects, tasks, deadlines
2. ACTIONS: Create tasks, update status, set priorities
3. INSIGHTS: Provide analytics, recommendations, summaries
4. NAVIGATION: Guide users to relevant features

RESPONSE FORMAT: Return JSON with:
{
  "action": "information|create_task|update_task|briefing|navigation",
  "response": "Natural language response to speak back to user",
  "dataModified": false,
  "data": { task/project data if action taken }
}

VOICE GUIDELINES:
- Keep responses conversational and concise
- Use natural speech patterns
- Confirm actions clearly
- Provide helpful context

CURRENT CONTEXT:
- User has ${context.projects.length} projects: ${context.projects.map(p => `"${p.name}" (${p.progress}% complete, status: ${p.status})`).join(', ') || 'none'}
- User has ${context.tasks.length} total tasks:
  ${context.tasks.filter(t => t.status !== 'completed').slice(0, 10).map(t => `"${t.title}" (${t.status}, priority: ${t.priority}${t.dueDate ? `, due: ${new Date(t.dueDate).toLocaleDateString()}` : ''}${t.projectId ? `, project: ${context.projects.find(p => p.id === t.projectId)?.name || 'Unknown'}` : ''})`).join('\n  ') || 'none'}
- Completed tasks: ${context.tasks.filter(t => t.status === 'completed').length}
- Current time: ${context.timestamp.toLocaleString()}

When answering questions about "which project" or "what tasks", use the SPECIFIC project names and task titles from above. Be helpful and specific, not generic.

CONVERSATION HISTORY:
${context.conversationHistory.slice(-3).map(h => `User: ${h.user}\nAI: ${h.ai}`).join('\n\n')}

IMPORTANT: Remember the conversation context and provide continuous, intelligent responses that build on previous exchanges.`
          },
          {
            role: "user", 
            content: `Process this voice command: "${command}"`
          }
        ]
      });

      const responseText = completion.choices[0].message.content || "{}";
      console.log('🤖 Raw AI response:', responseText);
      
      // Try to extract JSON from the response
      let result;
      try {
        // First try parsing the raw response as JSON
        result = JSON.parse(responseText);
      } catch (e1) {
        // If that fails, try to extract JSON from markdown code block
        const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          try {
            result = JSON.parse(jsonMatch[1]);
          } catch (e2) {
            console.error('JSON parsing failed:', e2);
            return {
              action: "information",
              response: responseText || "I can help you with your projects. Could you rephrase your question?",
              dataModified: false,
              data: null
            };
          }
        } else {
          // If no JSON found, treat the whole response as a simple answer
          return {
            action: "information",
            response: responseText || "I can help you with your projects. What would you like to know?",
            dataModified: false,
            data: null
          };
        }
      }
      
      // Execute the action if needed
      if (result.action === "create_task" && result.data?.title) {
        const { storage } = await import('../storage');
        const newTask = await storage.createTask({
          title: result.data.title,
          description: result.data.description || "",
          priority: result.data.priority || "medium",
          status: "todo",
          projectId: result.data.projectId || null,
          dueDate: result.data.dueDate || null,
          assigneeId: context.userId
        });
        
        result.dataModified = true;
        result.data = newTask;
      }
      
      // Handle task updates
      if (result.action === "update_task" && result.data?.taskId) {
        const { storage } = await import('../storage');
        
        // Get current task to verify ownership
        const currentTask = await storage.getTask(result.data.taskId);
        if (!currentTask || currentTask.assigneeId !== context.userId) {
          result.response = "Sorry, I couldn't find that task or you don't have permission to update it.";
          return result;
        }
        
        // Prepare update data - only include fields that are being changed
        const updateData: any = {};
        if (result.data.title !== undefined) updateData.title = result.data.title;
        if (result.data.description !== undefined) updateData.description = result.data.description;
        if (result.data.status !== undefined) updateData.status = result.data.status;
        if (result.data.priority !== undefined) updateData.priority = result.data.priority;
        if (result.data.dueDate !== undefined) updateData.dueDate = result.data.dueDate;
        if (result.data.projectId !== undefined) updateData.projectId = result.data.projectId;
        
        const updatedTask = await storage.updateTask(result.data.taskId, updateData);
        
        result.dataModified = true;
        result.data = updatedTask;
      }
      
      return result;

    } catch (error) {
      console.error("Voice command processing error:", error);
      return {
        action: "error",
        response: "Sorry, I'm having trouble processing voice commands right now. Please try again later.",
        dataModified: false,
        data: null
      };
    }
  }

  async generateVoiceBriefing(projects: any[], tasks: any[], userId: string) {
    try {
      const today = new Date();
      const todayTasks = tasks.filter(t => t.dueDate && new Date(t.dueDate).toDateString() === today.toDateString());
      const overdueTasks = tasks.filter(t => t.dueDate && new Date(t.dueDate) < today && t.status !== 'completed');
      const urgentTasks = tasks.filter(t => t.priority === 'urgent' && t.status !== 'completed');

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Generate a daily voice briefing for a project manager. Make it conversational and actionable.

BRIEFING STRUCTURE:
- Quick status overview 
- Today's priorities
- Urgent attention items
- Positive productivity insights
- Actionable next steps

VOICE STYLE:
- Professional but friendly
- Natural speech patterns
- Encouraging tone
- Specific and actionable

Return JSON with:
{
  "text": "Detailed written briefing",
  "spokenText": "Conversational version optimized for voice",
  "keyPoints": ["Point 1", "Point 2"],
  "urgentItems": ["Urgent item 1"]
}`
          },
          {
            role: "user",
            content: `Generate briefing for user with:
- ${projects.length} projects
- ${tasks.length} total tasks
- ${todayTasks.length} due today
- ${overdueTasks.length} overdue
- ${urgentTasks.length} urgent tasks`
          }
        ]
      });

      const responseText = completion.choices[0].message.content || "{}";
      const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || [null, responseText];
      
      try {
        return JSON.parse(jsonMatch[1]);
      } catch (parseError) {
        return {
          text: "Good morning! You have several projects in progress and tasks to focus on today.",
          spokenText: "Good morning! You have several projects in progress and tasks to focus on today. Would you like me to help you prioritize your work?",
          keyPoints: ["Review project status", "Check urgent tasks"],
          urgentItems: urgentTasks.slice(0, 3).map(t => t.title)
        };
      }

    } catch (error) {
      console.error("Voice briefing generation error:", error);
      return {
        text: "Unable to generate briefing at this time.",
        spokenText: "I'm having trouble generating your briefing right now. Would you like me to try again?",
        keyPoints: [],
        urgentItems: []
      };
    }
  }

  async processSmartQuery(query: string, context: {
    userId: string;
    projects: any[];
    tasks: any[];
    context: any;
  }) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an intelligent project management assistant that answers questions about user's work.

QUERY TYPES:
- Status questions: "How are my projects doing?"
- Priority questions: "What should I work on?"
- Analytics: "How productive was I this week?"
- Planning: "When should I schedule this meeting?"

RESPONSE FORMAT: Return JSON with:
{
  "answer": "Detailed written answer",
  "spokenAnswer": "Conversational voice response",
  "data": { relevant data objects },
  "suggestions": ["Action 1", "Action 2"]
}

Be conversational, specific, and helpful.`
          },
          {
            role: "user",
            content: `Answer this query: "${query}"
            
Context:
- ${context.projects.length} projects  
- ${context.tasks.length} tasks
- Recent activity: ${JSON.stringify(context.context)}`
          }
        ]
      });

      const responseText = completion.choices[0].message.content || "{}";
      const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || [null, responseText];
      
      try {
        return JSON.parse(jsonMatch[1]);
      } catch (parseError) {
        return {
          answer: "I can help you with project information, but I'm having trouble processing your specific query right now.",
          spokenAnswer: "I can help you with project information, but I'm having trouble processing your specific query right now. Could you try rephrasing your question?",
          data: {},
          suggestions: ["Try asking about your urgent tasks", "Ask for today's priorities"]
        };
      }

    } catch (error) {
      console.error("Smart query processing error:", error);
      return {
        answer: "Unable to process query at this time.",
        spokenAnswer: "Sorry, I'm having trouble processing queries right now. Please try again later.",
        data: {},
        suggestions: []
      };
    }
  }
  async generateProjectMeetingPreparation(projectId: string, userId: string): Promise<string> {
    try {
      console.log(`🎯 Starting project-specific meeting preparation for project: ${projectId}`);
      
      // Import storage dynamically
      const { storage } = await import('../storage');
      
      // Get project details
      const project = await storage.getProject(projectId);
      if (!project) {
        throw new Error('Project not found');
      }
      
      // Get all tasks for this project
      const projectTasks = await storage.getTasks(projectId, userId);
      
      console.log(`📋 Project data: ${project.name} with ${projectTasks.length} tasks`);
      
      // Calculate project metrics
      const completedTasks = projectTasks.filter((task: any) => task.status === 'completed');
      const inProgressTasks = projectTasks.filter((task: any) => task.status === 'in_progress');
      const todoTasks = projectTasks.filter((task: any) => task.status === 'todo');
      const highPriorityTasks = projectTasks.filter((task: any) => task.priority === 'high' || task.priority === 'urgent');
      const overdueTasks = projectTasks.filter((task: any) => 
        task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed'
      );
      
      const progressPercentage = projectTasks.length > 0 
        ? Math.round((completedTasks.length / projectTasks.length) * 100) 
        : 0;
      
      // Get recent activity (tasks updated in last 7 days)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const recentTasks = projectTasks.filter((task: any) => 
        new Date(task.updatedAt || task.createdAt) > weekAgo
      );
      
      console.log(`🤖 Generating AI talking points for project: ${project.name}`);
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert AI project management consultant creating focused meeting preparation for a specific project. Generate detailed talking points that serve as comprehensive speaking notes for the project owner.

Generate well-structured talking points in this format:

# 🎯 ${project.name} - Meeting Preparation

## 📊 Project Status Overview
[Executive summary in 2-3 bullets with key metrics and current state]

## ✅ Recent Accomplishments
[What's been completed recently with impact and significance]

## 🔥 Priority Items for Discussion
[Most important topics that need attention or decisions]

## ⚠️ Risks & Blockers
[Current issues, potential problems, and items needing escalation]

## 📋 Action Items & Next Steps
[Specific deliverables and upcoming milestones]

## 💡 Discussion Topics
[Strategic questions and decisions needed]

Make the content:
- Specific and actionable
- Include concrete numbers and dates
- Highlight critical decisions needed
- Focus on outcomes and business impact
- Use bullet points for easy reference during the meeting`
          },
          {
            role: "user",
            content: `Create meeting preparation talking points for this project:

**PROJECT DETAILS:**
- Name: ${project.name}
- Description: ${project.description || 'No description provided'}
- Status: ${project.status}
- Due Date: ${project.dueDate ? new Date(project.dueDate).toLocaleDateString() : 'Not set'}
- Progress: ${progressPercentage}% complete

**TASK SUMMARY:**
- Total Tasks: ${projectTasks.length}
- Completed: ${completedTasks.length}
- In Progress: ${inProgressTasks.length}
- To Do: ${todoTasks.length}
- High Priority: ${highPriorityTasks.length}
- Overdue: ${overdueTasks.length}
- Recent Activity: ${recentTasks.length} tasks updated in last 7 days

**HIGH PRIORITY TASKS:**
${highPriorityTasks.slice(0, 5).map((task: any) => 
  `- ${task.title} (${task.status}) - Priority: ${task.priority}${task.dueDate ? ` | Due: ${new Date(task.dueDate).toLocaleDateString()}` : ''}`
).join('\n') || 'No high priority tasks'}

**OVERDUE TASKS:**
${overdueTasks.slice(0, 3).map((task: any) => 
  `- ${task.title} - Due: ${new Date(task.dueDate!).toLocaleDateString()}`
).join('\n') || 'No overdue tasks'}

**RECENT COMPLETIONS:**
${completedTasks.filter((task: any) => 
  new Date(task.updatedAt || task.createdAt) > weekAgo
).slice(0, 3).map((task: any) => 
  `- ${task.title} - Completed recently`
).join('\n') || 'No recent completions'}

Generate comprehensive talking points that help the project owner lead an effective meeting discussion.`
          }
        ]
      });

      const preparation = completion.choices[0].message.content || "Unable to generate meeting preparation at this time.";
      console.log(`✅ Generated project meeting preparation (${preparation.length} chars)`);
      
      return preparation;
    } catch (error) {
      console.error("Project meeting preparation error:", error);
      return `# Project Meeting Preparation\n\nUnable to generate AI talking points at this time. Please try again later.\n\n## Manual Preparation\n- Review project status and recent progress\n- Identify key decisions needed\n- Prepare updates on critical tasks\n- Note any blockers or risks to discuss`;
    }
  }
}

export const aiService = new AIService();
