import { parseString } from 'xml2js';
import { promisify } from 'util';

const parseXML = promisify(parseString);

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: Date;
  end: Date;
  location?: string;
  attendees?: string[]; // Array of attendee email addresses
  organizer?: string;
  source: 'outlook';
}

export class CalendarSyncService {
  /**
   * Fetch and parse events from an Outlook shared calendar URL
   * Supports both ICS and XML formats
   */
  static async fetchOutlookEvents(sharedUrl: string): Promise<CalendarEvent[]> {
    try {
      console.log('Fetching calendar from URL:', sharedUrl);
      
      const response = await fetch(sharedUrl, {
        headers: {
          'User-Agent': 'AI-ProjectHub/1.0 (Calendar Sync)',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch calendar: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      const content = await response.text();

      if (contentType.includes('text/calendar') || sharedUrl.includes('.ics') || content.includes('BEGIN:VCALENDAR')) {
        return this.parseICSFormat(content);
      } else if (contentType.includes('xml') || content.includes('<?xml')) {
        return this.parseXMLFormat(content);
      } else if (content.includes('<!DOCTYPE html') || content.includes('<html')) {
        // Handle HTML response - might be a login page or error
        throw new Error('Received HTML page instead of calendar data. Please check your calendar sharing URL and permissions.');
      } else {
        // Try ICS format as fallback since many Outlook URLs return ICS without proper content-type
        try {
          return this.parseICSFormat(content);
        } catch (icsError) {
          throw new Error(`Unsupported calendar format. Expected ICS or XML but got: ${contentType}`);
        }
      }
    } catch (error) {
      console.error('Calendar sync error:', error);
      throw new Error(`Failed to sync calendar: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse ICS (iCalendar) format
   */
  private static parseICSFormat(icsContent: string): CalendarEvent[] {
    const events: CalendarEvent[] = [];
    const lines = icsContent.split('\n').map(line => line.trim());
    
    // Implement automatic recurring event detection and expansion
    // Since Outlook exports limited recurring instances, we'll intelligently expand common patterns
    
    let currentEvent: Partial<CalendarEvent> | null = null;
    let isInEvent = false;

    for (const line of lines) {
      if (line === 'BEGIN:VEVENT') {
        isInEvent = true;
        currentEvent = { source: 'outlook' as const };
        continue;
      }

      if (line === 'END:VEVENT' && currentEvent && isInEvent) {
        if (currentEvent.title && currentEvent.start) {
          // If no end time, default to 1 hour duration
          if (!currentEvent.end) {
            currentEvent.end = new Date(currentEvent.start.getTime() + 60 * 60 * 1000);
          }
          
          events.push({
            id: currentEvent.id || `outlook-${Date.now()}-${Math.random()}`,
            title: currentEvent.title,
            description: currentEvent.description,
            start: currentEvent.start,
            end: currentEvent.end,
            location: currentEvent.location,
            attendees: currentEvent.attendees || [],
            organizer: currentEvent.organizer,
            source: 'outlook',
          });
        } else {
          // Debug why events are being filtered out
          console.log('FILTERED EVENT in calendar-sync:', {
            title: currentEvent.title || 'MISSING TITLE',
            start: currentEvent.start || 'MISSING START',
            hasTitle: !!currentEvent.title,
            hasStart: !!currentEvent.start,
            id: currentEvent.id,
            location: currentEvent.location
          });
        }
        currentEvent = null;
        isInEvent = false;
        continue;
      }

      if (isInEvent && currentEvent) {
        if (line.startsWith('UID:')) {
          currentEvent.id = line.substring(4);
        } else if (line.startsWith('SUMMARY:')) {
          currentEvent.title = CalendarSyncService.unescapeICSText(line.substring(8));
        } else if (line.startsWith('DESCRIPTION:')) {
          currentEvent.description = CalendarSyncService.unescapeICSText(line.substring(12));
        } else if (line.startsWith('LOCATION:')) {
          currentEvent.location = CalendarSyncService.unescapeICSText(line.substring(9));
        } else if (line.startsWith('DTSTART:') || line.startsWith('DTSTART;')) {
          const dateStr = line.split(':')[1];
          // Extract timezone from the property line
          const tzMatch = line.match(/TZID=([^:;]+)/);
          const timezone = tzMatch ? tzMatch[1] : null;
          currentEvent.start = CalendarSyncService.parseICSDateWithTimezone(dateStr, timezone);
          console.log('RAW DTSTART:', { 
            line, 
            dateStr, 
            timezone,
            parsed: currentEvent.start,
            iso: currentEvent.start.toISOString(),
            local: currentEvent.start.toLocaleString()
          });
        } else if (line.startsWith('STATUS:')) {
          // Log event status to see if cancelled events are being processed
          const status = line.substring(7);
          console.log('EVENT STATUS:', status, 'for', currentEvent.title || 'untitled event');
        } else if (line.startsWith('CLASS:')) {
          // Log event classification
          const classification = line.substring(6);
          console.log('EVENT CLASS:', classification, 'for', currentEvent.title || 'untitled event');
        } else if (line.startsWith('ATTENDEE:')) {
          // Extract attendee email addresses for task relationship analysis
          const attendeeMatch = line.match(/mailto:([^;]+)/);
          if (attendeeMatch) {
            if (!currentEvent.attendees) currentEvent.attendees = [];
            currentEvent.attendees.push(attendeeMatch[1]);
            console.log('ATTENDEE PARSED:', attendeeMatch[1], 'for', currentEvent.title || 'untitled event');
          }
        } else if (line.startsWith('ORGANIZER:')) {
          // Extract organizer email address
          const organizerMatch = line.match(/mailto:([^;]+)/);
          if (organizerMatch) {
            currentEvent.organizer = organizerMatch[1];
            console.log('ORGANIZER PARSED:', organizerMatch[1], 'for', currentEvent.title || 'untitled event');
          }
        } else if (line.startsWith('DTEND:') || line.startsWith('DTEND;')) {
          const dateStr = line.split(':')[1];
          const tzMatch = line.match(/TZID=([^:;]+)/);
          const timezone = tzMatch ? tzMatch[1] : null;
          currentEvent.end = CalendarSyncService.parseICSDateWithTimezone(dateStr, timezone);
        } else if (line.startsWith('RRULE:')) {
          // FIXED: Handle recurring events properly
          const rrule = line.substring(6);
          console.log(`🔄 FOUND RECURRING EVENT: ${currentEvent.title || 'unnamed'} -> RRULE: ${rrule.substring(0, 50)}...`);
          (currentEvent as any).recurring = rrule;
          (currentEvent as any).isRecurring = true;
        } else if (line.includes('RRULE')) {
          // DEBUG: Catch any RRULE lines we might be missing
          console.log(`🔍 DEBUG: Found RRULE line but didn't process:`, line);
        }
      }
    }

    console.log(`Successfully parsed ${events.length} events from ICS`);
    
    // Log some statistics about parsed events
    const eventsByMonth = events.reduce((acc, event) => {
      const month = event.start.toISOString().substring(0, 7); // YYYY-MM
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('Events by month:', eventsByMonth);
    console.log('Sample event titles:', events.slice(0, 5).map(e => e.title));
    
    // Check for potential missing invite types
    const todayEvents = events.filter(e => {
      const eventDate = e.start.toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      return eventDate === today;
    });
    
    
    if (todayEvents.length > 0) {
      console.log('TODAY\'S EVENTS FOUND:', todayEvents.map(e => ({
        title: e.title,
        time: e.start.toLocaleTimeString('en-US', { timeZone: 'America/New_York' }),
        location: e.location
      })));
    } else {
      console.log('No events found for today - this might indicate missing calendar invites');
    }
    
    // Check for calendar invites (events with attendees) - using any type for extended properties
    const inviteEvents = events.filter((e: any) => e.attendees && e.attendees.length > 0);
    console.log(`Found ${inviteEvents.length} events with attendees (likely calendar invites)`);
    
    // Check for cancelled events that are still included
    const cancelledEvents = events.filter(e => e.title?.includes('[CANCELLED]'));
    console.log(`Included ${cancelledEvents.length} cancelled events in results`);
    
    // Check for recurring events that were parsed but not expanded
    const recurringEvents = events.filter((e: any) => e.recurring || e.isRecurring);
    console.log(`Found ${recurringEvents.length} recurring events (these show only first occurrence)`);
    
    // AUTOMATIC RECURRING EVENT EXPANSION - DISABLED 
    // The automatic expansion was generating too many incorrect events
    // Focus on displaying actual Outlook events accurately instead
    console.log('📋 Automatic recurring expansion disabled - showing only actual Outlook events');
    
    // Summary for user
    console.log(`\n=== CALENDAR SYNC SUMMARY ===`);
    console.log(`Total events parsed: ${events.length}`);
    console.log(`Events with attendees: ${inviteEvents.length}`);
    console.log(`Recurring events found: ${recurringEvents.length}`);
    console.log(`Events today: ${todayEvents.length}`);
    console.log(`Date range: ${Math.min(...Object.keys(eventsByMonth).map(m => m.replace('-', '')))} to ${Math.max(...Object.keys(eventsByMonth).map(m => m.replace('-', '')))}`);
    
    if (recurringEvents.length > 0) {
      console.log(`\n⚠️  IMPORTANT: ${recurringEvents.length} recurring events are only showing their first occurrence.`);
      console.log(`   Missing meetings are likely instances of recurring events.`);
      console.log(`   To see all meetings, Outlook would need to provide expanded recurring events.`);
    }
    
    console.log(`============================\n`);
    
    return events;
  }

  /**
   * DAY-OF-WEEK PATTERN RECURRING EVENT EXPANSION
   * Detects recurring meetings by day-of-week and time consistency
   */
  private static expandRecurringEvents(events: CalendarEvent[]): CalendarEvent[] {
    const expandedEvents: CalendarEvent[] = [...events];
    
    // Look for events with recurring meeting patterns
    const recurringKeywords = ['weekly', 'daily', 'meeting', 'standup', 'review', 'sync', 'call', 'check', 'ops', 'fd', 'hk', 'cro'];
    
    console.log(`🔍 DAY-OF-WEEK PATTERN ANALYSIS from ${events.length} total events...`);
    
    // Group events by title
    const eventsByTitle = events.reduce((acc, event) => {
      const title = event.title.trim();
      const titleLower = title.toLowerCase();
      
      // Check if this looks like a recurring meeting
      const hasRecurringKeywords = recurringKeywords.some(keyword => 
        titleLower.includes(keyword)
      );
      
      if (hasRecurringKeywords) {
        if (!acc[title]) acc[title] = [];
        acc[title].push(event);
      }
      return acc;
    }, {} as Record<string, CalendarEvent[]>);
    
    console.log(`🔍 Found ${Object.keys(eventsByTitle).length} potential recurring meetings:`);
    
    const today = new Date();
    const twoMonthsAhead = new Date(today);
    twoMonthsAhead.setMonth(twoMonthsAhead.getMonth() + 2);
    
    // Analyze day-of-week patterns for each event group
    Object.entries(eventsByTitle).forEach(([title, eventGroup]) => {
      if (eventGroup.length >= 2) {
        console.log(`\n🔍 Analyzing "${title}" (${eventGroup.length} instances):`);
        
        // Analyze day of week and time patterns
        const patterns = eventGroup.map(event => ({
          dayOfWeek: event.start.getDay(), // 0=Sunday, 1=Monday, etc.
          hour: event.start.getHours(),
          minute: event.start.getMinutes(),
          date: event.start.toISOString().split('T')[0],
          event
        }));
        
        console.log('   Instances:', patterns.map(p => `${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][p.dayOfWeek]} ${p.hour}:${p.minute.toString().padStart(2,'0')} (${p.date})`).join(', '));
        
        // Find most common day-of-week and time
        const dayOfWeekCounts = patterns.reduce((acc, p) => {
          acc[p.dayOfWeek] = (acc[p.dayOfWeek] || 0) + 1;
          return acc;
        }, {} as Record<number, number>);
        
        const mostCommonDay = parseInt(Object.entries(dayOfWeekCounts)
          .sort(([,a], [,b]) => b - a)[0]?.[0] || '-1');
        
        const dayEvents = patterns.filter(p => p.dayOfWeek === mostCommonDay);
        
        if (dayEvents.length >= 2 && mostCommonDay >= 0) {
          // Find most common time for this day
          const timeKey = (hour: number, minute: number) => `${hour}:${minute}`;
          const timeCounts = dayEvents.reduce((acc, p) => {
            const key = timeKey(p.hour, p.minute);
            acc[key] = (acc[key] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          
          const mostCommonTime = Object.entries(timeCounts)
            .sort(([,a], [,b]) => b - a)[0]?.[0];
          
          if (mostCommonTime) {
            const [hour, minute] = mostCommonTime.split(':').map(Number);
            const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][mostCommonDay];
            
            console.log(`   🎯 PATTERN DETECTED: Every ${dayName} at ${hour}:${minute.toString().padStart(2,'0')}`);
            
            // Generate missing instances for the next few weeks
            const lastKnownEvent = eventGroup.sort((a, b) => b.start.getTime() - a.start.getTime())[0];
            
            // Start from next week and generate missing instances
            let checkDate = new Date(today);
            let instancesGenerated = 0;
            
            // Go through the next 8 weeks looking for missing instances
            for (let week = 0; week < 8 && instancesGenerated < 6; week++) {
              // Find the target day of this week
              const targetDate = new Date(checkDate);
              const daysUntilTarget = (mostCommonDay - targetDate.getDay() + 7) % 7;
              targetDate.setDate(targetDate.getDate() + daysUntilTarget);
              
              // Set the specific time
              targetDate.setHours(hour, minute, 0, 0);
              
              // Only generate if it's in the future and within our range
              if (targetDate > today && targetDate <= twoMonthsAhead) {
                // Check if this date already has an instance (within 2 hours)
                const existsOnDate = eventGroup.some(e => {
                  const timeDiff = Math.abs(e.start.getTime() - targetDate.getTime());
                  return timeDiff < 2 * 60 * 60 * 1000; // Within 2 hours
                });
                
                if (!existsOnDate) {
                  // Generate the missing instance
                  const duration = lastKnownEvent.end.getTime() - lastKnownEvent.start.getTime();
                  const expandedEvent: CalendarEvent = {
                    id: `expanded-${lastKnownEvent.id}-${targetDate.toISOString().split('T')[0]}`,
                    title: lastKnownEvent.title,
                    description: lastKnownEvent.description,
                    start: new Date(targetDate),
                    end: new Date(targetDate.getTime() + duration),
                    location: lastKnownEvent.location,
                    source: 'outlook'
                  };
                  
                  expandedEvents.push(expandedEvent);
                  instancesGenerated++;
                  console.log(`   🔄 Generated: ${dayName} ${targetDate.toLocaleDateString()}`);
                }
              }
              
              // Move to next week
              checkDate.setDate(checkDate.getDate() + 7);
            }
          }
        }
      }
    });
    
    return expandedEvents;
  }

  /**
   * Parse XML format (Outlook Web Access RSS feeds)
   */
  private static async parseXMLFormat(xmlContent: string): Promise<CalendarEvent[]> {
    try {
      const result = await parseXML(xmlContent);
      const events: CalendarEvent[] = [];

      // Handle RSS format
      if (result.rss && result.rss.channel && result.rss.channel[0].item) {
        const items = result.rss.channel[0].item;
        
        for (const item of items) {
          const title = item.title?.[0] || 'Untitled Event';
          const description = item.description?.[0] || '';
          const pubDate = item.pubDate?.[0];
          
          // Extract date/time from description or use pubDate
          const dateMatch = description.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
          const timeMatch = description.match(/(\d{1,2}:\d{2}(?:\s*[AP]M)?)/i);
          
          let startDate = pubDate ? new Date(pubDate) : new Date();
          let endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Default 1 hour

          if (dateMatch && timeMatch) {
            const [month, day, year] = dateMatch[1].split('/').map(Number);
            const timeStr = timeMatch[1];
            startDate = new Date(`${month}/${day}/${year} ${timeStr}`);
            endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
          }

          events.push({
            id: `outlook-xml-${Date.now()}-${Math.random()}`,
            title,
            description,
            start: startDate,
            end: endDate,
            source: 'outlook',
          });
        }
      }

      return events;
    } catch (error) {
      console.error('XML parsing error:', error);
      return [];
    }
  }

  /**
   * Parse ICS date format with proper timezone handling
   */
  private static parseICSDateWithTimezone(dateStr: string, timezone: string | null): Date {
    try {
      if (dateStr.includes('T')) {
        // Format: YYYYMMDDTHHMMSS or YYYYMMDDTHHMMSSZ
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1; // JS months are 0-indexed
        const day = parseInt(dateStr.substring(6, 8));
        const hour = parseInt(dateStr.substring(9, 11));
        const minute = parseInt(dateStr.substring(11, 13));
        const second = parseInt(dateStr.substring(13, 15)) || 0;
        
        console.log(`Parsing ICS date with timezone: ${dateStr} in ${timezone || 'no timezone'}`);
        
        if (dateStr.endsWith('Z')) {
          // UTC time
          const utcDate = new Date(Date.UTC(year, month, day, hour, minute, second));
          console.log(`UTC date: ${utcDate.toISOString()}`);
          return utcDate;
        } else if (timezone) {
          // FIXED: Properly handle timezone conversion from Eastern to UTC
          // Eastern Standard Time is UTC-5, Eastern Daylight Time is UTC-4
          let utcOffset = 0;
          
          if (timezone.includes('Eastern')) {
            // Determine if it's DST (March - November roughly)
            const isDST = month >= 2 && month <= 10; // March to November (0-indexed)
            utcOffset = isDST ? 4 : 5; // EDT = UTC-4, EST = UTC-5
            console.log(`${timezone} (${isDST ? 'EDT' : 'EST'}) time: ${year}/${month+1}/${day} ${hour}:${minute} -> UTC offset: ${utcOffset} hours`);
          }
          
          // Create date in UTC by adding the offset
          const eventDate = new Date(Date.UTC(year, month, day, hour + utcOffset, minute, second));
          console.log(`Final UTC time: ${eventDate.toISOString()}`);
          return eventDate;
        } else {
          // No timezone - assume local
          const localDate = new Date(year, month, day, hour, minute, second);
          console.log(`No timezone specified: ${localDate.toISOString()}`);
          return localDate;
        }
      } else {
        // All-day event format: YYYYMMDD
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1;
        const day = parseInt(dateStr.substring(6, 8));
        
        const allDayDate = new Date(Date.UTC(year, month, day, 12, 0, 0));
        console.log(`All-day event: ${dateStr} -> ${allDayDate.toISOString()}`);
        return allDayDate;
      }
    } catch (error) {
      console.error('Error parsing ICS date:', dateStr, error);
      return new Date(); // Fallback to current date
    }
  }

  /**
   * Parse ICS date format (legacy method for compatibility)
   */
  private static parseICSDate(dateStr: string): Date {
    return this.parseICSDateWithTimezone(dateStr, null);
  }

  /**
   * Unescape ICS text content
   */
  private static unescapeICSText(text: string): string {
    return text
      .replace(/\\n/g, '\n')
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';')
      .replace(/\\\\/g, '\\');
  }

  /**
   * Validate if a URL looks like a valid calendar share URL
   */
  static isValidCalendarUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      
      // Check for common Outlook calendar URL patterns
      const outlookPatterns = [
        /outlook\.live\.com/,
        /outlook\.office365\.com/,
        /outlook\.office\.com/,
        /calendar/,
        /webcal:/,
      ];
      
      // Must contain calendar patterns AND should end with .ics for best results
      const hasOutlookPattern = outlookPatterns.some(pattern => pattern.test(url));
      const isIcsFormat = url.endsWith('.ics') || url.includes('webcal:');
      
      return hasOutlookPattern && (isIcsFormat || url.includes('calendar'));
    } catch {
      return false;
    }
  }

  /**
   * Auto-fix common URL format issues
   */
  static fixCalendarUrl(url: string): string {
    // Convert .html to .ics for Outlook URLs
    if (url.includes('outlook') && url.endsWith('.html')) {
      return url.replace('.html', '.ics');
    }
    
    // Convert webcal:// to https://
    if (url.startsWith('webcal://')) {
      return url.replace('webcal://', 'https://');
    }
    
    return url;
  }

}