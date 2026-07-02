import { Inject } from '@nestjs/common';
import { getPageControllerToken } from '../common/tokens';

/**
 * Injects the `PageController` registered by
 * `BrowserActionModule.forFeature([page], name)`.
 */
export const InjectPageController = (
  page: string,
  name = 'default',
): ReturnType<typeof Inject> => Inject(getPageControllerToken(page, name));
