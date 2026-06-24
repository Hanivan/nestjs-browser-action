import {
  validateWorkflow,
  validatePipeConfigs,
  WorkflowValidationError,
  WorkflowValidationOptions,
} from './workflow.validator';
import { WorkflowDefinition } from '../interfaces/workflow-options';

describe('validateWorkflow', () => {
  const baseWorkflow: WorkflowDefinition = {
    version: '1.0',
    actions: [{ action: 'navigate', value: 'https://example.com' }],
  };

  it('should pass a valid workflow', () => {
    expect(() => validateWorkflow(baseWorkflow)).not.toThrow();
  });

  it('should throw on unknown action type', () => {
    const workflow: WorkflowDefinition = {
      version: '1.0',
      actions: [{ action: 'hack' as any }],
    };
    expect(() => validateWorkflow(workflow)).toThrow(WorkflowValidationError);
    expect(() => validateWorkflow(workflow)).toThrow(
      'Invalid action type: hack',
    );
  });

  it('should throw on too many actions', () => {
    const workflow: WorkflowDefinition = {
      version: '1.0',
      actions: Array.from({ length: 101 }, () => ({
        action: 'wait' as const,
        value: 100,
      })),
    };
    expect(() => validateWorkflow(workflow)).toThrow(WorkflowValidationError);
    expect(() => validateWorkflow(workflow)).toThrow('Too many actions');
  });

  it('should throw on retry exceeding max', () => {
    const workflow: WorkflowDefinition = {
      version: '1.0',
      actions: [
        {
          action: 'click',
          options: { retry: 101 },
        },
      ],
    };
    expect(() => validateWorkflow(workflow)).toThrow(WorkflowValidationError);
    expect(() => validateWorkflow(workflow)).toThrow(
      'retry must be a number between 0 and 100',
    );
  });

  it('should throw on negative retry', () => {
    const workflow: WorkflowDefinition = {
      version: '1.0',
      actions: [
        {
          action: 'click',
          options: { retry: -1 },
        },
      ],
    };
    expect(() => validateWorkflow(workflow)).toThrow('retry must be a number');
  });

  it('should throw on retryDelay exceeding max', () => {
    const workflow: WorkflowDefinition = {
      version: '1.0',
      actions: [
        {
          action: 'click',
          options: { retryDelay: 300_001 },
        },
      ],
    };
    expect(() => validateWorkflow(workflow)).toThrow(
      'retryDelay must be a number between 0 and 300000ms',
    );
  });

  it('should throw on invalid navigate URL', () => {
    const workflow: WorkflowDefinition = {
      version: '1.0',
      actions: [
        {
          action: 'navigate',
          value: 'file:///etc/passwd',
        },
      ],
    };
    expect(() => validateWorkflow(workflow)).toThrow(
      'Invalid URL for navigate',
    );
  });

  it('should throw on javascript: URL', () => {
    const workflow: WorkflowDefinition = {
      version: '1.0',
      actions: [
        {
          action: 'navigate',
          value: 'javascript:alert(1)',
        },
      ],
    };
    expect(() => validateWorkflow(workflow)).toThrow(
      'Invalid URL for navigate',
    );
  });

  it('should throw on screenshot path traversal', () => {
    const workflow: WorkflowDefinition = {
      version: '1.0',
      actions: [
        {
          action: 'screenshot',
          value: '../../../etc/passwd.png',
        },
      ],
    };
    expect(() => validateWorkflow(workflow)).toThrow('Invalid screenshot path');
  });

  it('should throw on evaluate script too long', () => {
    const workflow: WorkflowDefinition = {
      version: '1.0',
      actions: [
        {
          action: 'evaluate',
          value: 'x'.repeat(50_001),
        },
      ],
    };
    expect(() => validateWorkflow(workflow)).toThrow(
      'evaluate script exceeds maximum length',
    );
  });

  it('should throw on wait value too large', () => {
    const workflow: WorkflowDefinition = {
      version: '1.0',
      actions: [
        {
          action: 'wait',
          value: 300_001,
        },
      ],
    };
    expect(() => validateWorkflow(workflow)).toThrow(
      'wait value must be a number between 0 and 300000ms',
    );
  });

  it('should throw on negative wait value', () => {
    const workflow: WorkflowDefinition = {
      version: '1.0',
      actions: [
        {
          action: 'wait',
          value: -1,
        },
      ],
    };
    expect(() => validateWorkflow(workflow)).toThrow(
      'wait value must be a number',
    );
  });

  it('should throw when cloak override is disabled', () => {
    const workflow: WorkflowDefinition = {
      version: '1.0',
      cloak: { proxy: { server: 'http://proxy.com' } },
      actions: [{ action: 'navigate', value: 'https://example.com' }],
    };
    expect(() =>
      validateWorkflow(workflow, { allowCloakOverride: false }),
    ).toThrow('Per-workflow cloak override is disabled');
  });

  it('should allow cloak override by default', () => {
    const workflow: WorkflowDefinition = {
      version: '1.0',
      cloak: { proxy: { server: 'http://proxy.com' } },
      actions: [{ action: 'navigate', value: 'https://example.com' }],
    };
    expect(() => validateWorkflow(workflow)).not.toThrow();
  });

  it('should throw on invalid error screenshot path', () => {
    const workflow: WorkflowDefinition = {
      version: '1.0',
      actions: [{ action: 'navigate', value: 'https://example.com' }],
      onError: { screenshot: true, screenshotPath: '/absolute/path.png' },
    };
    expect(() => validateWorkflow(workflow)).toThrow(
      'Invalid error screenshot path',
    );
  });

  it('should accept custom validation options', () => {
    const workflow: WorkflowDefinition = {
      version: '1.0',
      actions: Array.from({ length: 50 }, () => ({
        action: 'wait' as const,
        value: 100,
      })),
    };
    expect(() => validateWorkflow(workflow, { maxActions: 10 })).toThrow(
      'Too many actions',
    );
    expect(() => validateWorkflow(workflow, { maxActions: 100 })).not.toThrow();
  });
});

describe('validatePipeConfigs', () => {
  it('should pass valid pipe configs', () => {
    const configs = [
      { type: 'trim' },
      { type: 'regex-extract', pattern: '\\d+' },
    ];
    expect(() => validatePipeConfigs(configs)).not.toThrow();
  });

  it('should throw on dangerous regex pattern', () => {
    const configs = [{ type: 'regex-extract', pattern: '(a+)+$' }];
    expect(() => validatePipeConfigs(configs)).toThrow(
      'Potentially dangerous regex pattern rejected',
    );
  });

  it('should throw on missing type', () => {
    const configs = [{ pattern: '\\d+' }];
    expect(() => validatePipeConfigs(configs)).toThrow(
      'PipeConfig must have a string type',
    );
  });

  it('should validate nested primaryPipes', () => {
    const configs = [
      {
        type: 'alt-flag',
        primaryPipes: [{ type: 'regex-extract', pattern: '(a+)+$' }],
      },
    ];
    expect(() => validatePipeConfigs(configs)).toThrow(
      'Potentially dangerous regex pattern rejected',
    );
  });

  it('should validate nested fallbackPipes', () => {
    const configs = [
      {
        type: 'alt-flag',
        fallbackPipes: [{ type: 'regex-extract', pattern: '(a*)*$' }],
      },
    ];
    expect(() => validatePipeConfigs(configs)).toThrow(
      'Potentially dangerous regex pattern rejected',
    );
  });
});

describe('scrapeContainer action validation', () => {
  it('should pass with valid scrapeContainer action', () => {
    const workflow: WorkflowDefinition = {
      version: '1.0',
      actions: [
        {
          action: 'scrapeContainer',
          id: 'items',
          options: {
            container: '//div[@class="item"]',
            fields: {
              title: { selector: './/h2' },
              link: { selector: './/a', attribute: 'href' },
            },
          },
        },
      ],
    };
    expect(() => validateWorkflow(workflow)).not.toThrow();
  });

  it('should throw when scrapeContainer is missing options.container', () => {
    const workflow: WorkflowDefinition = {
      version: '1.0',
      actions: [
        {
          action: 'scrapeContainer',
          options: { fields: { title: { selector: './/h2' } } },
        } as any,
      ],
    };
    expect(() => validateWorkflow(workflow)).toThrow(WorkflowValidationError);
    expect(() => validateWorkflow(workflow)).toThrow('container');
  });

  it('should throw when scrapeContainer has empty fields', () => {
    const workflow: WorkflowDefinition = {
      version: '1.0',
      actions: [
        {
          action: 'scrapeContainer',
          options: { container: '//div', fields: {} },
        } as any,
      ],
    };
    expect(() => validateWorkflow(workflow)).toThrow(WorkflowValidationError);
    expect(() => validateWorkflow(workflow)).toThrow('fields');
  });

  it('should throw when a field has an empty selector', () => {
    const workflow: WorkflowDefinition = {
      version: '1.0',
      actions: [
        {
          action: 'scrapeContainer',
          options: { container: '//div', fields: { title: { selector: '' } } },
        } as any,
      ],
    };
    expect(() => validateWorkflow(workflow)).toThrow(WorkflowValidationError);
    expect(() => validateWorkflow(workflow)).toThrow('selector');
  });
});

describe('extractPagination action validation', () => {
  it('should pass with valid extractPagination action', () => {
    const workflow: WorkflowDefinition = {
      version: '1.0',
      actions: [
        {
          action: 'extractPagination',
          id: 'pages',
          options: {
            container: '//ul[@class="pager"]',
            linkSelector: './/a',
            labelSelector: './/a',
            currentPage: 1,
          },
        },
      ],
    };
    expect(() => validateWorkflow(workflow)).not.toThrow();
  });

  it('should throw when extractPagination is missing options.container', () => {
    const workflow: WorkflowDefinition = {
      version: '1.0',
      actions: [
        {
          action: 'extractPagination',
          options: { linkSelector: './/a', labelSelector: './/a' },
        } as any,
      ],
    };
    expect(() => validateWorkflow(workflow)).toThrow(WorkflowValidationError);
    expect(() => validateWorkflow(workflow)).toThrow('container');
  });

  it('should throw when extractPagination is missing linkSelector', () => {
    const workflow: WorkflowDefinition = {
      version: '1.0',
      actions: [
        {
          action: 'extractPagination',
          options: { container: '//ul', labelSelector: './/a' },
        } as any,
      ],
    };
    expect(() => validateWorkflow(workflow)).toThrow(WorkflowValidationError);
    expect(() => validateWorkflow(workflow)).toThrow('linkSelector');
  });
});
