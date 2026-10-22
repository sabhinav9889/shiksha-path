/**
 * Raised when a sign-in replaced or added a profile on this phone (a code adopted a learner, a
 * restore finished). The picker reloads its list and closes any open create or restore view, even
 * when it is already the current route.
 */
export const profilesChanged = $state({ count: 0 });

export function announceProfilesChanged(): void {
  profilesChanged.count += 1;
}
