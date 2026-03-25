import { CleansingPipe } from './cleansing-pipe';
import { CleansingType } from '../enums/cleansing-type.enum';

export class ToUpperCasePipe extends CleansingPipe<string, string> {
  type = CleansingType.TO_UPPER_CASE;

  exec(value: string): string {
    if (typeof value !== 'string') {
      return value;
    }
    return value.toUpperCase();
  }
}
