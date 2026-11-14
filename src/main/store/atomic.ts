import { rename, writeFile } from 'node:fs/promises'

/**
 * Writes a file so that a crash mid-write cannot leave it half-written:
 * the data goes to a sibling temp file first, then replaces the target.
 */
export async function writeFileAtomic(path: string, data: string | Buffer): Promise<void> {
  const temp = `${path}.${process.pid}.tmp`
  await writeFile(temp, data)
  await rename(temp, path)
}

/**
 * Runs async jobs one after another in the order they were queued, so two
 * saves of the same file can never interleave.
 */
export function createSerialQueue(): <T>(job: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve()
  return (job) => {
    const result = tail.then(job, job)
    tail = result.catch(() => undefined)
    return result
  }
}
