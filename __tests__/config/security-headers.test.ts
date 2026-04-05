import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');

describe('next.config.ts セキュリティヘッダー', () => {
  const configContent = fs.readFileSync(
    path.join(ROOT, 'next.config.ts'),
    'utf-8',
  );

  const requiredHeaders = [
    'X-Content-Type-Options',
    'X-Frame-Options',
    'X-XSS-Protection',
    'Referrer-Policy',
  ];

  for (const header of requiredHeaders) {
    test(`${header} が設定されている`, () => {
      expect(configContent).toContain(header);
    });
  }

  test('全4つのセキュリティヘッダーが揃っている', () => {
    const found = requiredHeaders.filter((h) => configContent.includes(h));
    expect(found).toHaveLength(4);
  });
});

describe('robots.txt のセキュリティ設定', () => {
  const robotsPath = path.join(ROOT, 'public', 'robots.txt');
  const robotsContent = fs.readFileSync(robotsPath, 'utf-8');

  const disallowedPaths = ['/admin', '/api', '/account'];

  for (const p of disallowedPaths) {
    test(`${p} が Disallow されている`, () => {
      expect(robotsContent).toContain(`Disallow: ${p}`);
    });
  }
});
