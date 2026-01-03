import { z } from 'zod';

export const calendarEventFilterSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  accountId: z.string().optional(),
  opportunityId: z.string().optional(),
  externalOnly: z
    .string()
    .transform((val) => val === 'true')
    .pipe(z.boolean())
    .optional(),
  pageToken: z.string().optional(),
  maxResults: z.number().int().min(1).max(250).optional(),
});

export const createCalendarEventSchema = z.object({
  summary: z.string().min(1, 'Event title is required').max(1024),
  description: z.string().max(8192).optional(),
  location: z.string().max(512).optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  attendees: z.array(z.string().email()).optional(),
  reminders: z
    .object({
      useDefault: z.boolean().optional(),
      overrides: z
        .array(
          z.object({
            method: z.enum(['email', 'popup']),
            minutes: z.number().int().min(0).max(40320), // Max 4 weeks
          })
        )
        .optional(),
    })
    .optional(),
  colorId: z.string().optional(),
  sendUpdates: z.enum(['all', 'externalOnly', 'none']).optional(),
  opportunityId: z.string().cuid().optional(), // Link to opportunity
});

export const updateCalendarEventSchema = z.object({
  summary: z.string().min(1).max(1024).optional(),
  description: z.string().max(8192).optional(),
  location: z.string().max(512).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  attendees: z.array(z.string().email()).optional(),
  reminders: z
    .object({
      useDefault: z.boolean().optional(),
      overrides: z
        .array(
          z.object({
            method: z.enum(['email', 'popup']),
            minutes: z.number().int().min(0).max(40320),
          })
        )
        .optional(),
    })
    .optional(),
  colorId: z.string().optional(),
  sendUpdates: z.enum(['all', 'externalOnly', 'none']).optional(),
});

export const calendarEventLinkSchema = z.object({
  eventId: z.string(),
  opportunityId: z.string().cuid().optional(),
  accountId: z.string().cuid().optional(),
});

// Manual meeting schemas
export const createManualMeetingSchema = z.object({
  summary: z.string().min(1, 'Meeting title is required').max(200),
  description: z.string().max(2000).optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  meetingUrl: z.string().url().optional().nullable(),
}).refine(
  (data) => new Date(data.endTime) > new Date(data.startTime),
  { message: 'End time must be after start time', path: ['endTime'] }
);

export const updateManualMeetingSchema = z.object({
  summary: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  meetingUrl: z.string().url().optional().nullable(),
});

// Type exports
export type CalendarEventFilterInput = z.infer<
  typeof calendarEventFilterSchema
>;
export type CreateCalendarEventInput = z.infer<
  typeof createCalendarEventSchema
>;
export type UpdateCalendarEventInput = z.infer<
  typeof updateCalendarEventSchema
>;
export type CalendarEventLinkInput = z.infer<typeof calendarEventLinkSchema>;
export type CreateManualMeetingInput = z.infer<typeof createManualMeetingSchema>;
export type UpdateManualMeetingInput = z.infer<typeof updateManualMeetingSchema>;
