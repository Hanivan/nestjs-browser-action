import { WorkflowOperator } from './workflow.operator';
import { ExtractionOperator } from './extraction.operator';
import { ContainerOperator } from './container.operator';
import { PipeEngine } from '../pipes/pipe-engine';
import { LoggerWithLevel } from '../utils/logger.util';
import { CleansingService } from '../services/cleansing.service';
import { CookieService } from '../services/cookie.service';
import type { Page } from 'puppeteer-core';
import type { VariableContext } from '../interfaces/workflow-options';

const logger = new LoggerWithLevel('test', 'error');
const pipeEngine = new PipeEngine();
const extraction = new ExtractionOperator(pipeEngine, logger);
const container = new ContainerOperator(extraction, pipeEngine, logger);

describe('WorkflowOperator', () => {
  const op = new WorkflowOperator(
    extraction,
    container,
    pipeEngine,
    {} as unknown as CleansingService,
    logger,
    () => ({}) as unknown as CookieService,
  );

  it('executes a wait action via the moved dispatcher', async () => {
    const context: VariableContext = {};
    const page = {} as unknown as Page;
    const started = Date.now();
    await op.executeAction(
      page,
      { action: 'wait', value: 20 } as never,
      context,
    );
    expect(Date.now() - started).toBeGreaterThanOrEqual(15);
  });
});
