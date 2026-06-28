import { IsArray, IsNotEmpty } from 'class-validator';
import { CleansingPipe } from './cleansing-pipe';

function execQueryRemover(
  pipe: { removed: string | string[]; baseUrl?: string },
  val: string,
): string {
  if (typeof val !== 'string') return val;
  const removed = Array.isArray(pipe.removed)
    ? pipe.removed
    : typeof pipe.removed === 'string'
      ? pipe.removed.split(',')
      : [];
  try {
    const url = new URL(val, pipe.baseUrl);
    removed.forEach((k) => url.searchParams.delete(k));
    return url.toString();
  } catch {
    return val;
  }
}

export class QueryRemoverPipe extends CleansingPipe<string, string> {
  readonly type = 'query-remover' as const;
  @IsArray() @IsNotEmpty() removed!: string | string[];
  baseUrl?: string;
  exec(val: string) {
    return execQueryRemover(this, val);
  }
  reverse(val: string): string {
    return val;
  }
}

export class PageQueryRemoverPipe extends CleansingPipe<string, string> {
  readonly type = 'query-remover--page' as const;
  @IsArray() @IsNotEmpty() removed!: string | string[];
  baseUrl?: string;
  exec(val: string) {
    return execQueryRemover(this, val);
  }
  reverse(val: string): string {
    return val;
  }
}

export class URLQueryRemoverPipe extends CleansingPipe<string, string> {
  readonly type = 'query-remover--url' as const;
  @IsArray() @IsNotEmpty() removed!: string | string[];
  baseUrl?: string;
  exec(val: string) {
    return execQueryRemover(this, val);
  }
  reverse(val: string): string {
    return val;
  }
}
