// ICS File Parser Service
// Parses uploaded ICS calendar files and converts them to our event format

interface ParsedEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  location?: string;
  description?: string;
  type: 'calendar_event';
  allDay?: boolean;
  cancelled?: boolean;
  classification?: string;
  transparency?: string;
  attendees?: string[];
  organizer?: string;
  status?: string;
  recurring?: string;
}

export class IcsParserService {
  static parseIcsContent(icsContent: string): ParsedEvent[] {
    const events: ParsedEvent[] = [];
    const lines = icsContent.split(/\r?\n/);
    
    // Count total RRULE lines for debugging
    const rruleCount = lines.filter(line => line.trim().startsWith('RRULE:')).length;
    console.log(`Found ${rruleCount} RRULE lines in ICS file`);
    
    let currentEvent: Partial<ParsedEvent> | null = null;
    let multiLineValue = '';
    let multiLineProperty = '';

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();

      // Handle line continuation (lines starting with space or tab)
      if (line.startsWith(' ') || line.startsWith('\t')) {
        multiLineValue += line.substring(1);
        continue;
      }

      // Process previous multi-line property if any
      if (multiLineProperty && multiLineValue) {
        this.processProperty(currentEvent, multiLineProperty, multiLineValue);
        multiLineProperty = '';
        multiLineValue = '';
      }

      if (line === 'BEGIN:VEVENT') {
        currentEvent = {
          type: 'calendar_event',
          id: `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
      } else if (line === 'END:VEVENT' && currentEvent) {
        // Be more flexible about including events - include events even if they're cancelled or have limited info
        if (currentEvent.start) {
          // Generate a title if missing (this often happens with calendar invites)
          if (!currentEvent.title) {
            currentEvent.title = currentEvent.location || 
                                  currentEvent.description?.substring(0, 30) + '...' || 
                                  'Calendar Event';
          }

          // Include cancelled events but mark them as such
          if (currentEvent.cancelled) {
            currentEvent.title = `[CANCELLED] ${currentEvent.title}`;
          }

          // Log recurring events when the event ends
          if (currentEvent.recurring) {
            console.log('EVENT WITH RRULE COMPLETED:', currentEvent.title, 'RRULE:', currentEvent.recurring.substring(0, 50) + '...');
          }

          events.push(currentEvent as ParsedEvent);
        } else {
          // Only filter out events that have no date/time information at all
          console.log('FILTERED EVENT (no start time):', {
            title: currentEvent.title || 'MISSING',
            id: currentEvent.id,
            location: currentEvent.location,
            isRecurring: !!currentEvent.recurring,
            description: currentEvent.description?.substring(0, 50) + '...'
          });
        }
        currentEvent = null;
      } else if (currentEvent && line.includes(':')) {
        const colonIndex = line.indexOf(':');
        const property = line.substring(0, colonIndex);
        const value = line.substring(colonIndex + 1);

        // Check if this might be a multi-line property
        if (value.length > 0) {
          this.processProperty(currentEvent, property, value);
        } else {
          multiLineProperty = property;
          multiLineValue = value;
        }
      }
    }

    return events;
  }

  private static processProperty(event: Partial<ParsedEvent> | null, property: string, value: string) {
    if (!event) return;

    const [propName, ...params] = property.split(';');
    
    switch (propName) {
      case 'UID':
        event.id = value;
        break;
      case 'SUMMARY':
        event.title = this.unescapeText(value);
        break;
      case 'DESCRIPTION':
        event.description = this.unescapeText(value);
        break;
      case 'LOCATION':
        event.location = this.unescapeText(value);
        break;
      case 'DTSTART':
        event.start = this.parseDateTime(value, params);
        // Check if it's an all-day event (date only, no time)
        if (value.length === 8) {
          event.allDay = true;
        }
        break;
      case 'DTEND':
        event.end = this.parseDateTime(value, params);
        break;
      case 'STATUS':
        // Handle event status - track all statuses, not just cancelled
        event.status = value;
        if (value === 'CANCELLED') {
          event.cancelled = true;
        }
        console.log('EVENT STATUS:', value, 'for event with ID:', event.id);
        break;
      case 'CLASS':
        // Handle event classification (PUBLIC, PRIVATE, CONFIDENTIAL)
        event.classification = value;
        console.log('Event classification:', value, 'for event:', event.title || event.id || 'UNNAMED');
        break;
      case 'TRANSP':
        // Handle transparency (OPAQUE, TRANSPARENT)
        event.transparency = value;
        break;
      case 'ATTENDEE':
        // Handle attendees - this indicates calendar invites
        if (!event.attendees) event.attendees = [];
        event.attendees.push(value);
        console.log('FOUND ATTENDEE:', value, 'for event:', event.title || event.id || 'UNNAMED');
        break;
      case 'ORGANIZER':
        // Handle organizer
        event.organizer = this.unescapeText(value);
        break;
      case 'RRULE':
        // Handle recurring events - log and mark as recurring
        console.log('FOUND RECURRING EVENT:', event.title || event.id || 'UNNAMED', 'RRULE:', value.substring(0, 50) + '...');
        event.recurring = value;
        // Mark event as recurring for filtering
        (event as any).isRecurring = true;
        break;
      default:
        // Log unhandled properties to see what we might be missing
        if (['CREATED', 'LAST-MODIFIED', 'DTSTAMP', 'SEQUENCE', 'X-MICROSOFT-CDO-APPT-SEQUENCE', 'X-MICROSOFT-CDO-BUSYSTATUS', 'X-MICROSOFT-CDO-INTENDEDSTATUS', 'X-MICROSOFT-CDO-ALLDAYEVENT', 'X-MICROSOFT-CDO-IMPORTANCE', 'X-MICROSOFT-CDO-INSTTYPE', 'X-MICROSOFT-DONOTFORWARDMEETING', 'X-MICROSOFT-DISALLOW-COUNTER', 'X-MICROSOFT-REQUESTEDATTENDANCEMODE', 'X-MICROSOFT-ISRESPONSEREQUESTED'].includes(propName)) {
          // Skip common metadata fields
          break;
        }
        console.log('UNHANDLED ICS PROPERTY:', propName, '=', value.substring(0, 50) + (value.length > 50 ? '...' : ''));
        break;
    }
  }

  private static parseDateTime(dateTimeStr: string, params: string[]): string {
    console.log('RAW DTSTART:', { 
      line: `DTSTART${params.length ? ';' + params.join(';') : ''}:${dateTimeStr}`,
      dateStr: dateTimeStr,
      hasTimezone: params.some(p => p.startsWith('TZID=')),
      params
    });

    // Skip invalid dates like 16010101 (recurring event placeholders)
    if (dateTimeStr.startsWith('1601') || dateTimeStr.length < 8) {
      console.log('SKIPPING INVALID DATE:', dateTimeStr);
      throw new Error(`Invalid date: ${dateTimeStr}`);
    }

    // Extract timezone from parameters
    const tzidParam = params.find(p => p.startsWith('TZID='));
    const timezone = tzidParam ? tzidParam.substring(5) : null;

    // Handle different date formats
    if (dateTimeStr.length === 8) {
      // Date only: YYYYMMDD
      const year = dateTimeStr.substring(0, 4);
      const month = dateTimeStr.substring(4, 6);
      const day = dateTimeStr.substring(6, 8);
      const parsed = `${year}-${month}-${day}T00:00:00.000Z`;
      return parsed;
    } 
    
    // Parse datetime components
    const year = dateTimeStr.substring(0, 4);
    const month = dateTimeStr.substring(4, 6);
    const day = dateTimeStr.substring(6, 8);
    const hour = dateTimeStr.substring(9, 11) || '00';
    const minute = dateTimeStr.substring(11, 13) || '00';
    const second = dateTimeStr.substring(13, 15) || '00';

    if (dateTimeStr.endsWith('Z')) {
      // UTC DateTime: already in UTC
      const parsed = `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
      return parsed;
    }

    // Handle timezone conversion for local times
    if (timezone) {
      // FIXED: Don't use new Date() constructor which applies local timezone
      // Instead, manually construct the ISO string to preserve the original time
      const isoTime = `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
      
      return isoTime;
    }

    // No timezone specified - treat as local
    const parsed = `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
    return parsed;
  }

  private static unescapeText(text: string): string {
    return text
      .replace(/\\n/g, '\n')
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';')
      .replace(/\\\\/g, '\\');
  }

  static validateIcsFile(content: string): boolean {
    const lines = content.split(/\r?\n/);
    const hasBeginCalendar = lines.some(line => line.trim() === 'BEGIN:VCALENDAR');
    const hasEndCalendar = lines.some(line => line.trim() === 'END:VCALENDAR');
    const hasEvents = lines.some(line => line.trim() === 'BEGIN:VEVENT');
    
    return hasBeginCalendar && hasEndCalendar && hasEvents;
  }

  static getFileStats(content: string): { eventCount: number; dateRange?: { start: string; end: string } } {
    const events = this.parseIcsContent(content);
    
    if (events.length === 0) {
      return { eventCount: 0 };
    }

    const dates = events
      .map(e => new Date(e.start))
      .filter(d => !isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());

    if (dates.length === 0) {
      return { eventCount: events.length };
    }

    return {
      eventCount: events.length,
      dateRange: {
        start: dates[0].toISOString(),
        end: dates[dates.length - 1].toISOString()
      }
    };
  }
}