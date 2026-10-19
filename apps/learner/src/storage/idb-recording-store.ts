import type { ShikshaDb } from './db.js';
import { MAX_RECORDING_BYTES, type Recording, type RecordingStore } from './recording-store.js';

export class IdbRecordingStore implements RecordingStore {
  constructor(private readonly db: ShikshaDb) {}

  private same(learnerId: string, lessonId: string, itemId: string) {
    return this.db.recordings
      .where('[learnerId+lessonId+itemId]')
      .equals([learnerId, lessonId, itemId]);
  }

  async put(recording: Recording): Promise<void> {
    if (recording.bytes.length > MAX_RECORDING_BYTES) throw new Error('recording too large');
    const { learnerId, lessonId, itemId } = recording;
    await this.db.transaction('rw', this.db.recordings, async () => {
      await this.same(learnerId, lessonId, itemId).delete();
      await this.db.recordings.add(recording);
    });
  }

  async latest(learnerId: string, lessonId: string, itemId: string): Promise<Recording | null> {
    return (await this.same(learnerId, lessonId, itemId).first()) ?? null;
  }

  async summary(learnerId: string): Promise<{ count: number; bytes: number }> {
    const all = await this.db.recordings.where('learnerId').equals(learnerId).toArray();
    return { count: all.length, bytes: all.reduce((n, r) => n + r.bytes.length, 0) };
  }

  async delete(id: string): Promise<void> {
    await this.db.recordings.delete(id);
  }
}
