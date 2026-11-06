import type { SourceProgrammeIndex } from "@/lib/programme-source";

/** Process-local acceleration only. Authorization always runs before a lookup.
 * Entries are isolated by project and saved revision, expire after five minutes,
 * and are bounded by both count and an estimated memory budget.
 */
export class ProgrammeSourceCache {
  private entries = new Map<
    string,
    {
      revision: string;
      index: SourceProgrammeIndex;
      bytes: number;
      expires: number;
    }
  >();
  constructor(
    private maxEntries = 2,
    private maxBytes = 48 * 1024 * 1024,
    private ttlMs = 5 * 60 * 1000,
  ) {}
  get(projectId: string, revision: string, now = Date.now()) {
    const entry = this.entries.get(projectId);
    if (!entry || entry.revision !== revision || entry.expires <= now) {
      this.entries.delete(projectId);
      return undefined;
    }
    this.entries.delete(projectId);
    this.entries.set(projectId, entry);
    return entry.index;
  }
  set(
    projectId: string,
    revision: string,
    index: SourceProgrammeIndex,
    bytes: number,
    now = Date.now(),
  ) {
    this.entries.delete(projectId);
    if (bytes > this.maxBytes) return;
    this.entries.set(projectId, {
      revision,
      index,
      bytes,
      expires: now + this.ttlMs,
    });
    let used = [...this.entries.values()].reduce((sum, e) => sum + e.bytes, 0);
    while (this.entries.size > this.maxEntries || used > this.maxBytes) {
      const oldest = this.entries.keys().next().value!;
      used -= this.entries.get(oldest)!.bytes;
      this.entries.delete(oldest);
    }
  }
  invalidate(projectId: string) {
    this.entries.delete(projectId);
  }
}
export const programmeSourceCache = new ProgrammeSourceCache();
