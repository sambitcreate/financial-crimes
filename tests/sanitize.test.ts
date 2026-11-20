import { describe, expect, it } from 'vitest';
import {
  findHtmlSecurityViolations,
  isSafeHttpsUrl,
  sanitizeArticleHtml,
} from '../src/utils/sanitize';

describe('sanitizeArticleHtml & findHtmlSecurityViolations', () => {
  it('catches and strips attribute-quote regex bypass payload', () => {
    const payload = '<a title=">" onclick="alert(1)" href="#">Click here</a>';
    const violations = findHtmlSecurityViolations(payload);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.includes('onclick'))).toBe(true);

    const sanitized = sanitizeArticleHtml(payload);
    expect(sanitized).not.toContain('onclick');
    expect(sanitized).toContain('Click here');
  });

  it('catches and discards <script> tags', () => {
    const payload = '<p>Lead copy.</p><script>alert(1)</script>';
    const violations = findHtmlSecurityViolations(payload);
    expect(violations.some((v) => v.includes('<script>'))).toBe(true);

    const sanitized = sanitizeArticleHtml(payload);
    expect(sanitized).toBe('<p>Lead copy.</p>');
  });

  it('catches and discards <img> with onerror handler', () => {
    const payload = '<p>Text</p><img src=x onerror=alert(1)>';
    const violations = findHtmlSecurityViolations(payload);
    expect(violations.some((v) => v.includes('<img>'))).toBe(true);
    expect(violations.some((v) => v.includes('onerror'))).toBe(true);

    const sanitized = sanitizeArticleHtml(payload);
    expect(sanitized).toBe('<p>Text</p>');
  });

  it('catches and strips javascript: and data: URIs on links', () => {
    const jsPayload = '<p><a href="javascript:alert(1)">Bad link</a></p>';
    expect(findHtmlSecurityViolations(jsPayload).length).toBeGreaterThan(0);
    expect(sanitizeArticleHtml(jsPayload)).not.toContain('javascript:');

    const tabPayload = '<p><a href="  java\tscript:alert(1)">Tab link</a></p>';
    expect(findHtmlSecurityViolations(tabPayload).length).toBeGreaterThan(0);
    expect(sanitizeArticleHtml(tabPayload)).not.toContain('script:');

    const dataPayload = '<p><a href="data:text/html,<script>alert(1)</script>">Data</a></p>';
    expect(findHtmlSecurityViolations(dataPayload).length).toBeGreaterThan(0);
    expect(sanitizeArticleHtml(dataPayload)).not.toContain('data:');

    const protoRelPayload = '<p><a href="//evil.example/phish">Proto</a></p>';
    expect(findHtmlSecurityViolations(protoRelPayload).length).toBeGreaterThan(0);
    expect(sanitizeArticleHtml(protoRelPayload)).not.toContain('//evil.example');
  });

  it('catches and discards disallowed structural tags like <aside>', () => {
    const payload = '<aside><p>Sidebar injection</p></aside>';
    const violations = findHtmlSecurityViolations(payload);
    expect(violations.some((v) => v.includes('<aside>'))).toBe(true);

    const sanitized = sanitizeArticleHtml(payload);
    expect(sanitized).not.toContain('<aside');
    expect(sanitized).toBe('<p>Sidebar injection</p>');
  });

  it('passes clean broadsheet editorial HTML intact with zero violations', () => {
    const clean = [
      '<p class="fc-lead"><span class="fc-dateline">NEW YORK —</span> Regulators billed the bank <strong>$1.21 billion</strong> in civil penalties.</p>',
      '<h2>The Docket</h2>',
      '<blockquote class="fc-pullquote">“Zero executives were charged.”</blockquote>',
      '<p>See <a href="https://home.treasury.gov/news/press-releases/sb0657" title="Treasury Release" rel="noopener noreferrer" target="_blank">Treasury Release sb0657</a>.</p>',
    ].join('\n');

    expect(findHtmlSecurityViolations(clean)).toEqual([]);
    expect(sanitizeArticleHtml(clean)).toBe(clean);
  });
});

describe('isSafeHttpsUrl', () => {
  it('accepts valid https:// URLs', () => {
    expect(isSafeHttpsUrl('https://www.sec.gov/litigation')).toBe(true);
    expect(isSafeHttpsUrl('https://commons.wikimedia.org/wiki/File:Do_Kwon.png')).toBe(true);
  });

  it('rejects non-https, script, data, protocol-relative, and malformed URLs', () => {
    expect(isSafeHttpsUrl('http://www.sec.gov/litigation')).toBe(false);
    expect(isSafeHttpsUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeHttpsUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isSafeHttpsUrl('//commons.wikimedia.org/wiki/File:Do_Kwon.png')).toBe(false);
    expect(isSafeHttpsUrl('')).toBe(false);
    expect(isSafeHttpsUrl('not-a-url')).toBe(false);
  });
});
