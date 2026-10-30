import { z } from 'zod';

/** What a booking is about (spec §10.1). */
export const BOOKING_TOPICS = ['doubt', 'progress', 'career', 'resume'] as const;
export type BookingTopic = (typeof BOOKING_TOPICS)[number];

export const MAX_NOTE = 280;
/** The most slots or bookings one answer lists: a fixed cap, not paging. */
export const BOOKING_LIST_CAP = 50;

/** A slot a student may book. No link: that is only given with a booking. */
export const openSlot = z.object({
  id: z.uuid(),
  mentorName: z.string(),
  startsAt: z.string(),
  minutes: z.number().int(),
});

export const openSlotsResponse = z.object({ slots: z.array(openSlot).max(BOOKING_LIST_CAP) });
export type OpenSlotsResponse = z.infer<typeof openSlotsResponse>;

/** Who is booking comes from the session, never from the request. */
export const bookRequest = z.strictObject({
  slotId: z.uuid(),
  topic: z.enum(BOOKING_TOPICS),
  note: z.string().trim().max(MAX_NOTE).default(''),
});
export type BookRequest = z.input<typeof bookRequest>;

/** What a booking or a cancel answers with. */
export const bookedResponse = z.object({ id: z.uuid() });
export const cancelledResponse = z.object({ ok: z.literal(true) });

export const cancelBookingRequest = z.strictObject({ id: z.uuid() });

export const myBooking = z.object({
  id: z.uuid(),
  startsAt: z.string(),
  minutes: z.number().int(),
  /** Null once the mentor has gone. */
  mentorName: z.string().nullable(),
  topic: z.enum(BOOKING_TOPICS),
  /** The meeting link the mentor gave, kept with this booking only. */
  link: z.string().nullable(),
  status: z.literal('booked'),
});

export const myBookingsResponse = z.object({
  bookings: z.array(myBooking).max(BOOKING_LIST_CAP),
});
export type MyBookingsResponse = z.infer<typeof myBookingsResponse>;
