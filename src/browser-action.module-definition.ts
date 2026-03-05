import { ModuleMetadata } from '@nestjs/common';
import { BrowserActionOptions } from './interfaces';

export type BrowserActionModuleOptions = BrowserActionOptions;

export interface BrowserActionAsyncModuleOptions extends Pick<
  ModuleMetadata,
  'imports'
> {
  useFactory: (
    ...args: any[]
  ) => Promise<BrowserActionModuleOptions> | BrowserActionModuleOptions;
  inject?: any[];
}
