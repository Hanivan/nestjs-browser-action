/**
 * DOM and XPath utility functions for browser automation
 * Reduces code duplication across scraping operations
 */

/**
 * Extract text content from an element, defaulting to empty string
 */
export function extractTextContent(el: Element | Node | null): string {
  return el?.textContent?.trim() || '';
}

/**
 * Evaluate XPath selector and return all matching text content
 * Optimized to use iterator instead of snapshot for better performance
 */
export function evaluateXPathAll(
  selector: string,
  root: Document | ShadowRoot,
): string[] {
  const results = document.evaluate(
    selector,
    root,
    null,
    XPathResult.UNORDERED_NODE_ITERATOR_TYPE,
    null,
  );

  const values: string[] = [];
  let node: Node | null;
  while ((node = results.iterateNext())) {
    values.push(extractTextContent(node));
  }
  return values;
}

/**
 * Evaluate XPath selector and return first matching element
 */
export function evaluateXPathFirst(
  selector: string,
  root: Document | ShadowRoot,
): Element | null {
  const results = document.evaluate(
    selector,
    root,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null,
  );
  return results.singleNodeValue as Element;
}

/**
 * Detect if a selector is XPath based on prefix
 */
export function isXPathSelector(selector: string): boolean {
  const trimmed = selector.trim();
  return (
    trimmed.startsWith('//') ||
    trimmed.startsWith('(') ||
    trimmed.startsWith('./')
  );
}
