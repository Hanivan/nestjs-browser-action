export interface PoolOptions {
  min?: number;
  max?: number;
  idleTimeoutMs?: number;
  strategy?: 'round-robin' | 'least-recently-used';
}
