import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const USER_AGENT = 'raw-fpl-data/1.0';

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

export async function fetchJson(url: string): Promise<unknown> {
  const maxAttempts = 5;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${url}`);
      }
      return await res.json();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        await sleep(Math.min(30_000, 500 * 2 ** attempt));
      }
    }
  }
  throw lastErr;
}

export async function saveJson(filepath: string, data: unknown): Promise<void> {
  await mkdir(dirname(filepath), { recursive: true });
  await writeFile(filepath, JSON.stringify(data, null, 2));
}

export async function fetchAndSave(
  url: string,
  filepath: string,
  opts: { skipIfExists?: boolean } = {},
): Promise<unknown> {
  if (opts.skipIfExists && (await fileExists(filepath))) {
    return readJson<unknown>(filepath);
  }
  const data = await fetchJson(url);
  await saveJson(filepath, data);
  return data;
}

export async function pmap<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, idx: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const idx = next++;
      if (idx >= items.length) return;
      try {
        const value = await fn(items[idx]!, idx);
        results[idx] = { status: 'fulfilled', value };
      } catch (reason) {
        results[idx] = { status: 'rejected', reason };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

export function summarise(label: string, results: PromiseSettledResult<unknown>[]): number {
  const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
  const ok = results.length - failures.length;
  console.log(`  ${label}: ${ok}/${results.length} ok`);
  for (const f of failures.slice(0, 10)) {
    const msg = f.reason instanceof Error ? f.reason.message : String(f.reason);
    console.error(`    ! ${msg}`);
  }
  if (failures.length > 10) {
    console.error(`    ! …and ${failures.length - 10} more failure(s)`);
  }
  return failures.length;
}
