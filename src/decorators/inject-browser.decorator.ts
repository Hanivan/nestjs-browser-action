import { Inject } from '@nestjs/common';

export const InjectBrowser = () => Inject('BROWSER_INSTANCE');
