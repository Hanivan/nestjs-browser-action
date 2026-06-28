import { IsNotEmpty, IsString } from 'class-validator';
import { JSONPath } from 'jsonpath-plus';
import { CleansingPipe } from './cleansing-pipe';

export class JsonPathPipe extends CleansingPipe<string, string> {
  readonly type = 'json-path' as const;

  @IsString()
  @IsNotEmpty()
  path!: string;

  baseUrl?: string;

  exec(val: string): string {
    try {
      const json = (typeof val === 'string' ? JSON.parse(val) : val) as object;
      const result: unknown = JSONPath({ path: this.path, json });
      return String(result);
    } catch {
      return val;
    }
  }

  reverse(val: string): string {
    return val;
  }
}
