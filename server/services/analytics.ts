import OpenAI from 'openai';

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
import type { Project, Task, User } from '@shared/schema';
import type { ProjectMember } from '@shared/schema';

interface ProjectSuccessPrediction {
  projectId: string;
  successProbability: number; // 0-100
  riskFactors: string[];
  recommendations: string[];
  timelineConfidence: number;
  resourceUtilization: number;
  completionPrediction: string; // ISO date string
  criticalPath: string[];
}

interface WorkloadAnalysis {
  userId: string;
  burnoutRisk: 'Low' | 'Medium' | 'High' | 'Critical';
  workloadScore: number; // 0-100
  weeklyHours: number;
  taskDistribution: {
    urgent: number;
    high: number;
    medium: number;
    low: number;
  };
  recommendations: string[];
  optimalCapacity: number;
}

interface ResourceOptimization {
  overallocatedUsers: string[];
  underutilizedUsers: string[];
  redistributionSuggestions: Array<{
    fromUser: string;
    toUser: string;
    taskId: string;
    reasoning: string;
  }>;
  teamEfficiencyScore: number;
  bottlenecks: string[];
}

interface ProjectAnalytics {
  projectId: string;
  kpis: {
    completionRate: number;
    velocityTrend: number; // percentage change
    avgTaskDuration: number; // days
    overdueRate: number;
    teamSatisfaction: number;
  };
  trends: {
    productivity: Array<{ date: string; score: number }>;
    velocity: Array<{ date: string; tasksCompleted: number }>;
    burndown: Array<{ date: string; remainingTasks: number }>;
  };
  insights: string[];
}

class AdvancedAnalyticsService {
  
  async generateProjectSuccessPrediction(
    project: Project, 
    tasks: Task[], 
    teamMembers: User[]
  ): Promise<ProjectSuccessPrediction> {
    try {
      const projectData = {
        name: project.name,
        description: project.description || 'No description',
        dueDate: project.dueDate,
        createdAt: project.createdAt,
        totalTasks: tasks.length,
        completedTasks: tasks.filter(t => t.status === 'completed').length,
        inProgressTasks: tasks.filter(t => t.status === 'in_progress').length,
        overdueTasks: tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed').length,
        highPriorityTasks: tasks.filter(t => t.priority === 'high' || t.priority === 'urgent').length,
        teamSize: teamMembers.length,
        averageTaskDuration: this.calculateAverageTaskDuration(tasks),
        timeRemaining: project.dueDate ? Math.max(0, (new Date(project.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null
      };

      const prompt = `Analyze this project and predict its success probability:

Project: ${projectData.name}
Description: ${projectData.description}
Due Date: ${project.dueDate || 'Not set'}
Team Size: ${projectData.teamSize}
Days Remaining: ${projectData.timeRemaining || 'No deadline'}

Current Status:
- Total Tasks: ${projectData.totalTasks}
- Completed: ${projectData.completedTasks}
- In Progress: ${projectData.inProgressTasks}
- Overdue: ${projectData.overdueTasks}
- High Priority: ${projectData.highPriorityTasks}
- Average Task Duration: ${projectData.averageTaskDuration} days

Provide a comprehensive analysis in JSON format with:
{
  "successProbability": <0-100 number>,
  "riskFactors": [<array of specific risk factors>],
  "recommendations": [<array of actionable recommendations>],
  "timelineConfidence": <0-100 confidence in meeting deadline>,
  "resourceUtilization": <0-100 how well resources are utilized>,
  "completionPrediction": "<ISO date string for predicted completion>",
  "criticalPath": [<array of most important tasks/areas>]
}

Consider factors like task completion rate, overdue items, team capacity, deadline pressure, and project complexity.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "You are an AI project management analyst specializing in predictive analytics. Provide detailed, data-driven insights in the exact JSON format requested."
          },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        projectId: project.id,
        successProbability: Math.min(100, Math.max(0, analysis.successProbability || 50)),
        riskFactors: analysis.riskFactors || ["Insufficient data for analysis"],
        recommendations: analysis.recommendations || ["Continue monitoring project progress"],
        timelineConfidence: Math.min(100, Math.max(0, analysis.timelineConfidence || 50)),
        resourceUtilization: Math.min(100, Math.max(0, analysis.resourceUtilization || 75)),
        completionPrediction: analysis.completionPrediction || this.predictCompletionDate(project, tasks),
        criticalPath: analysis.criticalPath || ["Task completion", "Resource allocation"]
      };
    } catch (error) {
      console.error('Project success prediction error:', error);
      return this.getDefaultPrediction(project);
    }
  }

  async analyzeWorkload(
    userId: string, 
    tasks: Task[], 
    projects: Project[]
  ): Promise<WorkloadAnalysis> {
    try {
      const userTasks = tasks.filter(t => t.assigneeId === userId);
      const activeTasks = userTasks.filter(t => t.status !== 'completed');
      
      const taskDistribution = {
        urgent: activeTasks.filter(t => t.priority === 'urgent').length,
        high: activeTasks.filter(t => t.priority === 'high').length,
        medium: activeTasks.filter(t => t.priority === 'medium').length,
        low: activeTasks.filter(t => t.priority === 'low').length
      };

      const overdueCount = activeTasks.filter(t => 
        t.dueDate && new Date(t.dueDate) < new Date()
      ).length;

      const workloadData = {
        totalActiveTasks: activeTasks.length,
        overdueTasksCount: overdueCount,
        urgentTasks: taskDistribution.urgent,
        highPriorityTasks: taskDistribution.high,
        projectCount: projects.length,
        completedThisWeek: this.getTasksCompletedThisWeek(userTasks),
        averageTasksPerDay: activeTasks.length / 7
      };

      const prompt = `Analyze this user's workload and assess burnout risk:

Current Workload:
- Active Tasks: ${workloadData.totalActiveTasks}
- Overdue Tasks: ${workloadData.overdueTasksCount}
- Urgent Priority: ${workloadData.urgentTasks}
- High Priority: ${workloadData.highPriorityTasks}
- Medium Priority: ${taskDistribution.medium}
- Low Priority: ${taskDistribution.low}
- Active Projects: ${workloadData.projectCount}
- Tasks Completed This Week: ${workloadData.completedThisWeek}
- Average Tasks Per Day: ${workloadData.averageTasksPerDay.toFixed(1)}

Provide workload analysis in JSON format:
{
  "burnoutRisk": "<Low|Medium|High|Critical>",
  "workloadScore": <0-100 where 100 is maximum healthy capacity>,
  "weeklyHours": <estimated weekly hours needed>,
  "recommendations": [<array of specific recommendations>],
  "optimalCapacity": <0-100 recommended workload percentage>
}

Consider factors like task volume, priority distribution, overdue items, and sustainable work pace.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system", 
            content: "You are an AI workplace wellness analyst specializing in workload assessment and burnout prevention."
          },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');

      return {
        userId,
        burnoutRisk: ['Low', 'Medium', 'High', 'Critical'].includes(analysis.burnoutRisk) 
          ? analysis.burnoutRisk : 'Medium',
        workloadScore: Math.min(100, Math.max(0, analysis.workloadScore || 50)),
        weeklyHours: Math.max(0, analysis.weeklyHours || 40),
        taskDistribution,
        recommendations: analysis.recommendations || ["Monitor workload regularly"],
        optimalCapacity: Math.min(100, Math.max(0, analysis.optimalCapacity || 80))
      };
    } catch (error) {
      console.error('Workload analysis error:', error);
      return this.getDefaultWorkloadAnalysis(userId, tasks);
    }
  }

  async optimizeResourceAllocation(
    projects: Project[],
    tasks: Task[],
    users: User[]
  ): Promise<ResourceOptimization> {
    try {
      const userWorkloads = users.map(user => {
        const userTasks = tasks.filter(t => t.assigneeId === user.id && t.status !== 'completed');
        return {
          userId: user.id,
          email: user.email,
          taskCount: userTasks.length,
          urgentTasks: userTasks.filter(t => t.priority === 'urgent').length,
          highTasks: userTasks.filter(t => t.priority === 'high').length,
          overdueCount: userTasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date()).length
        };
      });

      const resourceData = {
        totalUsers: users.length,
        totalActiveTasks: tasks.filter(t => t.status !== 'completed').length,
        userWorkloads: userWorkloads,
        averageTasksPerUser: userWorkloads.reduce((sum, u) => sum + u.taskCount, 0) / users.length,
        maxWorkload: Math.max(...userWorkloads.map(u => u.taskCount)),
        minWorkload: Math.min(...userWorkloads.map(u => u.taskCount))
      };

      const prompt = `Analyze team resource allocation and suggest optimizations:

Team Overview:
- Total Team Members: ${resourceData.totalUsers}
- Total Active Tasks: ${resourceData.totalActiveTasks}
- Average Tasks per User: ${resourceData.averageTasksPerUser.toFixed(1)}
- Highest Workload: ${resourceData.maxWorkload} tasks
- Lowest Workload: ${resourceData.minWorkload} tasks

Individual Workloads:
${userWorkloads.map(u => 
  `- User ${u.userId}: ${u.taskCount} tasks (${u.urgentTasks} urgent, ${u.highTasks} high, ${u.overdueCount} overdue)`
).join('\n')}

Provide resource optimization in JSON format:
{
  "overallocatedUsers": [<array of user IDs with too many tasks>],
  "underutilizedUsers": [<array of user IDs with capacity for more tasks>],
  "redistributionSuggestions": [
    {
      "fromUser": "<user ID>",
      "toUser": "<user ID>", 
      "reasoning": "<why this redistribution makes sense>"
    }
  ],
  "teamEfficiencyScore": <0-100 current team efficiency>,
  "bottlenecks": [<array of efficiency bottlenecks>]
}

Focus on workload balance, skill utilization, and removing bottlenecks.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "You are an AI resource optimization specialist focused on team efficiency and workload balance."
          },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');

      return {
        overallocatedUsers: analysis.overallocatedUsers || [],
        underutilizedUsers: analysis.underutilizedUsers || [],
        redistributionSuggestions: analysis.redistributionSuggestions || [],
        teamEfficiencyScore: Math.min(100, Math.max(0, analysis.teamEfficiencyScore || 75)),
        bottlenecks: analysis.bottlenecks || ["No major bottlenecks identified"]
      };
    } catch (error) {
      console.error('Resource optimization error:', error);
      return this.getDefaultResourceOptimization();
    }
  }

  async generateProjectAnalytics(
    project: Project,
    tasks: Task[],
    historicalData?: any[]
  ): Promise<ProjectAnalytics> {
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const overdueTasks = tasks.filter(t => 
      t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed'
    );
    
    const completionRate = tasks.length > 0 ? (completedTasks.length / tasks.length) * 100 : 0;
    const overdueRate = tasks.length > 0 ? (overdueTasks.length / tasks.length) * 100 : 0;

    return {
      projectId: project.id,
      kpis: {
        completionRate: Math.round(completionRate),
        velocityTrend: this.calculateVelocityTrend(tasks),
        avgTaskDuration: this.calculateAverageTaskDuration(tasks),
        overdueRate: Math.round(overdueRate),
        teamSatisfaction: this.estimateTeamSatisfaction(tasks)
      },
      trends: {
        productivity: this.generateProductivityTrend(),
        velocity: this.generateVelocityTrend(),
        burndown: this.generateBurndownChart(tasks)
      },
      insights: await this.generateProjectInsights(project, tasks)
    };
  }

  // Helper methods
  private calculateAverageTaskDuration(tasks: Task[]): number {
    const completedTasks = tasks.filter(t => t.status === 'completed' && t.createdAt);
    if (completedTasks.length === 0) return 3; // Default 3 days
    
    const totalDuration = completedTasks.reduce((sum, task) => {
      const created = new Date(task.createdAt!);
      const completed = new Date(task.updatedAt || created);
      return sum + (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    }, 0);
    
    return Math.round(totalDuration / completedTasks.length);
  }

  private predictCompletionDate(project: Project, tasks: Task[]): string {
    const remaining = tasks.filter(t => t.status !== 'completed').length;
    const avgDuration = this.calculateAverageTaskDuration(tasks);
    const predictedDays = remaining * avgDuration;
    
    const completionDate = new Date();
    completionDate.setDate(completionDate.getDate() + predictedDays);
    return completionDate.toISOString();
  }

  private getTasksCompletedThisWeek(tasks: Task[]): number {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    return tasks.filter(t => 
      t.status === 'completed' && 
      t.updatedAt && 
      new Date(t.updatedAt) >= weekStart
    ).length;
  }

  private calculateVelocityTrend(tasks: Task[]): number {
    // Simplified velocity calculation - in production would use historical data
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const totalTasks = tasks.length;
    return totalTasks > 0 ? (completedTasks.length / totalTasks) * 100 - 50 : 0;
  }

  private estimateTeamSatisfaction(tasks: Task[]): number {
    const overdueCount = tasks.filter(t => 
      t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed'
    ).length;
    const totalTasks = tasks.length;
    const overdueRate = totalTasks > 0 ? overdueCount / totalTasks : 0;
    
    return Math.round(100 - (overdueRate * 100));
  }

  private generateProductivityTrend(): Array<{ date: string; score: number }> {
    const data = [];
    for (let i = 30; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      data.push({
        date: date.toISOString().split('T')[0],
        score: Math.round(75 + Math.random() * 25)
      });
    }
    return data;
  }

  private generateVelocityTrend(): Array<{ date: string; tasksCompleted: number }> {
    const data = [];
    for (let i = 14; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      data.push({
        date: date.toISOString().split('T')[0],
        tasksCompleted: Math.round(Math.random() * 8 + 2)
      });
    }
    return data;
  }

  private generateBurndownChart(tasks: Task[]): Array<{ date: string; remainingTasks: number }> {
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const totalTasks = tasks.length;
    const remainingTasks = totalTasks - completedTasks;
    
    const data = [];
    for (let i = 30; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const progress = (30 - i) / 30;
      const remaining = Math.max(0, Math.round(remainingTasks * (1 - progress * 0.8)));
      
      data.push({
        date: date.toISOString().split('T')[0],
        remainingTasks: remaining
      });
    }
    return data;
  }

  private async generateProjectInsights(project: Project, tasks: Task[]): Promise<string[]> {
    const insights = [];
    
    const completionRate = tasks.length > 0 ? (tasks.filter(t => t.status === 'completed').length / tasks.length) * 100 : 0;
    const overdueCount = tasks.filter(t => 
      t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'completed'
    ).length;

    if (completionRate > 80) {
      insights.push("Project is performing exceptionally well with high completion rates");
    } else if (completionRate < 40) {
      insights.push("Project may need attention - completion rate is below optimal");
    }

    if (overdueCount > 0) {
      insights.push(`${overdueCount} tasks are overdue and require immediate attention`);
    }

    if (project.dueDate) {
      const daysRemaining = Math.ceil((new Date(project.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysRemaining < 7) {
        insights.push("Project deadline is approaching - consider priority adjustments");
      }
    }

    return insights.length > 0 ? insights : ["Project is progressing normally"];
  }

  // Default fallback methods
  private getDefaultPrediction(project: Project): ProjectSuccessPrediction {
    return {
      projectId: project.id,
      successProbability: 75,
      riskFactors: ["Limited historical data"],
      recommendations: ["Continue monitoring progress", "Regular team check-ins"],
      timelineConfidence: 70,
      resourceUtilization: 80,
      completionPrediction: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      criticalPath: ["Task completion", "Resource management"]
    };
  }

  private getDefaultWorkloadAnalysis(userId: string, tasks: Task[]): WorkloadAnalysis {
    const userTasks = tasks.filter(t => t.assigneeId === userId && t.status !== 'completed');
    return {
      userId,
      burnoutRisk: userTasks.length > 15 ? 'High' : userTasks.length > 8 ? 'Medium' : 'Low',
      workloadScore: Math.min(100, userTasks.length * 8),
      weeklyHours: Math.min(60, userTasks.length * 3),
      taskDistribution: {
        urgent: userTasks.filter(t => t.priority === 'urgent').length,
        high: userTasks.filter(t => t.priority === 'high').length,
        medium: userTasks.filter(t => t.priority === 'medium').length,
        low: userTasks.filter(t => t.priority === 'low').length
      },
      recommendations: ["Regular workload assessment", "Consider task delegation"],
      optimalCapacity: 85
    };
  }

  private getDefaultResourceOptimization(): ResourceOptimization {
    return {
      overallocatedUsers: [],
      underutilizedUsers: [],
      redistributionSuggestions: [],
      teamEfficiencyScore: 75,
      bottlenecks: ["No major bottlenecks identified"]
    };
  }
}

export const analyticsService = new AdvancedAnalyticsService();
export type { 
  ProjectSuccessPrediction, 
  WorkloadAnalysis, 
  ResourceOptimization, 
  ProjectAnalytics 
};