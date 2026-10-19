type PersistApi = Pick<StorageManager, 'persist'> | undefined;

/** Ask the browser not to clear our data under storage pressure (spec §11). */
export async function requestPersistence(
  api: PersistApi = typeof navigator === 'undefined' ? undefined : navigator.storage,
): Promise<boolean> {
  try {
    return (await api?.persist()) === true;
  } catch {
    return false;
  }
}
