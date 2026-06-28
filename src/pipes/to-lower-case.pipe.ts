import { CleansingPipe } from './cleansing-pipe';
import { CleansingType } from '../enums/cleansing-type.enum';

export class ToLowerCasePipe extends CleansingPipe<unknown, unknown> {
  readonly type = CleansingType.TO_LOWER_CASE as const;

  exec(value: unknown): unknown {
    if (typeof value !== 'string') {
      return value;
    }
    return value.toLowerCase();
  }
}
