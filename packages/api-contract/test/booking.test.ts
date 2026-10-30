import { describe, expect, test } from 'vitest';
import { API_ERRORS } from '../src/errors.js';
import { bookRequest, myBookingsResponse, openSlotsResponse } from '../src/booking.js';
import { slotRemoveRequest, slotRequest, staffSlotsResponse } from '../src/booking-staff.js';

const id = '3b241101-e2bb-4255-8caf-4136c566a962';
const slot = { startsAt: '2026-11-10T10:30:00+05:30', minutes: 30, link: null };

describe('slot requests', () => {
  test('a slot has a time, a length in steps of 15 minutes from 15 to 120, and an optional https link', () => {
    expect(slotRequest.safeParse(slot).success).toBe(true);
    const link = { ...slot, link: 'https://meet.google.com/abc-defg-hij' };
    expect(slotRequest.safeParse(link).success).toBe(true);
    for (const minutes of [10, 14, 20, 125, 135, 0]) {
      expect(slotRequest.safeParse({ ...slot, minutes }).success).toBe(false);
    }
    for (const minutes of [15, 30, 45, 60, 120]) {
      expect(slotRequest.safeParse({ ...slot, minutes }).success).toBe(true);
    }
  });

  test('refuses a bad time, an http or script link, and unknown keys', () => {
    expect(slotRequest.safeParse({ ...slot, startsAt: 'tomorrow' }).success).toBe(false);
    for (const link of ['http://x.org', 'javascript:alert(1)', 'https://u:p@x.org/a']) {
      expect(slotRequest.safeParse({ ...slot, link }).success).toBe(false);
    }
    expect(slotRequest.safeParse({ ...slot, mentorId: id }).success).toBe(false);
    expect(slotRemoveRequest.safeParse({ id }).success).toBe(true);
    expect(slotRemoveRequest.safeParse({ id: 'x' }).success).toBe(false);
  });
});

describe('booking requests', () => {
  test('a student picks a slot, one of four topics, and a note of at most 280 characters', () => {
    expect(bookRequest.safeParse({ slotId: id, topic: 'career', note: 'CV help' }).success).toBe(
      true,
    );
    expect(bookRequest.parse({ slotId: id, topic: 'doubt' }).note).toBe('');
    expect(bookRequest.parse({ slotId: id, topic: 'doubt', note: '  hi  ' }).note).toBe('hi');
    const bad = (over: Record<string, unknown>): boolean =>
      bookRequest.safeParse({ slotId: id, topic: 'doubt', note: '', ...over }).success;
    expect(bad({ topic: 'chat' })).toBe(false);
    expect(bad({ note: 'x'.repeat(281) })).toBe(false);
    expect(bad({ note: 'x'.repeat(280) })).toBe(true);
    expect(bad({ learnerId: id })).toBe(false); // who is booking comes from the session
    expect(bad({ slotId: 'nope' })).toBe(false);
  });
});

describe('what a phone and staff read', () => {
  test('an older phone ignores fields a newer server adds, and lists are capped', () => {
    const open = { id, mentorName: 'Meena', startsAt: '2026-11-10T05:00:00.000Z', minutes: 30 };
    expect(openSlotsResponse.parse({ slots: [{ ...open, extra: 1 }] }).slots[0]).not.toHaveProperty(
      'extra',
    );
    expect(openSlotsResponse.safeParse({ slots: Array(51).fill(open) }).success).toBe(false);
    const mine = { ...open, topic: 'resume', link: null, status: 'booked' };
    expect(myBookingsResponse.safeParse({ bookings: [mine] }).success).toBe(true);
    const staff = { id, startsAt: open.startsAt, minutes: 30, link: null, booking: null };
    expect(staffSlotsResponse.safeParse({ slots: [staff] }).success).toBe(true);
  });

  test('the new error codes exist', () => {
    for (const code of ['SLOT_TAKEN', 'BOOKING_LIMIT', 'TOO_LATE']) {
      expect(API_ERRORS).toContain(code);
    }
  });
});
