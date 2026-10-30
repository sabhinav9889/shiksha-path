import { z } from 'zod';
import { BOOKING_LIST_CAP, BOOKING_TOPICS } from './booking.js';
import { sessionLink } from './community-staff.js';

const MIN_MINUTES = 15;
const MAX_MINUTES = 120;
const STEP_MINUTES = 15;

/** A mentor publishes a slot: a time, 15 to 120 minutes in steps of 15, and a link they paste. */
export const slotRequest = z.strictObject({
  startsAt: z.iso.datetime({ offset: true }),
  minutes: z
    .number()
    .int()
    .min(MIN_MINUTES)
    .max(MAX_MINUTES)
    .refine((n) => n % STEP_MINUTES === 0),
  link: sessionLink.nullable(),
});
export type SlotRequest = z.infer<typeof slotRequest>;

export const slotRemoveRequest = z.strictObject({ id: z.uuid() });

/** A slot as its mentor (or an admin) sees it, with who booked it. */
export const staffSlot = z.object({
  id: z.uuid(),
  mentorName: z.string().nullable(),
  startsAt: z.string(),
  minutes: z.number().int(),
  link: z.string().nullable(),
  booking: z
    .object({
      id: z.uuid(),
      studentName: z.string(),
      topic: z.enum(BOOKING_TOPICS),
      note: z.string(),
    })
    .nullable(),
});
export type StaffSlot = z.infer<typeof staffSlot>;

export const staffSlotsResponse = z.object({ slots: z.array(staffSlot).max(BOOKING_LIST_CAP) });
export type StaffSlotsResponse = z.infer<typeof staffSlotsResponse>;
