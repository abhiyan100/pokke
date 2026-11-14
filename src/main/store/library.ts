import { EventEmitter } from 'node:events'
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isPocketId } from '@shared/pockets'
import type { SnipRecord } from '@shared/types'
import { createSerialQueue, writeFileAtomic } from './atomic'

interface LibraryEvents {
  changed: []
}

/**
 * The snip library on disk: one JSON index plus an image and a thumbnail per
 * snip. Everything is kept in memory and the index is rewritten on change.
 */
export class Library extends EventEmitter<LibraryEvents> {
  private records: SnipRecord[] = []
  private readonly enqueue = createSerialQueue()

  constructor(private readonly dir: string) {
    super()
  }

  private get indexPath(): string {
    return join(this.dir, 'index.json')
  }

  imagePath(id: string): string {
    return join(this.dir, 'images', `${id}.png`)
  }

  thumbPath(id: string): string {
    return join(this.dir, 'thumbs', `${id}.jpg`)
  }

  async open(): Promise<void> {
    await mkdir(join(this.dir, 'images'), { recursive: true })
    await mkdir(join(this.dir, 'thumbs'), { recursive: true })
    const index = await this.readIndex()
    this.records = index.records
    if (index.intact) await this.removeOrphans()
  }

  /**
   * Deletes image files no snip refers to, left by a delete that could not
   * finish. Skipped unless the index was read intact, so a missing or damaged
   * index can never lead to images being thrown away.
   */
  private async removeOrphans(): Promise<void> {
    const known = new Set(this.records.map((record) => record.id))
    for (const folder of ['images', 'thumbs']) {
      const names = await readdir(join(this.dir, folder)).catch(() => [] as string[])
      await Promise.all(
        names
          .filter((name) => !known.has(name.replace(/\.[^.]+$/, '')))
          .map((name) => rm(join(this.dir, folder, name), { force: true }))
      )
    }
  }

  /** Newest first. */
  list(): SnipRecord[] {
    return [...this.records].sort((a, b) => b.createdAt - a.createdAt)
  }

  get(id: string): SnipRecord | undefined {
    return this.records.find((record) => record.id === id)
  }

  async add(record: SnipRecord, image: Buffer, thumb: Buffer): Promise<void> {
    await Promise.all([
      writeFile(this.imagePath(record.id), image),
      writeFile(this.thumbPath(record.id), thumb)
    ])
    try {
      await this.commit((records) => [...records, record])
    } catch (error) {
      // The snip never made it into the index, so its files must not linger.
      await this.removeFiles(record.id)
      throw error
    }
  }

  /**
   * Changes one snip. `change` may be a function of the record as it is when
   * the change is applied, for decisions that must not be made against a
   * stale copy. Returns the updated record, or undefined when the snip is gone.
   */
  async update(id: string, change: SnipChange): Promise<SnipRecord | undefined> {
    let updated: SnipRecord | undefined
    await this.commit((records) => {
      const index = records.findIndex((record) => record.id === id)
      const current = records[index]
      if (!current) return records
      updated = { ...current, ...(typeof change === 'function' ? change(current) : change), id: current.id }
      return records.with(index, updated)
    })
    return updated
  }

  /** Removes a snip and its files. Safe to repeat: a retry finishes whatever an earlier attempt could not. */
  async remove(id: string): Promise<void> {
    await this.commit((records) => (records.some((record) => record.id === id) ? records.filter((record) => record.id !== id) : records))
    await this.removeFiles(id)
  }

  private async removeFiles(id: string): Promise<void> {
    await Promise.all([rm(this.imagePath(id), { force: true }), rm(this.thumbPath(id), { force: true })])
  }

  /**
   * Applies one change to the list. Changes run one at a time, and the list in
   * memory only moves on once the index file has been written, so memory and
   * disk cannot disagree and a failed write can simply be tried again.
   */
  private commit(change: (records: SnipRecord[]) => SnipRecord[]): Promise<void> {
    return this.enqueue(async () => {
      const next = change(this.records)
      if (next === this.records) return
      await writeFileAtomic(this.indexPath, JSON.stringify(next, null, 2))
      this.records = next
      this.emit('changed')
    })
  }

  private async readIndex(): Promise<{ records: SnipRecord[]; intact: boolean }> {
    let text: string
    try {
      text = await readFile(this.indexPath, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { records: [], intact: false }
      throw error
    }
    try {
      const parsed: unknown = JSON.parse(text)
      if (!Array.isArray(parsed)) throw new Error('index is not a list')
      return { records: parsed.filter(isUsableRecord).map(recoverInterrupted), intact: true }
    } catch {
      // Keep the unreadable file for the user rather than overwriting it.
      await rename(this.indexPath, `${this.indexPath}.unreadable-${Date.now()}`)
      return { records: [], intact: false }
    }
  }
}

/** A change to a snip: new values, or a function that works them out from the current record. */
export type SnipChange = Partial<SnipRecord> | ((current: SnipRecord) => Partial<SnipRecord>)

function isUsableRecord(value: unknown): value is SnipRecord {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Partial<SnipRecord>
  return (
    typeof record.id === 'string' &&
    typeof record.createdAt === 'number' &&
    isPocketId(record.pocket) &&
    Array.isArray(record.tags)
  )
}

/** A snip that was mid-analysis when the app quit goes back to waiting. */
function recoverInterrupted(record: SnipRecord): SnipRecord {
  return record.status === 'analyzing' ? { ...record, status: 'waiting' } : record
}
