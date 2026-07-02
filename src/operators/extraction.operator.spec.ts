import { ExtractionOperator } from './extraction.operator';
import { PipeEngine } from '../pipes/pipe-engine';
import { LoggerWithLevel } from '../utils/logger.util';

describe('ExtractionOperator', () => {
  const op = new ExtractionOperator(
    new PipeEngine(),
    new LoggerWithLevel('test', 'error'),
  );

  it('parseSelector splits trailing @attr', () => {
    expect(op.parseSelector('meta[name="d"]@content')).toEqual({
      selector: 'meta[name="d"]',
      attribute: 'content',
    });
  });

  it('parseSelector leaves plain selector', () => {
    expect(op.parseSelector('.title')).toEqual({ selector: '.title' });
  });

  it('extractSingle applies pipes to scraped values', async () => {
    const evalOne = jest.fn().mockResolvedValue('  RAW  ');
    const page = { $eval: evalOne } as unknown as import('puppeteer-core').Page;
    const result = await op.extractSingle(
      page,
      'https://x.test',
      { title: '.t' },
      { title: { trim: true, toLowerCase: true } },
    );
    expect(result.title).toBe('raw');
  });
});
