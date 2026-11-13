import { describe, it, expect } from 'vitest';
import { detectContentType } from '../../client/src/utils/codeDetector.js';

describe('detectContentType', () => {
  it('detects URLs accurately', () => {
    expect(detectContentType('https://beamdrop.app').type).toBe('url');
    expect(detectContentType('http://localhost:3000?room=7X9K').type).toBe('url');
  });

  it('detects JSON objects and arrays', () => {
    const jsonRes = detectContentType('{"status": "ok", "count": 42}');
    expect(jsonRes.type).toBe('code');
    expect(jsonRes.language).toBe('json');

    const arrRes = detectContentType('[1, 2, 3, "hello"]');
    expect(arrRes.type).toBe('code');
    expect(arrRes.language).toBe('json');
  });

  it('detects HTML snippets', () => {
    const htmlRes = detectContentType('<div className="p-4">Hello World</div>');
    expect(htmlRes.type).toBe('code');
    expect(htmlRes.language).toBe('html');
  });

  it('detects TypeScript / JavaScript code', () => {
    const jsCode = `
      const handleClick = () => {
        console.log("Clicked!");
      };
    `;
    const res = detectContentType(jsCode);
    expect(res.type).toBe('code');
    expect(res.language).toBe('typescript');
  });

  it('detects Python code', () => {
    const pyCode = `
      def calculate_speed(distance, time):
          return distance / time
    `;
    const res = detectContentType(pyCode);
    expect(res.type).toBe('code');
    expect(res.language).toBe('python');
  });

  it('detects SQL statements', () => {
    const sqlCode = 'SELECT id, name FROM users WHERE active = true';
    const res = detectContentType(sqlCode);
    expect(res.type).toBe('code');
    expect(res.language).toBe('sql');
  });

  it('detects Shell commands', () => {
    const bashCode = 'npm install --save-dev vitest';
    const res = detectContentType(bashCode);
    expect(res.type).toBe('code');
    expect(res.language).toBe('bash');
  });

  it('falls back to text for regular conversational strings', () => {
    expect(detectContentType('Привіт! Переглянь, будь ласка, цей документ.').type).toBe('text');
  });
});
