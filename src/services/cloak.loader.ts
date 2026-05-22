// CloakBrowser ships ESM-only, so this CommonJS build cannot statically import
// it. The native dynamic import (preserved by the nodenext build) is isolated
// here behind a typed function so call sites stay clean.
export const loadCloakPuppeteer = () => import('cloakbrowser/puppeteer');
