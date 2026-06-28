import { RemoveCurrencySymbolPipe } from './remove-currency-symbol.pipe';

describe('RemoveCurrencySymbolPipe', () => {
  let pipe: RemoveCurrencySymbolPipe;

  beforeEach(() => {
    pipe = new RemoveCurrencySymbolPipe();
  });

  it('should be defined', () => {
    expect(pipe).toBeDefined();
  });

  it('should remove currency symbols', () => {
    const input = '$100, €200, £300, ¥400';
    const expected = '100, 200, 300, 400';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should handle USD dollar sign', () => {
    const input = 'Price: $50.99';
    const expected = 'Price: 50.99';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should handle Euro symbol', () => {
    const input = 'Cost: €75.50';
    const expected = 'Cost: 75.50';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should handle British Pound', () => {
    const input = 'Value: £100';
    const expected = 'Value: 100';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should handle Japanese Yen', () => {
    const input = 'Price: ¥5000';
    const expected = 'Price: 5000';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should handle Chinese Yuan', () => {
    const input = 'Cost: ¥100.00';
    const expected = 'Cost: 100.00';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should handle all currency symbols at once', () => {
    const input = '$100, €200, £300, ¥400, ₩500, ₹600, ₽700';
    const expected = '100, 200, 300, 400, 500, 600, 700';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should handle currency symbols with spaces', () => {
    const input = '  $ 100  € 200  £ 300  ';
    const expected = ' 100 200 300 ';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should handle no currency symbols', () => {
    const input = 'Hello World 123';
    const expected = 'Hello World 123';
    expect(pipe.exec(input)).toBe(expected);
  });

  it('should handle empty string', () => {
    const input = '';
    expect(pipe.exec(input)).toBe('');
  });

  it('should handle null input', () => {
    expect(pipe.exec(null as unknown as string)).toBeNull();
  });

  it('should handle undefined input', () => {
    expect(pipe.exec(undefined as unknown as string)).toBeUndefined();
  });

  it('should handle non-string input', () => {
    expect(pipe.exec(123 as unknown as string)).toBe(123);
    expect(pipe.exec({} as unknown as string)).toEqual({});
  });

  it('should handle currency symbols in middle of text', () => {
    const input = 'The price is$100for this item';
    const expected = 'The price is100for this item';
    expect(pipe.exec(input)).toBe(expected);
  });
});
