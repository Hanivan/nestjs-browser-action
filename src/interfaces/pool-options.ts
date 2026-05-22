export interface PoolOptions {
  min?: number;
  max?: number;
  /**
   * Close idle available browsers after this many ms, down to `min`.
   * Set to 0 to disable idle eviction.
   * @default 30000
   */
  idleTimeoutMs?: number;
  /**
   * Reject `acquire()` if no browser becomes available within this many ms.
   * Set to 0 to wait indefinitely.
   * @default 30000
   */
  acquireTimeoutMs?: number;
  strategy?: 'round-robin' | 'least-recently-used';
}
