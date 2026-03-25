import { CleansingPipe } from './cleansing-pipe';
import { CleansingType } from '../enums/cleansing-type.enum';

export class ToLowerCasePipe extends CleansingPipe<string, string> {
  type = CleansingType.TO_LOWER_CASE;

  exec(value: string): string {
    if (typeof value !== 'string') {
      return value;
    }
    return value.toLowerCase();
  }
}
