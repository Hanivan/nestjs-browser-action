import type {
  PatternField,
  FieldDescriptor,
  ContainerDescriptor,
  SelectorMap,
  PipeOptions,
} from '../interfaces/types';

/**
 * Result of converting evaluateWebsite-style PatternField[] into the
 * internal descriptor shapes the extraction/container operators consume.
 * Exactly one of `container` or `flat` is set, based on whether any pattern
 * has `meta.isContainer: true`.
 */
export type PatternConversionResult<T = Record<string, unknown>> =
  | {
      kind: 'container';
      descriptor: ContainerDescriptor<T>;
      pipes: PipeOptions;
    }
  | {
      kind: 'flat';
      selectors: SelectorMap;
      pipes: PipeOptions;
    };

/**
 * Converts evaluateWebsite-style patterns into either a flat selector map
 * (scrape()-compatible) or a ContainerDescriptor (scrapeContainerFields()-
 * compatible), mirroring evaluateWebsite's own container-detection rule:
 * a pattern with meta.isContainer: true switches the whole call into
 * container/list mode.
 */
export function convertPatternsToDescriptor<T = Record<string, unknown>>(
  patterns: PatternField[],
): PatternConversionResult<T> {
  const containerPattern = patterns.find((p) => p.meta?.isContainer);

  if (!containerPattern) {
    const selectors: SelectorMap = Object.fromEntries(
      patterns.map((p) => [p.key, p.patterns[0]]),
    );
    const pipes: PipeOptions = Object.fromEntries(
      patterns.filter((p) => p.pipes).map((p) => [p.key, p.pipes!]),
    );
    return { kind: 'flat', selectors, pipes };
  }

  const fieldPatterns = patterns.filter(
    (p) => !p.meta?.isContainer && !p.meta?.isPage,
  );

  const fields = Object.fromEntries(
    fieldPatterns.map((p) => [
      p.key,
      {
        selector: p.patterns[0],
        returnType:
          p.returnType === 'rawHTML'
            ? 'html'
            : p.returnType === 'html'
              ? 'html'
              : 'text',
        multiple: !!p.meta?.multiple,
        fallback: [...p.patterns.slice(1), ...(p.meta?.alterPattern ?? [])],
      } satisfies FieldDescriptor,
    ]),
  );

  const descriptor: ContainerDescriptor<T> = {
    container: containerPattern.patterns[0],
    fields: fields as Record<string & keyof T, FieldDescriptor>,
  };

  const pipes: PipeOptions = Object.fromEntries(
    fieldPatterns.filter((p) => p.pipes).map((p) => [p.key, p.pipes!]),
  );

  return { kind: 'container', descriptor, pipes };
}
