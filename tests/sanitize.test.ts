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

describe('hardened sanitizer/detector agreement (V8)', () => {
  const agree = (html: string) => ({
    violations: findHtmlSecurityViolations(html),
    sanitized: sanitizeArticleHtml(html),
  });

  it('flags and strips http:, mailto: and other non-https hrefs', () => {
    for (const href of ['http://www.sec.gov/x', 'mailto:tips@example.com', 'ftp://x.example/y']) {
      const { violations, sanitized } = agree(`<p><a href="${href}">x</a></p>`);
      expect(
        violations.some((v) => v.includes('disallowed href scheme')),
        href
      ).toBe(true);
      expect(sanitized).not.toContain(href);
    }
  });

  it('keeps relative links and https links', () => {
    const html = '<p><a href="/article/x">in</a> <a href="https://www.sec.gov/x">out</a></p>';
    expect(findHtmlSecurityViolations(html)).toEqual([]);
    expect(sanitizeArticleHtml(html)).toBe(html);
  });

  it('flags unsafe https hrefs (credentials / IP literals)', () => {
    expect(
      findHtmlSecurityViolations('<p><a href="https://www.sec.gov@evil.example/x">x</a></p>').some(
        (v) => v.includes('unsafe https href')
      )
    ).toBe(true);
    expect(
      findHtmlSecurityViolations('<p><a href="https://10.0.0.1/x">x</a></p>').length
    ).toBeGreaterThan(0);
  });

  it('forces rel="noopener noreferrer" on target=_blank and drops bad rel tokens / targets', () => {
    const opener = agree(
      '<p><a href="https://www.sec.gov/x" target="_blank" rel="opener">x</a></p>'
    );
    expect(opener.violations.some((v) => v.includes('rel token "opener"'))).toBe(true);
    expect(opener.violations.some((v) => v.includes('requires rel="noopener noreferrer"'))).toBe(
      true
    );
    expect(opener.sanitized).toContain('rel="noopener noreferrer"');
    expect(opener.sanitized).not.toContain('rel="opener"');

    const bare = agree('<p><a href="https://www.sec.gov/x" target="_blank">x</a></p>');
    expect(bare.violations.length).toBeGreaterThan(0);
    expect(bare.sanitized).toContain('rel="noopener noreferrer"');

    const frame = agree('<p><a href="https://www.sec.gov/x" target="_top">x</a></p>');
    expect(frame.violations.some((v) => v.includes('disallowed target "_top"'))).toBe(true);
    expect(frame.sanitized).not.toContain('target');

    const reordered =
      '<p><a href="https://www.sec.gov/x" target="_blank" rel="noreferrer noopener">x</a></p>';
    expect(findHtmlSecurityViolations(reordered)).toEqual([]);
    expect(sanitizeArticleHtml(reordered)).toBe(reordered);
  });

  it('only allows the editorial class allowlist (no spoofed site badges)', () => {
    const spoof = agree('<p class="fc-score-badge">99</p><span class="fc-dateline evil">x</span>');
    expect(spoof.violations.some((v) => v.includes('class "fc-score-badge" on <p>'))).toBe(true);
    expect(spoof.violations.some((v) => v.includes('class "evil" on <span>'))).toBe(true);
    expect(spoof.sanitized).not.toContain('fc-score-badge');
    expect(spoof.sanitized).not.toContain('evil');
    expect(spoof.sanitized).toContain('class="fc-dateline"');

    const wrongTag = agree('<span class="fc-lead">x</span>');
    expect(wrongTag.violations.some((v) => v.includes('class "fc-lead" on <span>'))).toBe(true);
  });

  it('flags comments, CDATA, doctype and processing instructions', () => {
    expect(findHtmlSecurityViolations('<p>a</p><!-- hidden -->').join()).toContain('HTML comment');
    expect(findHtmlSecurityViolations('<p><![CDATA[x]]></p>').join()).toContain('CDATA');
    expect(findHtmlSecurityViolations('<!DOCTYPE html><p>a</p>').join()).toContain(
      'markup declaration'
    );
    expect(findHtmlSecurityViolations('<?xml version="1.0"?><p>a</p>').join()).toContain(
      'processing instruction'
    );
  });

  it('agrees with the sanitizer on every real body.html (no violations, no mutation)', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const walk = async (dir: string): Promise<string[]> => {
      const out: string[] = [];
      for (const e of await fs.readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) out.push(...(await walk(full)));
        else if (e.name === 'body.html') out.push(full);
      }
      return out;
    };
    for (const file of await walk(path.join(process.cwd(), 'content', 'articles'))) {
      const html = (await fs.readFile(file, 'utf-8')).trim();
      expect(findHtmlSecurityViolations(html), file).toEqual([]);
      expect(sanitizeArticleHtml(html), file).toBe(html);
    }
  });
});
