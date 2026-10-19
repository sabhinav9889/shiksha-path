/** A playable URL for a recording held in memory; call `revoke` when done with it. */
export function recordingObjectUrl(recording: { mime: string; bytes: Uint8Array }): {
  url: string;
  revoke(): void;
} {
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(recording.bytes)], { type: recording.mime }),
  );
  return { url, revoke: () => URL.revokeObjectURL(url) };
}
