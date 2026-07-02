import { CaptureOperator } from './capture.operator';
import { LoggerWithLevel } from '../utils/logger.util';

describe('CaptureOperator', () => {
  const op = new CaptureOperator(new LoggerWithLevel('test', 'error'), 250);

  it('screenshot delegates to page.screenshot with path', async () => {
    const screenshot = jest.fn().mockResolvedValue(Buffer.from('img'));
    const page = { screenshot } as unknown as import('puppeteer-core').Page;
    await op.screenshot(page, '/tmp/s.png', { fullPage: true });
    expect(screenshot).toHaveBeenCalledWith({
      path: '/tmp/s.png',
      fullPage: true,
    });
  });
});
