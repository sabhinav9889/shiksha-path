import { describe, expect, test } from 'vitest';
import { DOWNLOAD_CHUNK_BYTES, downloadFile, sha256Hex, type FileSpec } from '../src/download.js';
import type { CoreError } from '../src/errors.js';
import { MemoryPartialStore } from '../src/testing/memory-partials.js';
import { scriptedFetcher } from '../src/testing/scripted-fetcher.js';

const URL = 'https://cdn.example/audio/a.mp3';
const SIZE = 600_000;
const bytesOf = (size: number): Uint8Array => Uint8Array.from({ length: size }, (_, i) => i % 251);

async function specFor(data: Uint8Array): Promise<FileSpec> {
  return { url: URL, sha256: await sha256Hex(data), bytes: data.length };
}

const codeOf = async (promise: Promise<unknown>): Promise<string | undefined> =>
  promise.then(
    () => undefined,
    (error: CoreError) => error.code,
  );

describe('sha256Hex', () => {
  test('matches the known digest of "abc"', async () => {
    expect(await sha256Hex(new TextEncoder().encode('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});

describe('downloadFile', () => {
  test('fetches a file in 256 KiB ranges, returns exact bytes and leaves no partial', async () => {
    const data = bytesOf(SIZE);
    const fetcher = scriptedFetcher({ [URL]: data });
    const partials = new MemoryPartialStore();
    const out = await downloadFile(await specFor(data), { fetcher, partials });
    expect(out).toEqual(data);
    expect(DOWNLOAD_CHUNK_BYTES).toBe(262_144);
    expect(fetcher.requests.map((r) => r.range)).toEqual([
      { from: 0, to: 262_143 },
      { from: 262_144, to: 524_287 },
      { from: 524_288, to: 599_999 },
    ]);
    expect(await partials.get((await specFor(data)).sha256)).toBeNull();
  });

  test('resumes from the saved partial after a failure', async () => {
    const data = bytesOf(SIZE);
    const spec = await specFor(data);
    const partials = new MemoryPartialStore();
    const flaky = scriptedFetcher({ [URL]: data }, { failOnRequest: 2 });
    expect(await codeOf(downloadFile(spec, { fetcher: flaky, partials }))).toBe('DOWNLOAD_FAILED');
    expect((await partials.get(spec.sha256))?.length).toBe(262_144);
    const fetcher = scriptedFetcher({ [URL]: data });
    expect(await downloadFile(spec, { fetcher, partials })).toEqual(data);
    expect(fetcher.requests.map((r) => r.range)).toEqual([
      { from: 262_144, to: 524_287 },
      { from: 524_288, to: 599_999 },
    ]);
  });

  test('accepts a full 200 body when the server ignores Range', async () => {
    const data = bytesOf(1000);
    const fetcher = scriptedFetcher({ [URL]: data }, { ignoreRange: true });
    const out = await downloadFile(await specFor(data), {
      fetcher,
      partials: new MemoryPartialStore(),
    });
    expect(out).toEqual(data);
    expect(fetcher.requests).toHaveLength(1);
  });

  test('a 200 shorter than expected is DOWNLOAD_FAILED and keeps no partial', async () => {
    const data = bytesOf(1000);
    const spec = { ...(await specFor(data)), bytes: 2000 };
    const partials = new MemoryPartialStore();
    const fetcher = scriptedFetcher({ [URL]: data }, { ignoreRange: true });
    expect(await codeOf(downloadFile(spec, { fetcher, partials }))).toBe('DOWNLOAD_FAILED');
    expect(await partials.get(spec.sha256)).toBeNull();
  });

  test('a 200 longer than expected is BUNDLE_TOO_LARGE', async () => {
    const data = bytesOf(1000);
    const fetcher = scriptedFetcher({ [URL]: data }, { ignoreRange: true, extraBytes: 5 });
    const code = await codeOf(
      downloadFile(await specFor(data), { fetcher, partials: new MemoryPartialStore() }),
    );
    expect(code).toBe('BUNDLE_TOO_LARGE');
  });

  test('corrupted bytes are BUNDLE_CORRUPT, the partial is deleted and the retry starts at 0', async () => {
    const data = bytesOf(1000);
    const spec = await specFor(data);
    const partials = new MemoryPartialStore();
    const bad = scriptedFetcher({ [URL]: data }, { corrupt: true });
    expect(await codeOf(downloadFile(spec, { fetcher: bad, partials }))).toBe('BUNDLE_CORRUPT');
    expect(await partials.get(spec.sha256)).toBeNull();
    const good = scriptedFetcher({ [URL]: data });
    await downloadFile(spec, { fetcher: good, partials });
    expect(good.requests[0]?.range?.from).toBe(0);
  });

  test('a 206 with more bytes than requested is BUNDLE_TOO_LARGE and drops the partial', async () => {
    const data = bytesOf(1000);
    const spec = await specFor(data);
    const partials = new MemoryPartialStore();
    const fetcher = scriptedFetcher({ [URL]: data }, { extraBytes: 3 });
    expect(await codeOf(downloadFile(spec, { fetcher, partials }))).toBe('BUNDLE_TOO_LARGE');
    expect(await partials.get(spec.sha256)).toBeNull();
  });

  test('a server that only returns empty chunks fails instead of looping', async () => {
    const data = bytesOf(1000);
    const fetcher = scriptedFetcher({ [URL]: data }, { emptyChunks: true });
    const code = await codeOf(
      downloadFile(await specFor(data), { fetcher, partials: new MemoryPartialStore() }),
    );
    expect(code).toBe('DOWNLOAD_FAILED');
    expect(fetcher.requests).toHaveLength(1);
  });

  test('a stale partial longer than the file is discarded and the download restarts', async () => {
    const data = bytesOf(1000);
    const spec = await specFor(data);
    const partials = new MemoryPartialStore();
    await partials.put(spec.sha256, bytesOf(5000));
    const fetcher = scriptedFetcher({ [URL]: data });
    expect(await downloadFile(spec, { fetcher, partials })).toEqual(data);
    expect(fetcher.requests[0]?.range?.from).toBe(0);
  });

  test('an unexpected status is DOWNLOAD_FAILED', async () => {
    const data = bytesOf(10);
    const fetcher = scriptedFetcher({}); // url unknown: the fake answers 404
    const code = await codeOf(
      downloadFile(await specFor(data), { fetcher, partials: new MemoryPartialStore() }),
    );
    expect(code).toBe('DOWNLOAD_FAILED');
  });

  test('a zero-byte file with the empty-input hash succeeds', async () => {
    const empty = new Uint8Array();
    const fetcher = scriptedFetcher({ [URL]: empty });
    const out = await downloadFile(await specFor(empty), {
      fetcher,
      partials: new MemoryPartialStore(),
    });
    expect(out).toEqual(empty);
  });
});
