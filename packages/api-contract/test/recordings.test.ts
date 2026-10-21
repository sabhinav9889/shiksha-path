import { randomUUID } from 'node:crypto';
import { describe, expect, test } from 'vitest';
import {
  MAX_RECORDING_BYTES,
  MAX_RECORDING_MS,
  RECORDING_TYPES,
  recordingComplete,
  recordingStart,
  recordingStartResponse,
} from '../src/index.js';

const start = (over: Record<string, unknown> = {}) => ({
  id: randomUUID(),
  lessonId: 'ef1-02',
  itemId: 's1',
  mime: 'audio/webm',
  bytes: 2048,
  durationMs: 3000,
  at: '2026-10-22T10:00:00.000Z',
  ...over,
});

describe('recordings', () => {
  test('the limits are 1 MB, 31 seconds and three audio types', () => {
    expect(MAX_RECORDING_BYTES).toBe(1_048_576);
    expect(MAX_RECORDING_MS).toBe(31_000);
    expect([...RECORDING_TYPES]).toEqual(['audio/webm', 'audio/ogg', 'audio/mp4']);
  });

  test('a start inside the limits is accepted', () => {
    expect(recordingStart.safeParse(start()).success).toBe(true);
    expect(recordingStart.safeParse(start({ bytes: 1_048_576, durationMs: 31_000 })).success).toBe(
      true,
    );
  });

  test.each([
    ['too many bytes', { bytes: 1_048_577 }],
    ['no bytes', { bytes: 0 }],
    ['too long', { durationMs: 31_001 }],
    ['another type', { mime: 'audio/wav' }],
    ['html', { mime: 'text/html' }],
    ['a path in the lesson id', { lessonId: '../x' }],
    ['a bad id', { id: 'not-a-uuid' }],
    ['an extra field', { learnerId: randomUUID() }],
  ])('refuses %s', (_label, over) => {
    expect(recordingStart.safeParse(start(over)).success).toBe(false);
  });

  test('complete takes only the id; start answers a URL and token, or nulls', () => {
    expect(recordingComplete.safeParse({ id: randomUUID() }).success).toBe(true);
    expect(recordingComplete.safeParse({ id: randomUUID(), bytes: 1 }).success).toBe(false);
    expect(recordingStartResponse.safeParse({ uploadUrl: null, token: null }).success).toBe(true);
    expect(
      recordingStartResponse.safeParse({ uploadUrl: 'https://x/upload', token: 't' }).success,
    ).toBe(true);
  });
});
