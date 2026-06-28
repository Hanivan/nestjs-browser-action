import { isXPathSelector } from './dom.util';

describe('isXPathSelector', () => {
  it.each([
    ['//div', true],
    ['//div[@class="foo"]', true],
    ['(//div)[1]', true],
    ['.//div', true],
    ['.//div[@class="foo"]', true],
    ['./@href', true],
    ['./span', true],
  ])('returns true for XPath: %s', (sel, expected) => {
    expect(isXPathSelector(sel)).toBe(expected);
  });

  it.each([
    ['div.foo', false],
    ['#id', false],
    ['input[type="text"]', false],
    ['.class-name', false],
  ])('returns false for CSS: %s', (sel, expected) => {
    expect(isXPathSelector(sel)).toBe(expected);
  });
});
