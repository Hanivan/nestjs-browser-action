import { CleansingPipe } from './cleansing-pipe';
import { CleansingType } from '../enums/cleansing-type.enum';

export class ToUpperCasePipe extends CleansingPipe<unknown, unknown> {
  type = CleansingType.TO_UPPER_CASE;

  exec(value: unknown): unknown {
    if (typeof value !== 'string') {
      return value;
    }
    return value.toUpperCase();
  }
}
