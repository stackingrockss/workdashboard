export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string | null;
  location?: string | null;
  startTime: Date | string;
  endTime: Date | string;
  attendees: string[];
  isExternal: boolean;
  organizerEmail?: string | null;
  meetingUrl?: string | null;
  opportunityId?: string | null;
  accountId?: string | null;
}

export interface CalendarEventFilter {
  startDate?: Date | string;
  endDate?: Date | string;
  accountId?: string;
  opportunityId?: string;
  externalOnly?: boolean;
}

export enum CalendarProvider {
  GOOGLE = 'google',
  MICROSOFT = 'microsoft',
  APPLE = 'apple',
}

export interface OAuthToken {
  id: string;
  userId: string;
  provider: CalendarProvider;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt: Date;
  scopes: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CalendarConnectionStatus {
  connected: boolean;
  provider?: CalendarProvider;
  email?: string;
  lastSync?: Date;
  scopes?: string[];
}

export interface CreateCalendarEventInput {
  summary: string;
  description?: string;
  location?: string;
  startTime: Date | string;
  endTime: Date | string;
  attendees?: string[];
  reminders?: {
    useDefault?: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
  colorId?: string;
  sendUpdates?: 'all' | 'externalOnly' | 'none';
}

export interface UpdateCalendarEventInput {
  summary?: string;
  description?: string;
  location?: string;
  startTime?: Date | string;
  endTime?: Date | string;
  attendees?: string[];
  reminders?: {
    useDefault?: boolean;
    overrides?: Array<{
      method: 'email' | 'popup';
      minutes: number;
    }>;
  };
  colorId?: string;
  sendUpdates?: 'all' | 'externalOnly' | 'none';
}
