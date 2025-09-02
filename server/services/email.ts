import { Resend } from 'resend';

interface EmailService {
  sendTestEmail(email: string): Promise<void>;
  sendNotificationEmail(email: string, subject: string, content: string): Promise<void>;
  sendDailySummary(email: string, summary: any): Promise<void>;
  sendLunchBriefing(email: string, briefing: any): Promise<void>;
  sendProjectAlert(email: string, projectName: string, alertType: string, message: string): Promise<void>;
  sendTaskDeadlineAlert(email: string, taskTitle: string, projectName: string, dueDate: string, isOverdue?: boolean, daysOverdue?: number, projectId?: string, taskId?: string): Promise<void>;
  sendEndOfDaySummary(email: string, summary: any): Promise<boolean>;
  sendProjectInvitation(inviteeEmail: string, projectName: string, inviterName: string, token: string, role: string): Promise<void>;
}

class ResendEmailService implements EmailService {
  private resend: Resend;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  private formatBriefingText(text: string): string {
    return text
      // Convert ### headers to HTML headers
      .replace(/### (.*)/g, '<h3 style="color: #1e40af; margin: 20px 0 10px 0; font-size: 18px; font-weight: 600;">$1</h3>')
      // Convert ** bold text to HTML bold
      .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #374151;">$1</strong>')
      // Convert line breaks to paragraphs
      .split('\n\n')
      .map(paragraph => paragraph.trim())
      .filter(paragraph => paragraph.length > 0)
      .map(paragraph => {
        if (paragraph.startsWith('<h3')) {
          return paragraph;
        }
        return `<p style="margin: 12px 0; color: #4b5563; line-height: 1.6;">${paragraph.replace(/\n/g, '<br>')}</p>`;
      })
      .join('');
  }

  async sendTestEmail(email: string): Promise<void> {
    if (!process.env.RESEND_API_KEY) {
      console.log(`Mock: Test email sent to ${email} (Resend API key not configured)`);
      return;
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: process.env.FROM_EMAIL || 'AI ProjectHub <noreply@omarb.in>',
        to: [email],
        subject: 'AI Project Manager - Test Email',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0079F2;">🤖 Your AI Project Manager is Working!</h2>
            <p>This is a test email to confirm your email notifications are set up correctly.</p>
            <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0079F2;">
              <p style="margin: 0; color: #1e40af; font-weight: 500;">You'll receive smart notifications about:</p>
              <ul style="color: #374151; margin: 10px 0;">
                <li>Daily project summaries with AI insights</li>
                <li>Deadline alerts and overdue tasks</li>
                <li>Project health warnings</li>
                <li>Intelligent recommendations</li>
              </ul>
            </div>
            <p>Best regards,<br><strong>Your AI Project Manager</strong></p>
            <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">
              Powered by advanced AI analysis of your project data
            </p>
          </div>
        `,
      });

      if (error) {
        console.error('❌ Resend email error:', error);
        console.error('❌ Error details:', JSON.stringify(error, null, 2));
        
        // Enhanced error messaging for production issues
        if (error.message?.includes('verify a domain') || error.message?.includes('testing emails')) {
          console.log('📧 EMAIL DOMAIN ISSUE: Domain verification required');
          console.log('   • Check that omarb.in domain is verified at resend.com/domains');
          console.log('   • Ensure FROM_EMAIL uses the verified domain');
          console.log('   • Without domain verification, emails only work to the verified account');
        }
        
        if (error.message?.includes('API key')) {
          console.log('🔑 API KEY ISSUE: Check RESEND_API_KEY configuration');
        }
        
        throw new Error(`Email delivery failed: ${error.message || 'Unknown error'}`);
      }

      console.log(`Test email sent successfully to ${email}:`, data?.id);
    } catch (error) {
      console.error('Email send error:', error);
      throw error;
    }
  }

  async sendNotificationEmail(email: string, subject: string, content: string): Promise<void> {
    if (!process.env.RESEND_API_KEY) {
      console.log(`Mock: Email sent to ${email} - ${subject}: ${content}`);
      return;
    }

    try {
      const { data, error } = await this.resend.emails.send({
        from: process.env.FROM_EMAIL || 'AI ProjectHub <noreply@omarb.in>',
        to: [email],
        subject: `AI Project Manager - ${subject}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">${subject}</h2>
            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              ${content}
            </div>
            <p style="color: #666; font-size: 12px;">
              This email was sent by your AI Project Manager. You can manage notification preferences in your settings.
            </p>
          </div>
        `,
      });

      if (error) {
        throw error;
      }

      console.log(`Notification email sent to ${email}: ${subject}`, data?.id);
    } catch (error) {
      console.error('Notification email error:', error);
      throw error;
    }
  }

  async sendDailySummary(email: string, summary: any): Promise<void> {
    if (!process.env.RESEND_API_KEY) {
      console.log(`Mock: Daily summary sent to ${email}`, summary);
      return;
    }

    // Domain is now verified - send to all users
    console.log(`📧 Preparing daily summary email for ${email}`);

    try {
      const { data, error } = await this.resend.emails.send({
        from: process.env.FROM_EMAIL || 'AI ProjectHub <noreply@omarb.in>',
        to: [email],
        subject: `🌅 Morning Summary - ${summary.date}`,
        html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
        <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1e293b !important; margin: 0 0 10px 0; font-size: 28px;">Morning Summary</h1>
            <p style="color: #64748b !important; margin: 0; font-size: 16px;">${summary.date}</p>
          </div>

          <div style="background-color: #3b82f6; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
            <div style="text-align: center; margin-bottom: 15px;">
              <h2 style="color: #ffffff !important; margin: 0; font-size: 20px; font-weight: 700;">🌅 Good Morning!</h2>
            </div>
            <div style="color: #ffffff !important; font-size: 15px; line-height: 1.5; text-align: left;">
              ${summary.smartBriefing ? summary.smartBriefing.split('\n').map((line: string) => 
                line.trim() ? `<p style="margin: 6px 0; color: #ffffff !important;">${line.trim()}</p>` : '<br>'
              ).join('') : '<p style="margin: 0; color: #ffffff !important; text-align: center;">Start your day with focus and purpose!</p>'}
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px;">
            <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; text-align: center;">
              <div style="font-size: 32px; font-weight: bold; color: #059669 !important; margin-bottom: 5px;">${summary.completedToday || 0}</div>
              <div style="color: #374151 !important; font-size: 14px; font-weight: 600;">Tasks Completed</div>
            </div>
            <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; text-align: center;">
              <div style="font-size: 32px; font-weight: bold; color: #3b82f6 !important; margin-bottom: 5px;">${summary.activeProjects || 0}</div>
              <div style="color: #374151 !important; font-size: 14px; font-weight: 600;">Active Projects</div>
            </div>
          </div>

          ${summary.keyRecommendations && summary.keyRecommendations.length > 0 ? `
          <div style="margin-bottom: 25px;">
            <h3 style="color: #1e293b !important; margin-bottom: 15px; font-size: 20px; font-weight: 700;">🎉 Today's Priorities</h3>
            <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; border-radius: 0 8px 8px 0;">
              ${summary.keyRecommendations.map((task: string) => 
                `<div style="margin: 8px 0; color: #065f46 !important; font-weight: 600; line-height: 1.4;">${task}</div>`
              ).join('')}
            </div>
          </div>
          ` : ''}

          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            <p style="color: #374151 !important; font-size: 14px; margin: 0; font-weight: 500;">
              Have a productive day! Focus on what matters most.
            </p>
          </div>
        </div>
      </div>
    `,
        text: `Morning Summary - ${summary.date}

${summary.smartBriefing || 'Start your day with focus and purpose'}

Today's Stats:
• Completed Tasks: ${summary.completedToday || 0}
• Active Projects: ${summary.activeProjects || 0}

${summary.keyRecommendations && summary.keyRecommendations.length > 0 ? `
Today's Priorities:
${summary.keyRecommendations.map((task: string) => `• ${task}`).join('\n')}
` : ''}

Have a productive day!`,
      });

      if (error) {
        console.error('❌ Daily summary email error:', error);
        console.error('❌ Error details for daily summary:', JSON.stringify(error, null, 2));
        
        // Enhanced error handling for production
        if (error.message?.includes('verify a domain') || error.message?.includes('testing emails')) {
          console.log(`📧 PRODUCTION EMAIL ISSUE: Daily summary generated but not sent to ${email}`);
          console.log('   • Domain verification required at resend.com');
          console.log('   • Check FROM_EMAIL environment variable');
          console.log('   • Verify omarb.in domain is active and verified');
          return;
        }
        
        if (error.message?.includes('API key')) {
          console.log('🔑 RESEND API KEY ISSUE: Check environment variable RESEND_API_KEY');
          return;
        }
        
        throw error;
      }

      console.log(`Daily summary sent to ${email}`, data?.id);
    } catch (error: any) {
      console.error('Daily summary email error:', error);
      
      // Don't crash the automated system for email issues, but log them clearly
      if (error.message?.includes('verify a domain') || error.message?.includes('testing emails')) {
        console.error(`❌ EMAIL VERIFICATION ISSUE: Daily summary failed for ${email}`);
        console.error(`❌ Error: ${error.message}`);
        throw error; // Changed: throw error instead of silently returning
      }
      
      throw error;
    }
  }

  async sendLunchBriefing(email: string, briefing: any): Promise<void> {
    if (!process.env.RESEND_API_KEY) {
      console.log(`Mock: Lunch briefing sent to ${email}`, briefing);
      return;
    }

    console.log(`📧 Preparing lunch briefing email for ${email}`);

    try {
      const { data, error } = await this.resend.emails.send({
        from: process.env.FROM_EMAIL || 'AI ProjectHub <noreply@omarb.in>',
        to: [email],
        subject: `🥗 Lunch Summary - ${briefing.date}`,
        html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
        <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1e293b !important; margin: 0 0 10px 0; font-size: 28px;">Lunch Summary</h1>
            <p style="color: #64748b !important; margin: 0; font-size: 16px;">${briefing.date}</p>
          </div>

          <div style="background-color: #1e3a8a; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
            <div style="text-align: center; margin-bottom: 15px;">
              <h2 style="color: #ffffff !important; margin: 0; font-size: 20px; font-weight: 700;">🥗 Lunch Break</h2>
            </div>
            <div style="color: #ffffff !important; font-size: 15px; line-height: 1.5; text-align: left;">
              ${briefing.briefingContent ? briefing.briefingContent.split('\n').map((line: string) => 
                line.trim() ? `<p style="margin: 6px 0; color: #ffffff !important;">${line.trim()}</p>` : '<br>'
              ).join('') : '<p style="margin: 0; color: #ffffff !important; text-align: center;">Time to recharge and refocus!</p>'}
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px;">
            <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; text-align: center;">
              <div style="font-size: 32px; font-weight: bold; color: #059669 !important; margin-bottom: 5px;">${briefing.morningProgress || 0}</div>
              <div style="color: #374151 !important; font-size: 14px; font-weight: 600;">Tasks Completed</div>
            </div>
            <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; text-align: center;">
              <div style="font-size: 32px; font-weight: bold; color: #3b82f6 !important; margin-bottom: 5px;">${briefing.activeProjects || 0}</div>
              <div style="color: #374151 !important; font-size: 14px; font-weight: 600;">Active Projects</div>
            </div>
          </div>

          ${briefing.upcomingTasks && briefing.upcomingTasks.length > 0 ? `
          <div style="margin-bottom: 25px;">
            <h3 style="color: #1e293b !important; margin-bottom: 15px; font-size: 20px; font-weight: 700;">🎉 Afternoon Priorities</h3>
            <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; border-radius: 0 8px 8px 0;">
              ${briefing.upcomingTasks.slice(0, 3).map((task: any) => 
                `<div style="margin: 8px 0; color: #065f46 !important; font-weight: 600; line-height: 1.4;">${task.title}</div>`
              ).join('')}
            </div>
          </div>
          ` : ''}

          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            <p style="color: #64748b; font-size: 14px; margin: 0;">
              Have a great afternoon! Tomorrow is a new opportunity to achieve great things.
            </p>
          </div>
        </div>
      </div>
    `,
        text: `Lunch Summary - ${briefing.date}

${briefing.briefingContent || 'Time to recharge and refocus'}

Today's Stats:
• Completed Tasks: ${briefing.morningProgress || 0}
• Active Projects: ${briefing.activeProjects || 0}

${briefing.upcomingTasks && briefing.upcomingTasks.length > 0 ? `
Afternoon Priorities:
${briefing.upcomingTasks.slice(0, 3).map((task: any) => `• ${task.title}`).join('\n')}
` : ''}

Have a great afternoon!`,
      });

      if (error) {
        console.error('❌ Lunch briefing email error:', error);
        throw error;
      }

      console.log(`Lunch briefing sent to ${email}`, data?.id);
    } catch (error: any) {
      console.error('Lunch briefing email error:', error);
      throw error;
    }
  }

  async sendProjectAlert(email: string, projectName: string, alertType: string, message: string): Promise<void> {
    if (!process.env.RESEND_API_KEY) {
      console.log(`Mock: Project alert sent to ${email} - ${projectName}: ${message}`);
      return;
    }

    const priorityColors = {
      urgent: '#ef4444',
      high: '#f59e0b',
      medium: '#10b981',
      low: '#6b7280'
    };

    try {
      const { data, error } = await this.resend.emails.send({
        from: process.env.FROM_EMAIL || 'AI ProjectHub <noreply@omarb.in>',
        to: [email],
        subject: `🚨 Project Alert: ${projectName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: ${(priorityColors as any)[alertType] || '#ef4444'}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0;">⚠️ Project Alert</h2>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">Your attention is needed</p>
            </div>
            <div style="background: white; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
              <h3 style="color: #333; margin-top: 0;">Project: ${projectName}</h3>
              <p style="color: #666; font-size: 16px;">${message}</p>
              <div style="margin-top: 20px; padding: 15px; background: #f9fafb; border-radius: 6px;">
                <p style="margin: 0; color: #374151; font-weight: 500;">Recommended Action:</p>
                <p style="margin: 5px 0 0 0; color: #6b7280;">Review the project status and address any overdue tasks or resource conflicts.</p>
              </div>
            </div>
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
              This alert was generated by your AI Project Manager
            </p>
          </div>
        `,
      });

      if (error) {
        throw error;
      }

      console.log(`Project alert sent to ${email} for ${projectName}`, data?.id);
    } catch (error) {
      console.error('Project alert email error:', error);
      throw error;
    }
  }

  async sendTaskDeadlineAlert(email: string, taskTitle: string, projectName: string, dueDate: string, isOverdue: boolean = false, daysOverdue: number = 0, projectId?: string, taskId?: string): Promise<void> {
    if (!process.env.RESEND_API_KEY) {
      const alertType = isOverdue ? 'OVERDUE' : 'Deadline';
      console.log(`Mock: ${alertType} alert sent to ${email} - ${taskTitle} in ${projectName}`);
      return;
    }

    // Customize content based on overdue status
    const subjectPrefix = isOverdue ? '🚨 OVERDUE TASK' : '⏰ Task Deadline Alert';
    const headerText = isOverdue ? '🚨 Task Overdue' : '⏰ Deadline Alert';
    const statusText = isOverdue 
      ? `Task overdue by ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''}` 
      : 'Task deadline approaching';
    
    const backgroundColor = isOverdue 
      ? 'linear-gradient(135deg, #ef4444, #dc2626)' // Red for overdue
      : 'linear-gradient(135deg, #f59e0b, #d97706)'; // Orange for upcoming
    
    const alertColor = isOverdue ? '#dc2626' : '#f59e0b';
    const alertBackgroundColor = isOverdue ? '#fee2e2' : '#fef3c7';
    const alertTextColor = isOverdue ? '#7f1d1d' : '#92400e';
    
    const urgencyMessage = isOverdue 
      ? `This task is ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue and requires immediate attention. Daily reminders will continue until completed.`
      : 'This task needs your attention to meet its deadline. Daily reminders will continue until addressed.';

    // Create direct links to the project and task
    const baseUrl = process.env.BASE_URL || 'https://ai-projecthub.replit.app';
    const projectUrl = projectId ? `${baseUrl}/projects/${projectId}` : null;
    const taskUrl = projectId && taskId ? `${baseUrl}/projects/${projectId}?task=${taskId}` : null;

    try {
      const { data, error } = await this.resend.emails.send({
        from: process.env.FROM_EMAIL || 'AI ProjectHub <noreply@omarb.in>',
        to: [email],
        subject: `${subjectPrefix}: ${taskTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: ${backgroundColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h2 style="margin: 0;">${headerText}</h2>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">${statusText}</p>
            </div>
            <div style="background: white; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
              <h3 style="color: #333; margin-top: 0;">${taskTitle}</h3>
              <p style="color: #666;"><strong>Project:</strong> ${projectName}</p>
              <p style="color: #666;"><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString()}</p>
              ${isOverdue ? `<p style="color: ${alertColor}; font-weight: bold;"><strong>Days Overdue:</strong> ${daysOverdue}</p>` : ''}
              
              <div style="background: ${alertBackgroundColor}; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid ${alertColor};">
                <p style="margin: 0; color: ${alertTextColor}; font-weight: 500;">
                  ${urgencyMessage}
                </p>
              </div>

              ${taskUrl || projectUrl ? `
              <div style="text-align: center; margin: 25px 0;">
                <h4 style="color: #374151; margin-bottom: 15px; font-size: 16px;">Quick Actions:</h4>
                <div style="display: flex; justify-content: center; gap: 15px; flex-wrap: wrap;">
                  ${taskUrl ? `
                  <a href="${taskUrl}" 
                     style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; 
                            text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;
                            box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2);">
                    📝 View Task
                  </a>
                  ` : ''}
                  ${projectUrl ? `
                  <a href="${projectUrl}" 
                     style="display: inline-block; background: #059669; color: white; padding: 12px 24px; 
                            text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;
                            box-shadow: 0 2px 4px rgba(5, 150, 105, 0.2);">
                    📂 Open Project
                  </a>
                  ` : ''}
                </div>
              </div>
              ` : ''}
            </div>
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
              Daily reminder system - stay on track with AI-powered deadline monitoring
            </p>
          </div>
        `,
      });

      if (error) {
        throw error;
      }

      const alertType = isOverdue ? 'OVERDUE' : 'Deadline';
      console.log(`${alertType} alert sent to ${email} for task: ${taskTitle}`, data?.id);
    } catch (error) {
      console.error('Deadline alert email error:', error);
      throw error;
    }
  }

  async sendProjectInvitation(inviteeEmail: string, projectName: string, inviterName: string, token: string, role: string): Promise<void> {
    if (!process.env.RESEND_API_KEY) {
      console.log(`Mock: Invitation email sent to ${inviteeEmail} for project ${projectName}`);
      return;
    }

    const acceptUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/invite/accept/${token}`;
    const declineUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/invite/decline/${token}`;
    
    try {
      const { data, error } = await this.resend.emails.send({
        from: process.env.FROM_EMAIL || 'AI ProjectHub <noreply@omarb.in>',
        to: [inviteeEmail],
        subject: `You're invited to join "${projectName}"`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #0079F2; margin: 0;">🤝 Project Invitation</h1>
            </div>
            
            <div style="background: #f9f9f9; padding: 25px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #0079F2;">
              <h2 style="color: #333; margin: 0 0 15px 0;">You're invited to collaborate!</h2>
              <p style="color: #666; margin: 0; font-size: 16px; line-height: 1.5;">
                <strong>${inviterName}</strong> has invited you to join the project <strong>"${projectName}"</strong> as a <strong>${role}</strong>.
              </p>
            </div>

            <div style="background: #fff; padding: 25px; border-radius: 12px; border: 1px solid #e0e0e0; margin: 20px 0;">
              <h3 style="color: #333; margin: 0 0 15px 0;">What you'll get access to:</h3>
              <ul style="color: #666; margin: 0; padding-left: 20px; line-height: 1.6;">
                <li>📋 Project tasks and milestones</li>
                <li>📅 Team meetings and scheduling</li>
                <li>🤖 AI-powered meeting transcriptions</li>
                <li>📊 Project progress and analytics</li>
                <li>💬 Team collaboration and discussions</li>
              </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${acceptUrl}" 
                 style="display: inline-block; background: #0079F2; color: white; padding: 14px 28px; 
                        text-decoration: none; border-radius: 8px; font-weight: 600; margin: 0 10px; 
                        font-size: 16px; box-shadow: 0 2px 4px rgba(0, 121, 242, 0.2);">
                ✅ Accept Invitation
              </a>
              <a href="${declineUrl}" 
                 style="display: inline-block; background: #6B7280; color: white; padding: 14px 28px; 
                        text-decoration: none; border-radius: 8px; font-weight: 600; margin: 0 10px; 
                        font-size: 16px; box-shadow: 0 2px 4px rgba(107, 114, 128, 0.2);">
                ❌ Decline
              </a>
            </div>

            <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <p style="color: #1e40af; margin: 0; font-size: 14px;">
                💡 <strong>New to AI Project Manager?</strong><br>
                You'll be able to create an account or sign in when you accept the invitation.
              </p>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center;">
              <p style="color: #999; font-size: 12px; margin: 0;">
                This invitation will expire in 7 days. If you have any questions, please contact ${inviterName}.
              </p>
              <p style="color: #999; font-size: 12px; margin: 10px 0 0 0;">
                Powered by AI Project Manager
              </p>
            </div>
          </div>
        `,
      });

      if (error) {
        console.error('Invitation email error:', error);
        throw error;
      }

      console.log(`Invitation email sent to ${inviteeEmail} for project ${projectName}:`, data?.id);
    } catch (error) {
      console.error('Failed to send invitation email:', error);
      throw error;
    }
  }

  async sendEndOfDaySummary(email: string, summary: any): Promise<boolean> {
    const subject = `🌅 End of Day Summary - ${summary.date}`;
    
    const htmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
        <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1e293b; margin: 0 0 10px 0; font-size: 28px;">End of Day Summary</h1>
            <p style="color: #64748b; margin: 0; font-size: 16px;">${summary.date}</p>
          </div>

          <div style="background-color: #1e3a8a; padding: 25px; border-radius: 8px; margin-bottom: 25px;">
            <div style="text-align: center; margin-bottom: 15px;">
              <h2 style="color: #ffffff !important; margin: 0; font-size: 20px; font-weight: 700;">🌇 End of Day</h2>
            </div>
            <div style="color: #ffffff !important; font-size: 15px; line-height: 1.5; text-align: center;">
              <p style="margin: 0; color: #ffffff !important;">${summary.message}</p>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px;">
            <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; text-align: center;">
              <div style="font-size: 32px; font-weight: bold; color: #059669; margin-bottom: 5px;">${summary.completedTasks}</div>
              <div style="color: #64748b; font-size: 14px;">Tasks Completed</div>
            </div>
            <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; text-align: center;">
              <div style="font-size: 32px; font-weight: bold; color: #3b82f6; margin-bottom: 5px;">${summary.activeProjects}</div>
              <div style="color: #64748b; font-size: 14px;">Active Projects</div>
            </div>
          </div>

          ${summary.accomplishments.length > 0 ? `
          <div style="margin-bottom: 25px;">
            <h3 style="color: #1e293b; margin-bottom: 15px; font-size: 20px;">🎉 Today's Accomplishments</h3>
            <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; border-radius: 0 8px 8px 0;">
              ${summary.accomplishments.map((task: string) => 
                `<div style="margin: 8px 0; color: #065f46;">✅ ${task}</div>`
              ).join('')}
            </div>
          </div>
          ` : ''}

          ${summary.tomorrowsPriorities.length > 0 ? `
          <div style="margin-bottom: 25px;">
            <h3 style="color: #1e293b; margin-bottom: 15px; font-size: 20px;">🚀 Tomorrow's Priorities</h3>
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 0 8px 8px 0;">
              ${summary.tomorrowsPriorities.map((task: string) => 
                `<div style="margin: 8px 0; color: #92400e;">📋 ${task}</div>`
              ).join('')}
            </div>
          </div>
          ` : ''}

          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            <p style="color: #64748b; font-size: 14px; margin: 0;">
              Have a great evening! Tomorrow is a new opportunity to achieve great things.
            </p>
          </div>
        </div>
      </div>
    `;

    const textContent = `
End of Day Summary - ${summary.date}

${summary.message}

Today's Stats:
• Completed Tasks: ${summary.completedTasks}
• Active Projects: ${summary.activeProjects}

${summary.accomplishments.length > 0 ? `
Today's Accomplishments:
${summary.accomplishments.map((task: string) => `• ${task}`).join('\n')}
` : ''}

${summary.tomorrowsPriorities.length > 0 ? `
Tomorrow's Priorities:
${summary.tomorrowsPriorities.map((task: string) => `• ${task}`).join('\n')}
` : ''}

Have a great evening!
    `;

    try {
      await this.resend.emails.send({
        from: process.env.FROM_EMAIL || 'AI ProjectHub <noreply@omarb.in>',
        to: [email],
        subject,
        html: htmlContent,
        text: textContent,
      });

      console.log(`End of day summary sent successfully to ${email}`);
      return true;
    } catch (error) {
      console.error('End of day summary email error:', error);
      return false;
    }
  }

  async sendMeetingProcessedNotification(
    email: string, 
    meetingTitle: string, 
    projectName: string, 
    tasksCreated: number, 
    summaryPreview: string
  ): Promise<boolean> {
    const subject = `📋 Meeting Processed: ${meetingTitle}`;
    
    const htmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
        <div style="background: white; border-radius: 12px; padding: 30px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1e293b; margin: 0 0 10px 0; font-size: 28px;">🎤 Meeting Processed</h1>
            <p style="color: #64748b; margin: 0; font-size: 16px;">${meetingTitle}</p>
          </div>

          <div style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <p style="margin: 0; font-size: 18px; text-align: center;">
              ✅ AI successfully processed your meeting recording
            </p>
          </div>

          <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <h3 style="color: #1e293b; margin-top: 0;">📊 Processing Results</h3>
            <ul style="list-style: none; padding: 0; margin: 0;">
              <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                <strong>Project:</strong> ${projectName}
              </li>
              <li style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                <strong>Tasks Created:</strong> ${tasksCreated} action items
              </li>
              <li style="padding: 8px 0;">
                <strong>Status:</strong> <span style="color: #10b981;">Complete & Ready</span>
              </li>
            </ul>
          </div>

          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 0 8px 8px 0; margin-bottom: 25px;">
            <h4 style="margin-top: 0; color: #92400e;">📝 Summary Preview</h4>
            <p style="margin: 0; color: #92400e; font-style: italic;">${summaryPreview}</p>
          </div>

          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #64748b; font-size: 14px; margin: 0;">
              🚀 Your meeting tasks are now available in your project dashboard.
            </p>
          </div>
        </div>
      </div>
    `;

    const textContent = `
Meeting Processed: ${meetingTitle}

AI has successfully processed your meeting recording!

Results:
- Project: ${projectName}
- Tasks Created: ${tasksCreated} action items
- Status: Complete & Ready

Summary Preview: ${summaryPreview}

Your meeting tasks are now available in your project dashboard.
    `;

    try {
      await this.resend.emails.send({
        from: process.env.FROM_EMAIL || 'AI ProjectHub <noreply@omarb.in>',
        to: [email],
        subject,
        html: htmlContent,
        text: textContent,
      });

      console.log(`Meeting notification sent to ${email}: ${meetingTitle}`);
      return true;
    } catch (error) {
      console.error('Meeting notification email error:', error);
      return false;
    }
  }
}

class MockEmailService implements EmailService {
  async sendTestEmail(email: string): Promise<void> {
    console.log(`Mock: Test email sent to ${email} (Resend API key not provided)`);
  }

  async sendNotificationEmail(email: string, subject: string, content: string): Promise<void> {
    console.log(`Mock: Email sent to ${email} - ${subject}: ${content}`);
  }

  async sendDailySummary(email: string, summary: any): Promise<void> {
    console.log(`Mock: Daily summary sent to ${email}:`, {
      date: summary.date,
      completedToday: summary.completedToday,
      productivityScore: summary.productivityScore,
      recommendations: summary.keyRecommendations?.length || 0
    });
  }

  async sendLunchBriefing(email: string, briefing: any): Promise<void> {
    console.log(`Mock: Lunch briefing sent to ${email}:`, {
      date: briefing.date,
      morningProgress: briefing.morningProgress,
      afternoonTasks: briefing.afternoonTasks,
      urgentAfternoon: briefing.urgentAfternoon,
      motivationalNote: briefing.motivationalNote
    });
  }

  async sendProjectAlert(email: string, projectName: string, alertType: string, message: string): Promise<void> {
    console.log(`Mock: Project alert sent to ${email} - ${projectName} (${alertType}): ${message}`);
  }

  async sendTaskDeadlineAlert(email: string, taskTitle: string, projectName: string, dueDate: string, isOverdue: boolean = false, daysOverdue: number = 0, projectId?: string, taskId?: string): Promise<void> {
    const alertType = isOverdue ? 'OVERDUE' : 'Deadline';
    console.log(`Mock: ${alertType} alert sent to ${email} - Task "${taskTitle}" in project "${projectName}" (Project ID: ${projectId}, Task ID: ${taskId})`);
  }

  async sendEndOfDaySummary(email: string, summary: any): Promise<boolean> {
    console.log(`Mock: End of day summary sent to ${email}:`, {
      date: summary.date,
      completedToday: summary.completedToday,
      productivityScore: summary.productivityScore,
      message: summary.message
    });
    return true;
  }

  async sendProjectInvitation(inviteeEmail: string, projectName: string, inviterName: string, token: string, role: string): Promise<void> {
    console.log(`Mock: Invitation email sent to ${inviteeEmail} for project ${projectName} by ${inviterName} as ${role} (token: ${token})`);
  }
}

// Use Resend if API key is available, otherwise use mock service
export const emailService = process.env.RESEND_API_KEY 
  ? new ResendEmailService() 
  : new MockEmailService();