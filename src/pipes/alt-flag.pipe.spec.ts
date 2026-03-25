import { AltFlagPipe } from './alt-flag.pipe';
import { CleansingPipe } from './cleansing-pipe';
import { TrimPipe } from './trim.pipe';

describe('AltFlagPipe', () => {
  it('should execute primary pipes when result is not empty', () => {
    const pipe = new AltFlagPipe();
    pipe.primaryPipes = [new TrimPipe()];
    pipe.fallbackPipes = [];

    const trimSpy = jest.spyOn(pipe.primaryPipes[0], 'exec');
    const result = pipe.exec('  hello  ');

    expect(trimSpy).toHaveBeenCalledWith('  hello  ');
    expect(result).toBe('hello');
  });

  it('should execute fallback pipes when primary returns empty', () => {
    const primaryPipe = new (class extends CleansingPipe<string, string> {
      type = 'test' as const;
      exec() {
        return '';
      }
    })();

    const fallbackPipe = new TrimPipe();

    const pipe = new AltFlagPipe();
    pipe.primaryPipes = [primaryPipe];
    pipe.fallbackPipes = [fallbackPipe];
    pipe.fallbackOn = 'all';

    const fallbackSpy = jest.spyOn(fallbackPipe, 'exec');
    const result = pipe.exec('  hello  ');

    expect(fallbackSpy).toHaveBeenCalledWith('  hello  ');
    expect(result).toBe('hello');
  });

  it('should trigger fallback on null when fallbackOn is null', () => {
    const primaryPipe = new (class extends CleansingPipe<string, string> {
      type = 'test' as const;
      exec() {
        return null as any;
      }
    })();

    const fallbackPipe = new TrimPipe();

    const pipe = new AltFlagPipe();
    pipe.primaryPipes = [primaryPipe];
    pipe.fallbackPipes = [fallbackPipe];
    pipe.fallbackOn = 'null';

    const fallbackSpy = jest.spyOn(fallbackPipe, 'exec');
    pipe.exec('test');

    expect(fallbackSpy).toHaveBeenCalled();
  });

  it('should have type "alt-flag"', () => {
    const pipe = new AltFlagPipe();
    expect(pipe.type).toBe('alt-flag');
  });
});
