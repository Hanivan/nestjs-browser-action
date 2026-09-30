import type { Page } from 'puppeteer-core';
import { getCursor, offsetPoint } from './ghost-cursor';
import { loadGhostCursor } from './ghost-cursor.loader';

jest.mock('./ghost-cursor.loader', () => ({ loadGhostCursor: jest.fn() }));

const createCursor = jest.fn(() => ({
  click: jest.fn(),
  move: jest.fn(),
  moveTo: jest.fn(),
}));
const getRandomPagePoint = jest.fn().mockResolvedValue({ x: 11, y: 22 });

function makePage(): Page {
  return {
    mouse: { move: jest.fn().mockResolvedValue(undefined) },
  } as unknown as Page;
}

beforeEach(() => {
  jest.clearAllMocks();
  (loadGhostCursor as jest.Mock).mockResolvedValue({
    createCursor,
    getRandomPagePoint,
  });
});

describe('getCursor', () => {
  it('reuses one cursor per page', async () => {
    const page = makePage();
    const a = await getCursor(page, 'ghost');
    const b = await getCursor(page, 'ghost');
    expect(a).toBe(b);
    expect(createCursor).toHaveBeenCalledTimes(1);
  });

  it('creates a new cursor for a different page', async () => {
    const a = await getCursor(makePage(), 'ghost');
    const b = await getCursor(makePage(), 'ghost');
    expect(a).not.toBe(b);
  });

  it('starts at a random point and moves the real mouse there', async () => {
    const page = makePage();
    await getCursor(page, { type: 'ghost', moveSpeed: 5, debug: true });
    expect(page.mouse.move).toHaveBeenCalledWith(11, 22);
    expect(createCursor).toHaveBeenCalledWith(
      page,
      { x: 11, y: 22 },
      false,
      {
        move: { moveSpeed: 5 },
        moveTo: { moveSpeed: 5 },
        click: { moveSpeed: 5 },
      },
      true,
    );
  });
});

describe('offsetPoint', () => {
  const box = { x: 100, y: 200, width: 300, height: 64 };
  it('numeric offsets', () =>
    expect(offsetPoint(box, { x: 30, y: 10 })).toEqual({ x: 130, y: 210 }));
  it('center offsets', () =>
    expect(offsetPoint(box, { x: 'center', y: 'center' })).toEqual({
      x: 250,
      y: 232,
    }));
  it('mixed', () =>
    expect(offsetPoint(box, { x: 30, y: 'center' })).toEqual({
      x: 130,
      y: 232,
    }));
});
