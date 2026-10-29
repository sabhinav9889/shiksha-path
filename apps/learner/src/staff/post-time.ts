const pad = (n: number): string => String(n).padStart(2, '0');

/** A `datetime-local` value (the staff member's own clock) as an ISO time, in UTC. */
export const fromLocalInput = (value: string): string => new Date(value).toISOString();

/** An ISO time as a `datetime-local` value, on the staff member's own clock. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return `${day}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
