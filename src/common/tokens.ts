export function getBrowserToken(name: string): string {
  return `${name}BrowserActionBrowser`;
}

export function getPageToken(page: string, name: string): string {
  return `${name}_${page}BrowserActionPage`;
}

export function getPageControllerToken(page: string, name: string): string {
  return `${name}_${page}BrowserActionPageController`;
}

export function getBrowserHolderToken(name: string): string {
  return `${getBrowserToken(name)}Holder`;
}

export function getNamedOptionsToken(name: string): string {
  return `BROWSER_ACTION_OPTIONS:${name}`;
}

/**
 * Process-level registry of claimed browser names. Two forRoot({name})
 * registrations sharing a name would silently overwrite each other's DI
 * token, leaving one browser unreachable and un-shutdown — throw loudly.
 */
const registeredBrowserNames = new Set<string>();

export function claimBrowserName(name: string): void {
  if (registeredBrowserNames.has(name)) {
    throw new Error(
      `BrowserActionModule: a browser with name "${name}" is already registered. ` +
        `Each forRoot()/forRootAsync() call must use a unique \`name\`.`,
    );
  }
  registeredBrowserNames.add(name);
}

export function releaseBrowserName(name: string): void {
  registeredBrowserNames.delete(name);
}
