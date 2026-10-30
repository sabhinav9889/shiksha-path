-- Undo 20261030000001_slot_booking.sql.
drop table if exists public.bookings;
drop table if exists public.mentor_slots;
drop function if exists public.can_read_booking(uuid, uuid);
drop function if exists public.can_read_slot(uuid);
