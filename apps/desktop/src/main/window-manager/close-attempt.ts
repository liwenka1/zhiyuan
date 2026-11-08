/**
 * Tracks renderer close handshakes without coupling the state machine to Electron.
 * A late completion from an older attempt must never close a newer attempt.
 */
export class CloseAttemptTracker {
  private readonly attempts = new Map<number, number>();
  private readonly pending = new Set<number>();

  begin(windowId: number): number {
    const attempt = (this.attempts.get(windowId) ?? 0) + 1;
    this.attempts.set(windowId, attempt);
    this.pending.add(windowId);
    return attempt;
  }

  isPending(windowId: number): boolean {
    return this.pending.has(windowId);
  }

  isCurrent(windowId: number, attempt: number): boolean {
    return this.pending.has(windowId) && this.attempts.get(windowId) === attempt;
  }

  complete(windowId: number, attempt: number): boolean {
    if (!this.isCurrent(windowId, attempt)) return false;
    this.pending.delete(windowId);
    return true;
  }

  cancel(windowId: number): void {
    this.pending.delete(windowId);
  }

  clear(windowId: number): void {
    this.pending.delete(windowId);
    this.attempts.delete(windowId);
  }
}
