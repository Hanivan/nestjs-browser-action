# Screenshots & PDFs

Capture screenshots and generate PDFs of web pages.

## takeScreenshot()

Capture a screenshot of a web page and save it to a file.

### Signature

```typescript
async takeScreenshot(
  url: string,
  path: string,
  options?: ScreenshotOptions,
): Promise<Buffer>
```

### Parameters

#### `url: string`
The URL of the web page to capture.

#### `path: string`
File path where the screenshot will be saved.

#### `options?: ScreenshotOptions`
Puppeteer screenshot options.

```typescript
interface ScreenshotOptions {
  type?: 'png' | 'jpeg' | 'webp';
  quality?: number;           // 0-100 (jpeg/webp only)
  fullPage?: boolean;          // Capture full scrollable page
  clip?: {                    // Clip to specific region
    x: number;
    y: number;
    width: number;
    height: number;
  };
  omitBackground?: boolean;   // Hide default white background
}
```

### Return Type

```typescript
Promise<Buffer>
```

Returns the screenshot image as a Buffer.

### Examples

#### Basic Screenshot

```typescript
import { BrowserActionService } from '@hanivanrizky/nestjs-browser-action';

@Injectable()
export class MyService {
  constructor(
    private readonly actionHelpers: BrowserActionService,
  ) {}

  async capturePage() {
    const buffer = await this.actionHelpers.takeScreenshot(
      'https://example.com',
      './screenshot.png'
    );

    console.log('Screenshot saved:', buffer.length, 'bytes');
  }
}
```

#### Full Page Screenshot

```typescript
const buffer = await this.actionHelpers.takeScreenshot(
  'https://example.com/long-page',
  './full-page.png',
  { fullPage: true }  // Capture entire scrollable page
);
```

#### High Quality JPEG

```typescript
const buffer = await this.actionHelpers.takeScreenshot(
  'https://example.com',
  './screenshot.jpg',
  {
    type: 'jpeg',
    quality: 95,  // 0-100, higher is better
  }
);
```

#### Clipped Screenshot

```typescript
const buffer = await this.actionHelpers.takeScreenshot(
  'https://example.com',
  './clipped.png',
  {
    clip: {
      x: 100,
      y: 100,
      width: 800,
      height: 600,
    },
  }
);
```

#### Transparent Background

```typescript
const buffer = await this.actionHelpers.takeScreenshot(
  'https://example.com',
  './transparent.png',
  {
    omitBackground: true,  // Hide default white background
  }
);
```

## generatePDF()

Generate a PDF of a web page and save it to a file.

### Signature

```typescript
async generatePDF(
  url: string,
  path: string,
  options?: PDFOptions,
): Promise<Buffer>
```

### Parameters

#### `url: string`
The URL of the web page to convert to PDF.

#### `path: string`
File path where the PDF will be saved.

#### `options?: PDFOptions`
Puppeteer PDF generation options.

```typescript
interface PDFOptions {
  scale?: number;               // 0.1 to 2.0 (default: 1.0)
  displayHeaderFooter?: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  printBackground?: boolean;
  landscape?: boolean;
  pageRanges?: string;         // e.g., '1-5, 8, 11-13'
  format?: 'Letter' | 'Legal' | 'Tabloid' | 'Ledger' | 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6';
  width?: string | number;      // e.g., '10in', '100mm'
  height?: string | number;     // e.g., '10in', '100mm'
  margin?: {
    top?: string | number;
    right?: string | number;
    bottom?: string | number;
    left?: string | number;
  };
}
```

### Return Type

```typescript
Promise<Buffer>
```

Returns the PDF file as a Buffer.

### Examples

#### Basic PDF Generation

```typescript
import { BrowserActionService } from '@hanivanrizky/nestjs-browser-action';

@Injectable()
export class MyService {
  constructor(
    private readonly actionHelpers: BrowserActionService,
  ) {}

  async generatePDFFromURL() {
    const buffer = await this.actionHelpers.generatePDF(
      'https://example.com/article',
      './article.pdf'
    );

    console.log('PDF generated:', buffer.length, 'bytes');
  }
}
```

#### A4 Format with Margins

```typescript
const buffer = await this.actionHelpers.generatePDF(
  'https://example.com/article',
  './article.pdf',
  {
    format: 'A4',
    margin: {
      top: '20mm',
      right: '20mm',
      bottom: '20mm',
      left: '20mm',
    },
  }
);
```

#### Landscape PDF

```typescript
const buffer = await this.actionHelpers.generatePDF(
  'https://example.com/wide-table',
  './table.pdf',
  {
    landscape: true,
    format: 'A3',
  }
);
```

#### With Header and Footer

```typescript
const buffer = await this.actionHelpers.generatePDF(
  'https://example.com/document',
  './doc.pdf',
  {
    displayHeaderFooter: true,
    headerTemplate: `
      <div style="font-size: 10px; text-align: center; width: 100%;">
        Page <span class="pageNumber"></span> of <span class="totalPages"></span>
      </div>
    `,
    footerTemplate: `
      <div style="font-size: 10px; text-align: center; width: 100%;">
        Generated on ${new Date().toLocaleString()}
      </div>
    `,
  }
);
```

#### Specific Page Range

```typescript
const buffer = await this.actionHelpers.generatePDF(
  'https://example.com/long-document',
  './pages-1-5.pdf',
  {
    pageRanges: '1-5',  // Only pages 1-5
  }
);
```

#### Custom Page Size

```typescript
const buffer = await this.actionHelpers.generatePDF(
  'https://example.com',
  './custom.pdf',
  {
    width: '8.5in',   // Letter width
    height: '11in',   // Letter height
    margin: {
      top: '0.5in',
      bottom: '0.5in',
      left: '0.5in',
      right: '0.5in',
    },
  }
);
```

#### Print Background Graphics

```typescript
const buffer = await this.actionHelpers.generatePDF(
  'https://example.com/colored-charts',
  './charts.pdf',
  {
    printBackground: true,  // Include background graphics
  }
);
```

## Workflow Integration

Both methods can be used in workflows:

```typescript
const workflow = {
  version: '1.0' as const,
  actions: [
    {
      action: 'navigate' as const,
      value: 'https://example.com',
    },
    {
      action: 'waitFor' as const,
      target: { type: 'css' as const, value: '.content' },
    },
    {
      action: 'screenshot' as const,
      value: './screenshot.png',
    },
  ],
};

await this.actionHelpers.scrapeWithWorkflow(workflow);
```

## Error Handling

Both methods throw errors on failure:

```typescript
try {
  await this.actionHelpers.takeScreenshot(
    'https://example.com',
    './screenshot.png'
  );
} catch (error) {
  console.error('Screenshot failed:', error.message);
}

try {
  await this.actionHelpers.generatePDF(
    'https://example.com',
    './document.pdf'
  );
} catch (error) {
  console.error('PDF generation failed:', error.message);
}
```

## File System

Ensure the target directory exists:

```typescript
import * as fs from 'fs';
import * as path from 'path';

const outputDir = './screenshots';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const filename = path.join(outputDir, 'screenshot.png');
await this.actionHelpers.takeScreenshot(url, filename);
```

## Best Practices

### Screenshots

1. **Use descriptive filenames:**
   ```typescript
   `screenshot-${Date.now()}.png`
   `homepage-${new Date().toISOString().split('T')[0]}.png`
   ```

2. **Choose appropriate format:**
   - PNG: Lossless, supports transparency (default)
   - JPEG: Smaller file size, no transparency
   - WebP: Modern format, good compression

3. **Set quality for JPEG/WebP:**
   ```typescript
   { type: 'jpeg', quality: 90 }  // 90 is a good balance
   ```

### PDFs

1. **Use standard paper sizes:**
   ```typescript
   { format: 'A4' }  // Most common
   ```

2. **Set appropriate margins:**
   ```typescript
   { margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' } }
   ```

3. **Consider print background for accurate rendering:**
   ```typescript
   { printBackground: true }
   ```

## Related Methods

- [`scrape()`](./scrape.md) - Scraping with screenshots in workflow
- [`scrapeWithWorkflow()`](./workflow.md) - Full workflow support
- [Browser Control](./browser-control.md) - Direct page manipulation

## See Also

- [Puppeteer Screenshot Docs](https://pptr.dev/#?product=Puppeteer&version=v22.0.0&show=api-page-screenshot)
- [Puppeteer PDF Docs](https://pptr.dev/#?product=Puppeteer&version=v22.0.0&show=api-page-pdf)
