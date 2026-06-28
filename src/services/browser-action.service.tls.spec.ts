import { Test, TestingModule } from '@nestjs/testing';
import { promises as fs } from 'fs';
import { BrowserActionService } from './browser-action.service';
import { PageService } from './page.service';
import { CookieService } from './cookie.service';
import { CleansingService } from './cleansing.service';
import { TLS_CAPTURE_URL } from '../constants/browser-action.constants';

jest.mock('fs', () => ({
  ...jest.requireActual<typeof import('fs')>('fs'),
  promises: {
    ...jest.requireActual<typeof import('fs')>('fs').promises,
    mkdir: jest.fn().mockResolvedValue(undefined),
    writeFile: jest.fn().mockResolvedValue(undefined),
  },
}));

const SAMPLE_RESPONSE = {
  ip: '103.255.156.18:27459',
  http_version: 'h2',
  method: 'GET',
  user_agent: 'Mozilla/5.0 Firefox/151.0',
  tls: {
    ciphers: ['TLS_AES_128_GCM_SHA256', 'TLS_CHACHA20_POLY1305_SHA256'],
    extensions: [
      { name: 'server_name (0)', server_name: 'tls.peet.ws' },
      { name: 'supported_versions (43)', versions: ['TLS 1.3'] },
    ],
    ja3: '771,4865-4867,0-23,4588-29,0',
    ja3_hash: '6447ab086255d194909d4013b1a89e87',
    ja4: 't13d1617h2_86a278354501_3cbfd9057e0d',
    ja4_r: 't13d1617h2_002f,0035_0005,000a_0403,0503',
    peetprint: '772-771|2-1.1|4588-29',
    peetprint_hash: 'fd4547eeb41f073156b7bc8125a79a3c',
  },
  http2: {
    akamai_fingerprint: '1:65536;2:0;4:131072;5:16384|12517377|0|m,p,a,s',
    akamai_fingerprint_hash: '6ea73faa8fc5aac76bded7bd238f6433',
    sent_frames: [
      { frame_type: 'SETTINGS', length: 24, settings: ['ENABLE_PUSH = 0'] },
      {
        frame_type: 'HEADERS',
        stream_id: 3,
        headers: [
          ':method: GET',
          ':path: /api/all',
          'user-agent: Mozilla/5.0 Firefox/151.0',
          'accept-encoding: gzip, deflate, br, zstd',
        ],
      },
    ],
  },
};

describe('BrowserActionService.captureTlsFingerprint', () => {
  let service: BrowserActionService;
  let mockPage: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockPage = {
      goto: jest.fn(),
      evaluate: jest.fn().mockResolvedValue(JSON.stringify(SAMPLE_RESPONSE)),
      close: jest.fn(),
    } as any;

    const mockPageService = {
      closePage: jest.fn().mockResolvedValue(undefined),
      navigateTo: jest.fn().mockImplementation(async (url: string) => {
        await mockPage.goto(url);
        return mockPage;
      }),
      getLogLevel: jest.fn().mockReturnValue('log' as const),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BrowserActionService,
        { provide: PageService, useValue: mockPageService },
        { provide: CookieService, useValue: {} },
        { provide: CleansingService, useValue: {} },
      ],
    }).compile();

    service = await module.resolve<BrowserActionService>(BrowserActionService);
  });

  it('navigates to the default TLS capture URL', async () => {
    await service.captureTlsFingerprint('/tmp/tls.json');
    expect(mockPage.goto).toHaveBeenCalledWith(TLS_CAPTURE_URL);
  });

  it('accepts a custom capture URL', async () => {
    await service.captureTlsFingerprint('/tmp/tls.json', 'https://custom.test');
    expect(mockPage.goto).toHaveBeenCalledWith('https://custom.test');
  });

  it('extracts ja3, ja4, headers and other useful info', async () => {
    const result = await service.captureTlsFingerprint('/tmp/tls.json');

    expect(result.ja3).toBe(SAMPLE_RESPONSE.tls.ja3);
    expect(result.ja3Hash).toBe(SAMPLE_RESPONSE.tls.ja3_hash);
    expect(result.ja4).toBe(SAMPLE_RESPONSE.tls.ja4);
    expect(result.peetprint).toBe(SAMPLE_RESPONSE.tls.peetprint);
    expect(result.peetprintHash).toBe(SAMPLE_RESPONSE.tls.peetprint_hash);
    expect(result.userAgent).toBe(SAMPLE_RESPONSE.user_agent);
    expect(result.ip).toBe(SAMPLE_RESPONSE.ip);
    expect(result.httpVersion).toBe('h2');
    expect(result.ciphers).toEqual(SAMPLE_RESPONSE.tls.ciphers);
    expect(result.tlsExtensions).toEqual([
      'server_name (0)',
      'supported_versions (43)',
    ]);
    expect(result.akamaiFingerprint).toBe(
      SAMPLE_RESPONSE.http2.akamai_fingerprint,
    );
    expect(result.akamaiFingerprintHash).toBe(
      SAMPLE_RESPONSE.http2.akamai_fingerprint_hash,
    );
    expect(result.headers).toEqual([
      ':method: GET',
      ':path: /api/all',
      'user-agent: Mozilla/5.0 Firefox/151.0',
      'accept-encoding: gzip, deflate, br, zstd',
    ]);
  });

  it('retains the full raw response', async () => {
    const result = await service.captureTlsFingerprint('/tmp/tls.json');
    expect(result.raw).toEqual(SAMPLE_RESPONSE);
  });

  it('writes the fingerprint to the given path as JSON', async () => {
    const result = await service.captureTlsFingerprint('/tmp/out/tls.json');

    expect(fs.mkdir).toHaveBeenCalledWith('/tmp/out', { recursive: true });
    expect(fs.writeFile).toHaveBeenCalledWith(
      '/tmp/out/tls.json',
      JSON.stringify(result, null, 2),
      'utf-8',
    );
  });

  it('closes the page after capture', async () => {
    await service.captureTlsFingerprint('/tmp/tls.json');
    const closeMock = (service as any).pageService.closePage as jest.Mock;
    expect(closeMock).toHaveBeenCalled();
  });
});
