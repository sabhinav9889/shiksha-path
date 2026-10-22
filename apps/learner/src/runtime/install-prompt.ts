/** The browser's "add to home screen" offer, kept until the learner asks for it. */
interface PromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

export interface InstallPrompt {
  available(): boolean;
  prompt(): Promise<'accepted' | 'dismissed'>;
  subscribe(listener: () => void): () => void;
}

export function captureInstallPrompt(target: Pick<EventTarget, 'addEventListener'>): InstallPrompt {
  let offered: PromptEvent | null = null;
  const listeners = new Set<() => void>();
  const notify = (): void => listeners.forEach((listener) => listener());
  target.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // no browser banner: the "me" screen offers it instead
    offered = event as PromptEvent;
    notify();
  });
  return {
    available: () => offered !== null,
    async prompt() {
      const event = offered;
      if (!event) return 'dismissed';
      offered = null;
      try {
        await event.prompt();
        const { outcome } = await event.userChoice;
        return outcome === 'accepted' ? 'accepted' : 'dismissed';
      } catch {
        return 'dismissed'; // the browser refused to show it: the learner can install later
      } finally {
        notify();
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** Set once by `main.ts`; tests set their own. */
export const install: { prompt: InstallPrompt | null } = { prompt: null };
