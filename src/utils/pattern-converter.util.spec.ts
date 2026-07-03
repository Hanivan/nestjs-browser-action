import { convertPatternsToDescriptor } from './pattern-converter.util';
import type { PatternField } from '../interfaces/types';

describe('convertPatternsToDescriptor', () => {
  it('returns a flat selector map when no pattern has meta.isContainer', () => {
    const patterns: PatternField[] = [
      {
        key: 'title',
        patternType: 'css',
        returnType: 'text',
        patterns: ['h1'],
      },
      {
        key: 'price',
        patternType: 'css',
        returnType: 'text',
        patterns: ['.price'],
      },
    ];

    const result = convertPatternsToDescriptor(patterns);

    expect(result.kind).toBe('flat');
    if (result.kind !== 'flat') throw new Error('expected flat');
    expect(result.selectors).toEqual({ title: 'h1', price: '.price' });
    expect(result.pipes).toEqual({});
  });

  it('includes pipes only for patterns that declared them (flat case)', () => {
    const patterns: PatternField[] = [
      {
        key: 'title',
        patternType: 'css',
        returnType: 'text',
        patterns: ['h1'],
        pipes: { trim: true },
      },
      {
        key: 'price',
        patternType: 'css',
        returnType: 'text',
        patterns: ['.price'],
      },
    ];

    const result = convertPatternsToDescriptor(patterns);

    if (result.kind !== 'flat') throw new Error('expected flat');
    expect(result.pipes).toEqual({ title: { trim: true } });
  });

  it('returns a ContainerDescriptor when a pattern has meta.isContainer: true', () => {
    const patterns: PatternField[] = [
      {
        key: 'container',
        patternType: 'css',
        returnType: 'text',
        patterns: ['.product'],
        meta: { isContainer: true },
      },
      {
        key: 'name',
        patternType: 'css',
        returnType: 'text',
        patterns: ['h2.name'],
      },
    ];

    const result = convertPatternsToDescriptor(patterns);

    expect(result.kind).toBe('container');
    if (result.kind !== 'container') throw new Error('expected container');
    expect(result.descriptor.container).toBe('.product');
    expect(result.descriptor.fields).toEqual({
      name: {
        selector: 'h2.name',
        returnType: 'text',
        multiple: false,
        fallback: [],
      },
    });
  });

  it('excludes patterns marked meta.isPage from the container fields', () => {
    const patterns: PatternField[] = [
      {
        key: 'container',
        patternType: 'css',
        returnType: 'text',
        patterns: ['.product'],
        meta: { isContainer: true },
      },
      {
        key: 'page',
        patternType: 'css',
        returnType: 'text',
        patterns: ['.page-marker'],
        meta: { isPage: true },
      },
      {
        key: 'name',
        patternType: 'css',
        returnType: 'text',
        patterns: ['h2.name'],
      },
    ];

    const result = convertPatternsToDescriptor(patterns);

    if (result.kind !== 'container') throw new Error('expected container');
    expect(Object.keys(result.descriptor.fields)).toEqual(['name']);
  });

  it('builds fallback from remaining patterns plus meta.alterPattern (container case)', () => {
    const patterns: PatternField[] = [
      {
        key: 'container',
        patternType: 'css',
        returnType: 'text',
        patterns: ['.product'],
        meta: { isContainer: true },
      },
      {
        key: 'title',
        patternType: 'css',
        returnType: 'text',
        patterns: ['h1', 'h2', 'h3'],
        meta: { alterPattern: ['title'] },
      },
    ];

    const result = convertPatternsToDescriptor(patterns);

    if (result.kind !== 'container') throw new Error('expected container');
    expect(result.descriptor.fields.title.selector).toBe('h1');
    expect(result.descriptor.fields.title.fallback).toEqual([
      'h2',
      'h3',
      'title',
    ]);
  });

  it('maps returnType rawHTML to html (container case)', () => {
    const patterns: PatternField[] = [
      {
        key: 'container',
        patternType: 'css',
        returnType: 'text',
        patterns: ['.product'],
        meta: { isContainer: true },
      },
      {
        key: 'body',
        patternType: 'css',
        returnType: 'rawHTML',
        patterns: ['.body'],
      },
    ];

    const result = convertPatternsToDescriptor(patterns);

    if (result.kind !== 'container') throw new Error('expected container');
    expect(result.descriptor.fields.body.returnType).toBe('html');
  });

  it('sets multiple: true on the field descriptor when meta.multiple is set (container case)', () => {
    const patterns: PatternField[] = [
      {
        key: 'container',
        patternType: 'css',
        returnType: 'text',
        patterns: ['.product'],
        meta: { isContainer: true },
      },
      {
        key: 'tags',
        patternType: 'css',
        returnType: 'text',
        patterns: ['.tag'],
        meta: { multiple: true },
      },
    ];

    const result = convertPatternsToDescriptor(patterns);

    if (result.kind !== 'container') throw new Error('expected container');
    expect(result.descriptor.fields.tags.multiple).toBe(true);
  });

  it('includes pipes only for field patterns that declared them (container case)', () => {
    const patterns: PatternField[] = [
      {
        key: 'container',
        patternType: 'css',
        returnType: 'text',
        patterns: ['.product'],
        meta: { isContainer: true },
      },
      {
        key: 'price',
        patternType: 'css',
        returnType: 'text',
        patterns: ['.price'],
        pipes: { trim: true },
      },
      {
        key: 'name',
        patternType: 'css',
        returnType: 'text',
        patterns: ['h2.name'],
      },
    ];

    const result = convertPatternsToDescriptor(patterns);

    if (result.kind !== 'container') throw new Error('expected container');
    expect(result.pipes).toEqual({ price: { trim: true } });
  });
});
