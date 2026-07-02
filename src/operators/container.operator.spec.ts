import { ContainerOperator } from './container.operator';
import { ExtractionOperator } from './extraction.operator';
import { PipeEngine } from '../pipes/pipe-engine';
import { LoggerWithLevel } from '../utils/logger.util';
import type { Page } from 'puppeteer-core';
import type { ContainerDescriptor } from '../interfaces/types';

const logger = new LoggerWithLevel('test', 'error');
const pipeEngine = new PipeEngine();
const extraction = new ExtractionOperator(pipeEngine, logger, 250);

describe('ContainerOperator', () => {
  const op = new ContainerOperator(extraction, pipeEngine, logger, 250);

  it('executeContainerExtraction maps container items to fields', async () => {
    const mockItems = [{ title: 'Item 1' }, { title: 'Item 2' }];
    const page = {
      evaluate: jest.fn().mockResolvedValue(mockItems),
    } as unknown as Page;

    const descriptor: ContainerDescriptor = {
      container: '.item',
      fields: {
        title: { selector: '.title' },
      },
    };

    const result = await op.executeContainerExtraction(page, descriptor, 1);

    expect(result.items).toEqual(mockItems);
    expect(result.pagination).toBeUndefined();
  });
});
