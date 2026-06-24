import UserAgent from 'user-agents';

const generator = new UserAgent({ deviceCategory: 'desktop' });

export function getRandomUserAgent(): string {
  return generator.random().toString();
}
