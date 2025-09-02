import { Client, AuthenticationProvider } from '@microsoft/microsoft-graph-client';
import { ConfidentialClientApplication } from '@azure/msal-node';
import 'isomorphic-fetch';

class OutlookAuthProvider implements AuthenticationProvider {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async getAccessToken(): Promise<string> {
    return this.accessToken;
  }
}

export class OutlookService {
  private static clientApp: ConfidentialClientApplication | null = null;

  private static initializeClientApp() {
    if (!process.env.OUTLOOK_CLIENT_ID || !process.env.OUTLOOK_CLIENT_SECRET || !process.env.OUTLOOK_TENANT_ID) {
      throw new Error('Missing Outlook OAuth configuration. Please set OUTLOOK_CLIENT_ID, OUTLOOK_CLIENT_SECRET, and OUTLOOK_TENANT_ID environment variables.');
    }

    if (!this.clientApp) {
      this.clientApp = new ConfidentialClientApplication({
        auth: {
          clientId: process.env.OUTLOOK_CLIENT_ID,
          clientSecret: process.env.OUTLOOK_CLIENT_SECRET,
          authority: `https://login.microsoftonline.com/${process.env.OUTLOOK_TENANT_ID}`,
        },
      });
    }
    return this.clientApp;
  }

  static async getAuthUrl(): Promise<string> {
    const clientApp = this.initializeClientApp();
    const authCodeUrlParameters = {
      scopes: ['https://graph.microsoft.com/Calendars.ReadWrite', 'https://graph.microsoft.com/User.Read'],
      redirectUri: `${process.env.BASE_URL || 'http://localhost:5000'}/api/auth/outlook/callback`,
    };

    return await clientApp.getAuthCodeUrl(authCodeUrlParameters);
  }

  static async exchangeCodeForToken(code: string): Promise<string> {
    const clientApp = this.initializeClientApp();
    
    const tokenRequest = {
      code,
      scopes: ['https://graph.microsoft.com/Calendars.ReadWrite', 'https://graph.microsoft.com/User.Read'],
      redirectUri: `${process.env.BASE_URL || 'http://localhost:5000'}/api/auth/outlook/callback`,
    };

    try {
      const response = await clientApp.acquireTokenByCode(tokenRequest);
      return response.accessToken;
    } catch (error) {
      throw new Error('Failed to exchange authorization code for access token');
    }
  }

  static async getCalendarEvents(accessToken: string, startDate?: Date, endDate?: Date): Promise<any[]> {
    const authProvider = new OutlookAuthProvider(accessToken);
    const graphClient = Client.initWithMiddleware({ authProvider });

    try {
      let requestUrl = '/me/events';
      
      if (startDate && endDate) {
        const startTime = startDate.toISOString();
        const endTime = endDate.toISOString();
        requestUrl += `?$filter=start/dateTime ge '${startTime}' and start/dateTime le '${endTime}'`;
      }

      requestUrl += (requestUrl.includes('?') ? '&' : '?') + '$orderby=start/dateTime&$top=100';

      const events = await graphClient.api(requestUrl).get();
      
      return events.value.map((event: any) => ({
        id: event.id,
        title: event.subject,
        description: event.bodyPreview,
        start: new Date(event.start.dateTime),
        end: new Date(event.end.dateTime),
        location: event.location?.displayName,
        attendees: event.attendees?.map((attendee: any) => ({
          name: attendee.emailAddress.name,
          email: attendee.emailAddress.address,
        })),
        isAllDay: event.isAllDay,
        webLink: event.webLink,
        source: 'outlook'
      }));
    } catch (error) {
      console.error('Error fetching Outlook calendar events:', error);
      throw new Error('Failed to fetch calendar events from Outlook');
    }
  }

  static async createCalendarEvent(accessToken: string, eventData: {
    title: string;
    description?: string;
    start: Date;
    end: Date;
    location?: string;
    attendees?: string[];
  }): Promise<any> {
    const authProvider = new OutlookAuthProvider(accessToken);
    const graphClient = Client.initWithMiddleware({ authProvider });

    const event = {
      subject: eventData.title,
      body: {
        contentType: 'Text',
        content: eventData.description || '',
      },
      start: {
        dateTime: eventData.start.toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: eventData.end.toISOString(),
        timeZone: 'UTC',
      },
      location: eventData.location ? {
        displayName: eventData.location,
      } : undefined,
      attendees: eventData.attendees?.map(email => ({
        emailAddress: {
          address: email,
          name: email.split('@')[0],
        },
        type: 'required',
      })),
    };

    try {
      const createdEvent = await graphClient.api('/me/events').post(event);
      return {
        id: createdEvent.id,
        title: createdEvent.subject,
        start: new Date(createdEvent.start.dateTime),
        end: new Date(createdEvent.end.dateTime),
        webLink: createdEvent.webLink,
      };
    } catch (error) {
      console.error('Error creating Outlook calendar event:', error);
      throw new Error('Failed to create calendar event in Outlook');
    }
  }

  static async getUserProfile(accessToken: string): Promise<any> {
    const authProvider = new OutlookAuthProvider(accessToken);
    const graphClient = Client.initWithMiddleware({ authProvider });

    try {
      const user = await graphClient.api('/me').get();
      return {
        id: user.id,
        name: user.displayName,
        email: user.mail || user.userPrincipalName,
      };
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw new Error('Failed to fetch user profile from Outlook');
    }
  }
}