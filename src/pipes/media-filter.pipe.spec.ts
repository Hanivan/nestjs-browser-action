import { MediaFilterPipe } from './media-filter.pipe';

describe('MediaFilterPipe', () => {
  let pipe: MediaFilterPipe;

  beforeEach(() => {
    pipe = new MediaFilterPipe();
  });

  it('should be defined', () => {
    expect(pipe).toBeDefined();
  });

  it('should drop tokens containing data:image/gif', () => {
    const input = 'data:image/gif;base64,R0lGOD a.jpg b.png';
    expect(pipe.exec(input)).toBe('a.jpg b.png');
  });

  it('should keep all tokens when none are gif data URIs', () => {
    expect(pipe.exec('a.jpg b.png')).toBe('a.jpg b.png');
  });

  it('should return an empty string when every token is a gif data URI', () => {
    expect(pipe.exec('data:image/gif;base64,R0lGOD')).toBe('');
  });

  it('should preserve token order by default', () => {
    const input = 'data:image/gif;base64,R0lGOD b.jpg c.png';
    expect(pipe.exec(input)).toBe('b.jpg c.png');
  });

  it('should reverse the filtered tokens when reverseOrder is true', () => {
    const input = 'data:image/gif;base64,R0lGOD b.jpg c.png';
    pipe.reverseOrder = true;
    expect(pipe.exec(input)).toBe('c.png b.jpg');
  });

  it('should reverse all tokens when reverseOrder is true and none are filtered', () => {
    pipe.reverseOrder = true;
    expect(pipe.exec('a.jpg b.png c.webp')).toBe('c.webp b.png a.jpg');
  });

  it('should filter before reversing', () => {
    pipe.reverseOrder = true;
    const input = 'a.jpg data:image/gif;base64,R0lGOD b.png';
    expect(pipe.exec(input)).toBe('b.png a.jpg');
  });

  it('should treat reverseOrder false the same as absent', () => {
    const input = 'a.jpg data:image/gif;base64,R0lGOD b.png';
    pipe.reverseOrder = false;
    expect(pipe.exec(input)).toBe('a.jpg b.png');
  });

  it('should return empty string for non-string input', () => {
    expect(pipe.exec(null as unknown as string)).toBe('');
    expect(pipe.exec(undefined as unknown as string)).toBe('');
    expect(pipe.exec(123 as unknown as string)).toBe('');
    expect(pipe.exec({} as unknown as string)).toBe('');
  });

  it('should return empty string for empty input', () => {
    expect(pipe.exec('')).toBe('');
  });
});
