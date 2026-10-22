import { describe, expect, test } from 'vitest';
import { onUnmeteredNetwork } from './network.js';

const nav = (connection: unknown): Navigator => ({ connection }) as unknown as Navigator;

describe('onUnmeteredNetwork', () => {
  test.each([
    ['wifi', true],
    ['ethernet', true],
    ['cellular', false],
    ['none', false],
    ['unknown', false],
  ])('a %s connection: %s', (type, expected) => {
    expect(onUnmeteredNetwork(nav({ type }))).toBe(expected);
  });

  test('a browser without the connection API never counts as Wi-Fi', () => {
    expect(onUnmeteredNetwork(nav(undefined))).toBe(false);
  });
});
