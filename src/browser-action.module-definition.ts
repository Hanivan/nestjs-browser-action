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

  /**
   * Presence of this field switches `forRootAsync()` into named-browser mode
   * (see `BrowserActionOptions.name`). Must be known synchronously at
   * registration time — before the async `useFactory` resolves — because
   * browser-name uniqueness is claimed eagerly to fail fast on duplicates.
   */
  name?: string;
}
