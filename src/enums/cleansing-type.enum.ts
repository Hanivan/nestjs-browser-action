/**
 * Pipe types for data cleansing transformations
 * Each type maps to a specific CleansingPipe implementation
 */
export enum CleansingType {
  TRIM = 'trim',
  TO_NUMBER = 'to-number',
  TO_LOWER_CASE = 'to-lower-case',
  TO_UPPER_CASE = 'to-upper-case',
  SANITIZE_TEXT = 'sanitize-text',
  DATE_FORMAT = 'date-format',
  REGEX_REPLACE = 'regex-replace',
  REGEX_EXTRACT = 'regex-extract',
  REMOVE_CURRENCY_SYMBOL = 'remove-currency-symbol',
  REMOVE_SPECIAL_CHARS = 'remove-special-chars',
  NORMALIZE_WHITESPACE = 'normalize-whitespace',
  REMOVE_LINE_BREAKS = 'remove-line-breaks',
  ALT_FLAG = 'alt-flag',
}
