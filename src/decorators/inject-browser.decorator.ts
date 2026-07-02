import { Inject } from '@nestjs/common';
import { getBrowserToken } from '../common/tokens';

/**
 * Injects the named `Browser` instance registered by
 * `BrowserActionModule.forRoot({ name })`.
 */
export const InjectBrowser = (name = 'default'): ReturnType<typeof Inject> =>
  Inject(getBrowserToken(name));
