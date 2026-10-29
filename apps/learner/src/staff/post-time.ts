const IST_MINUTES = 330; // India time, +05:30: students and mentors read one clock
const MS_PER_MINUTE = 60_000;
const IST_OFFSET_MS = IST_MINUTES * MS_PER_MINUTE;
const LOCAL_INPUT_LENGTH = 'YYYY-MM-DDTHH:mm'.length;

/** A `datetime-local` value, typed as India time, as an ISO time in UTC. */
export const fromLocalInput = (value: string): string =>
  new Date(`${value}:00+05:30`).toISOString();

/** An ISO time as a `datetime-local` value on India time. */
export const toLocalInput = (iso: string): string =>
  new Date(new Date(iso).getTime() + IST_OFFSET_MS).toISOString().slice(0, LOCAL_INPUT_LENGTH);
