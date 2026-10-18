/** Time and id sources are ports so tests control them. */
export interface Clock {
  now(): Date;
}

export interface Ids {
  uuid(): string;
}

export const systemClock: Clock = { now: () => new Date() };

export const cryptoIds: Ids = { uuid: () => crypto.randomUUID() };
