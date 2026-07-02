import { Inject } from '@nestjs/common';
import { getPageToken } from '../common/tokens';

/**
 * Injects the named `Page` instance registered by
 * `BrowserActionModule.forFeature([page], name)`.
 */
export const InjectPage = (
  page: string,
  name = 'default',
): ReturnType<typeof Inject> => Inject(getPageToken(page, name));
