import { CleansingPipe } from './cleansing-pipe';

const SUFFIX_MULTIPLIERS = {
  k: 1000,
  m: 1000000,
  b: 1000000000,
} as const;

const REVERSE_THRESHOLDS = [
  { threshold: 1000000000, suffix: 'B', divisor: 1000000000 },
  { threshold: 1000000, suffix: 'M', divisor: 1000000 },
  { threshold: 1000, suffix: 'K', divisor: 1000 },
] as const;

export class NumberNormalizePipe extends CleansingPipe<string, number> {
  readonly type = 'num-normalize' as const;

  exec(value: string): number {
    if (typeof value !== 'string') {
      return Number(value) || 0;
    }

    const normalized = value.toLowerCase().replace(/,/g, '.');
    let result = parseFloat(normalized);

    const suffix = normalized.slice(-1);
    const multiplier =
      SUFFIX_MULTIPLIERS[suffix as keyof typeof SUFFIX_MULTIPLIERS];
    if (multiplier) {
      result *= multiplier;
    }

    return Math.round(result) || 0;
  }

  reverse(value: number): string {
    const threshold = REVERSE_THRESHOLDS.find((t) => value >= t.threshold);
    return threshold
      ? `${(value / threshold.divisor).toFixed(1)}${threshold.suffix}`
      : String(value);
  }
}
