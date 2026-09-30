import type { ElementHandle, Page } from 'puppeteer-core';
import type {
  ActionOffset,
  CursorConfig,
} from '../interfaces/workflow-options';
import { loadGhostCursor } from './ghost-cursor.loader';

/** Subset of ghost-cursor's GhostCursor we use (its types target `puppeteer`, not `puppeteer-core`). */
export interface CursorLike {
  click(el?: ElementHandle): Promise<void>;
  move(el: ElementHandle): Promise<void>;
  moveTo(p: { x: number; y: number }): Promise<void>;
}

// One cursor per page: movement continues from the last position across
// workflows on the same page. A recreated page is a new key → new cursor.
const cursors = new WeakMap<Page, Promise<CursorLike>>();

export function getCursor(
  page: Page,
  config: CursorConfig,
): Promise<CursorLike> {
  let cursor = cursors.get(page);
  if (!cursor) {
    cursor = createFor(page, config);
    cursors.set(page, cursor);
    // Failed creation must not be cached (e.g. module missing, then installed).
    cursor.catch(() => cursors.delete(page));
  }
  return cursor;
}

async function createFor(
  page: Page,
  config: CursorConfig,
): Promise<CursorLike> {
  const mod = await loadGhostCursor();
  const opts = typeof config === 'object' ? config : { type: 'ghost' as const };
  const gcPage = page as unknown as never;
  // Default start is (0,0) — a bot tell. Start at a random point and move the
  // real mouse there so page state and cursor agree.
  const start = await mod.getRandomPagePoint(gcPage);
  await page.mouse.move(start.x, start.y);
  const speed =
    opts.moveSpeed === undefined ? undefined : { moveSpeed: opts.moveSpeed };
  return mod.createCursor(
    gcPage,
    start,
    false,
    speed ? { move: speed, moveTo: speed, click: speed } : {},
    !!opts.debug,
  ) as unknown as CursorLike;
}

export function offsetPoint(
  box: { x: number; y: number; width: number; height: number },
  offset: ActionOffset,
): { x: number; y: number } {
  return {
    x: box.x + (offset.x === 'center' ? box.width / 2 : offset.x),
    y: box.y + (offset.y === 'center' ? box.height / 2 : offset.y),
  };
}
