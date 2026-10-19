import { describe, expect, test, vi } from 'vitest';
import { captureInstallPrompt } from './install-prompt.js';

function promptEvent(outcome: 'accepted' | 'dismissed') {
  const event = new Event('beforeinstallprompt') as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: string }>;
  };
  event.prompt = vi.fn(() => Promise.resolve());
  event.userChoice = Promise.resolve({ outcome });
  return event;
}

describe('captureInstallPrompt', () => {
  test('is unavailable until the browser offers it, then prompts once', async () => {
    const target = new EventTarget();
    const install = captureInstallPrompt(target);
    expect(install.available()).toBe(false);
    const event = promptEvent('accepted');
    target.dispatchEvent(event);
    expect(install.available()).toBe(true);
    expect(await install.prompt()).toBe('accepted');
    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(install.available()).toBe(false);
  });

  test('keeps the browser from showing its own banner', () => {
    const target = new EventTarget();
    captureInstallPrompt(target);
    const event = promptEvent('dismissed');
    const prevent = vi.spyOn(event, 'preventDefault');
    target.dispatchEvent(event);
    expect(prevent).toHaveBeenCalled();
  });

  test('subscribers hear when it becomes available and when it is used', async () => {
    const target = new EventTarget();
    const install = captureInstallPrompt(target);
    const heard = vi.fn();
    const stop = install.subscribe(heard);
    target.dispatchEvent(promptEvent('dismissed'));
    expect(heard).toHaveBeenCalledTimes(1);
    await install.prompt();
    expect(heard).toHaveBeenCalledTimes(2);
    stop();
    target.dispatchEvent(promptEvent('dismissed'));
    expect(heard).toHaveBeenCalledTimes(2);
  });

  test('prompting with nothing offered is a dismissal', async () => {
    expect(await captureInstallPrompt(new EventTarget()).prompt()).toBe('dismissed');
  });
});
