import { ModuleMetadata, Type } from '@nestjs/common';
import { BrowserActionOptions } from './interfaces';

export type BrowserActionModuleOptions = BrowserActionOptions;

export interface BrowserActionAsyncModuleOptions extends Pick<
  ModuleMetadata,
  'imports'
> {
  useFactory: (
    ...args: unknown[]
  ) => Promise<BrowserActionModuleOptions> | BrowserActionModuleOptions;
  inject?: Array<Type | string | symbol>;
}
