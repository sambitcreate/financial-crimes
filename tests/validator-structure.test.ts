/**
 * Structural validator rules (FINDINGS V3–V8, V10, G2): source URLs, JPEG contract, layout,
 * future dates, editions, rollup, body prose, and the paint-refs runtime loader.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  checkPaintRefJpeg,
  findGenericHubUrlReason,
  inspectJpeg,
  isOfficialSourceHost,
} from '../scripts/validate-content.mjs';
import { readPaintRefsManifest } from '../src/painting/refs-loader';
import { isSafeHttpsUrl } from '../src/utils/sanitize';
import {
  BODY_HTML,
  EDITION_DATE,
  VALID_JPEG,
  article,
  expectError,
  makeEdition,
  makeMeta,
  makePaintRef,
  runFixture,
  setEdition,
} from './validator-fixture';

// ---------------------------------------------------------------------------
// JPEG helpers: patch fields of a real JPEG's SOF header
// ---------------------------------------------------------------------------

function sofOffset(buf: Buffer): number {
  let i = 2;
  while (i < buf.length) {
    while (buf[i] === 0xff) i++;
    const marker = buf[i++];
    const len = buf.readUInt16BE(i);
    if ([0xc0, 0xc1, 0xc2].includes(marker)) return i;
    i += len;
  }
  throw new Error('no SOF');
}

function patchJpeg(patch: { width?: number; height?: number; components?: number }): Buffer {
  const buf = Buffer.from(VALID_JPEG);
  const at = sofOffset(buf);
  if (patch.height !== undefined) buf.writeUInt16BE(patch.height, at + 3);
  if (patch.width !== undefined) buf.writeUInt16BE(patch.width, at + 5);
  if (patch.components !== undefined) buf[at + 7] = patch.components;
  return buf;
}

describe('JPEG contract (V4)', () => {
  it('parses the real reference JPEG as valid RGB <= 320px', () => {
    const info = inspectJpeg(VALID_JPEG);
    expect(info.errors).toEqual([]);
    expect(info.components).toBe(3);
    expect(Math.max(info.width, info.height)).toBeLessThanOrEqual(320);
    expect(checkPaintRefJpeg(VALID_JPEG)).toEqual([]);
  });

  it('rejects oversized (1200x630), CMYK, grayscale and tiny (16x13) images', () => {
    expect(checkPaintRefJpeg(patchJpeg({ width: 1200, height: 630 })).join()).toContain(
      'longest edge 1200px exceeds 320px'
    );
    expect(checkPaintRefJpeg(patchJpeg({ components: 4 })).join()).toContain('CMYK');
    expect(checkPaintRefJpeg(patchJpeg({ components: 1 })).join()).toContain('grayscale');
    expect(checkPaintRefJpeg(patchJpeg({ width: 16, height: 13 })).join()).toContain(
      'image too small'
    );
  });

  it('rejects FF D8 FF + random bytes, trailing padding, truncation and tiny files', () => {
    const random = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(8000, 0x41)]);
    expect(checkPaintRefJpeg(random).join()).toMatch(/corrupt JPEG/);

    const padded = Buffer.concat([VALID_JPEG, Buffer.alloc(6000, 0)]);
    expect(checkPaintRefJpeg(padded).join()).toContain('after EOI');

    const truncated = VALID_JPEG.subarray(0, VALID_JPEG.length - 200);
    expect(checkPaintRefJpeg(truncated).join()).toMatch(/EOI|corrupt/);

    expect(checkPaintRefJpeg(Buffer.from([0xff, 0xd8, 0xff, 0xd9])).join()).toContain(
      'file too small'
    );
  });

  it('rejects a tiny image padded past 5 KB with a giant comment segment', () => {
    // SOI + COM(60KB) + rest of real JPEG with SOF dims patched to 16x13
    const tiny = patchJpeg({ width: 16, height: 13 });
    const com = Buffer.alloc(4 + 6000, 0x20);
    com[0] = 0xff;
    com[1] = 0xfe;
    com.writeUInt16BE(6002, 2);
    const padded = Buffer.concat([tiny.subarray(0, 2), com, tiny.subarray(2)]);
    expect(checkPaintRefJpeg(padded).join()).toContain('image too small');
  });

  it('fails validation end-to-end for a bad JPEG on disk', async () => {
    const r = await runFixture((fx) => {
      fx.jpegs['case-1'] = patchJpeg({ width: 1200, height: 630 });
      fx.jpegs['case-2'] = patchJpeg({ components: 4 });
    });
    expectError(
      r,
      'public/paint-refs/case-1.jpg: longest edge 1200px',
      'public/paint-refs/case-2.jpg: must be RGB'
    );
  });
});

describe('URL hardening (V3)', () => {
  it('isSafeHttpsUrl rejects credentials, localhost, IP literals, backslashes, ports and scheme tricks', () => {
    const bad = [
      'https://www.justice.gov@evil.example/press',
      'https://user:pass@sec.gov/x',
      'https://localhost/x',
      'https://foo.localhost/x',
      'https://127.0.0.1/x',
      'https://2130706433/x',
      'https://[::1]/x',
      'https:\\\\sec.gov\\x',
      'https:/\\sec.gov/x',
      'https:sec.gov/x',
      'https://sec.gov:8443/x',
      'https://intranet/x',
      'https://sec.gov/x y',
      'https://evil.internal/x',
      'HTTPS://sec.gov/x',
      'http://www.sec.gov/x',
      'javascript:alert(1)',
    ];
    for (const url of bad) expect(isSafeHttpsUrl(url), url).toBe(false);
    for (const good of [
      'https://www.justice.gov/opa/pr/x',
      'https://commons.wikimedia.org/wiki/File:Do_Kwon.png',
      'https://apps.sfc.hk/edistributionWeb/gateway/EN/news-and-announcements/news/doc?refNo=26PR62',
    ]) {
      expect(isSafeHttpsUrl(good), good).toBe(true);
    }
  });

  it('hub guard is not bypassed by query strings, redirect wrappers or shorteners', () => {
    for (const url of [
      'https://www.justice.gov/news?page=2',
      'https://www.justice.gov/?q=1',
      'https://www.sec.gov/newsroom/press-releases?year=2026',
      'https://www.google.com/url?q=https://www.justice.gov/opa/pr/x',
      'https://bit.ly/3abcd',
      'https://t.co/xyz',
      'https://www.justice.gov/redirect?target=https://evil.example/',
    ]) {
      expect(findGenericHubUrlReason(url), url).toBeTruthy();
    }
    expect(findGenericHubUrlReason('https://www.justice.gov/opa/pr/x?utm=1')).toBeNull();
  });

  it('official-domain allowlist matches subdomains but not look-alikes', () => {
    for (const host of [
      'www.justice.gov',
      'media.ca7.uscourts.gov',
      'www.gov.uk',
      'www.sebi.gov.in',
      'apps.sfc.hk',
      'www.eppo.europa.eu',
      'www.bafin.de',
      'www.fatf-gafi.org',
      'ag.ny.gov',
      'www.courtlistener.com',
      'courts.state.ny.us',
    ]) {
      expect(isOfficialSourceHost(host), host).toBe(true);
    }
    for (const host of [
      'www.thehindu.com',
      'example.com',
      'justice.gov.evil.com',
      'evil-justice.gov.io',
      'sec.gov.example',
      'notsec.com',
      'bit.ly',
    ]) {
      expect(isOfficialSourceHost(host), host).toBe(false);
    }
  });

  it('rejects a press-only citation and a non-official host without secondary: true', async () => {
    const r = await runFixture((fx) => {
      article(fx, 1).meta.sources = [
        {
          title: 'News report',
          agency: 'The Hindu',
          url: 'https://www.thehindu.com/news/national/story/article1.ece',
          date: '2026-11-19',
        },
      ];
      article(fx, 2).meta.sources = [
        {
          title: 'News report',
          agency: 'The Hindu',
          url: 'https://www.thehindu.com/news/national/story/article2.ece',
          date: '2026-11-19',
          secondary: true,
        },
      ];
      article(fx, 3).meta.sources[0].url = 'https://example.com/filing/123';
    });
    expectError(
      r,
      'case-1/meta.json: sources[0].url',
      'host "www.thehindu.com" is not on the official-source allowlist',
      'case-2/meta.json: needs at least one non-secondary source',
      'host "example.com" is not on the official-source allowlist'
    );
  });

  it('accepts a secondary press citation alongside an official source', async () => {
    const r = await runFixture((fx) => {
      article(fx).meta.sources.push({
        title: 'News report',
        agency: 'The Hindu',
        url: 'https://www.thehindu.com/news/national/story/article1.ece',
        date: '2026-11-19',
        secondary: true,
      });
    });
    expect(r.errors).toEqual([]);
  });

  it('rejects credential-smuggling, hub+query and redirect sources end-to-end', async () => {
    const r = await runFixture((fx) => {
      article(fx, 1).meta.sources[0].url = 'https://www.justice.gov@evil.example/opa/pr/x';
      article(fx, 2).meta.sources[0].url = 'https://www.justice.gov/news?page=2';
      article(fx, 3).meta.sources[0].url =
        'https://www.google.com/url?q=https://www.justice.gov/opa/pr/x';
      fx.paintRefs['case-4'].sourceUrl = 'javascript:alert(1)';
    });
    expectError(
      r,
      'case-1/meta.json: sources.0.url',
      'generic newsroom/hub path ending in "/news"',
      'redirect wrapper',
      'case-4.sourceUrl'
    );
  });
});

describe('layout & dates (V5, V10)', () => {
  it('rejects an article filed under 2019/01 but dated 2026', async () => {
    const r = await runFixture((fx) => {
      article(fx).dir = '2019/01';
    });
    expectError(r, 'folder 2019/01 does not match publish_date 2026-11-20T06:00:00-05:00');
  });

  it('uses the literal YYYY-MM of publish_date (its own offset), not UTC', async () => {
    const r = await runFixture((fx) => {
      // 23:30 at -05:00 on Oct 31 is Nov 1 in UTC; folder must still be 2026/10.
      const a = article(fx);
      a.meta.publish_date = '2026-10-31T23:30:00-05:00';
      a.dir = '2026/10';
    });
    expect(r.errors).toEqual([]);
  });

  it('rejects drafts/ and other non-YYYY/MM directories that the loader would publish', async () => {
    const r = await runFixture((fx) => {
      article(fx).dir = 'drafts';
      fx.extraFiles['content/articles/2026/notes.txt'] = 'x';
    });
    expectError(
      r,
      'content/articles/drafts: directory must be a 4-digit year',
      'unexpected file in content/articles tree',
      'article must live at content/articles/YYYY/MM/<slug>/'
    );
  });

  it('rejects stray directories inside an article folder and empty slug folders', async () => {
    const r = await runFixture((fx) => {
      fx.extraFiles['content/articles/2026/11/case-1/old/meta.json'] = '{}';
      fx.extraFiles['content/articles/2026/11/empty-slug/.keep'] = '';
    });
    expectError(
      r,
      'case-1/old: unexpected directory inside an article folder',
      'empty-slug: article folder has no meta.json'
    );
  });

  it('rejects a future-dated (2027) story and honours the 36h skew', async () => {
    const r = await runFixture((fx) => {
      const a = article(fx);
      a.meta.publish_date = '2027-03-15T06:00:00-05:00';
      a.dir = '2027/03';
    });
    expectError(r, 'publish_date 2027-03-15T06:00:00-05:00 is in the future');

    const skew = await runFixture((fx) => {
      article(fx).meta.publish_date = '2026-11-23T06:00:00-05:00'; // ~23h after FIXTURE_NOW
    });
    expect(skew.errors.filter((e) => e.includes('in the future'))).toEqual([]);
  });

  it('reads "now" from FC_NOW when not passed explicitly', async () => {
    const prev = process.env.FC_NOW;
    process.env.FC_NOW = '2026-11-01T00:00:00Z';
    try {
      const r = await runFixture(() => {}, { now: null });
      expectError(r, 'is in the future');
    } finally {
      if (prev === undefined) delete process.env.FC_NOW;
      else process.env.FC_NOW = prev;
    }
  });

  it('rejects a source dated in the future', async () => {
    const r = await runFixture((fx) => {
      article(fx).meta.sources[0].date = '2027-01-01';
    });
    expectError(r, 'sources[0].date 2027-01-01 is in the future');
  });

  it('rejects duplicate slugs across months (build would silently drop one)', async () => {
    const r = await runFixture((fx) => {
      const dup = makeMeta(1, { id: 'fc-test-dup', publish_date: '2026-10-20T06:00:00-04:00' });
      fx.articles.push({ dir: '2026/10', meta: dup, body: BODY_HTML });
    });
    expectError(r, 'duplicate slug "case-1"');
  });

  it('rejects duplicate ids and slug/folder mismatch', async () => {
    const r = await runFixture((fx) => {
      article(fx, 2).meta.id = article(fx, 1).meta.id;
    });
    expectError(r, 'duplicate id "fc-test-001"');
  });
});

describe('editions (V6) & rollup (V7)', () => {
  it('rejects a stale latest.json that differs from the newest dated edition', async () => {
    const r = await runFixture((fx) => {
      fx.editions['latest.json'].volume = 'Vol. I, No. 1';
    });
    expectError(r, 'latest.json: differs from the newest dated edition 2026-11-20.json');
  });

  it('compares latest.json against the NEWEST dated edition', async () => {
    const r = await runFixture((fx) => {
      fx.editions['2026-11-19.json'] = makeEdition(
        fx.articles.map((a) => a.meta.slug),
        '2026-11-19'
      );
      for (const a of fx.articles) a.meta.edition_date = '2026-11-19';
    });
    expect(r.errors).toEqual([]);
  });

  it('rejects the same slug in two slots and article_slugs that disagree with slots', async () => {
    const r = await runFixture((fx) => {
      const ed = makeEdition(fx.articles.map((a) => a.meta.slug));
      ed.slots.rail_mini = ['case-1'];
      ed.article_slugs = [...ed.article_slugs, 'ghost-story'];
      setEdition(fx, ed);
    });
    expectError(
      r,
      'slug "case-1" appears in more than one slot',
      'article_slugs references unknown article slug "ghost-story"',
      'article_slugs lists "case-8" which is not placed in any slot'
    );
  });

  it('rejects unknown slot slugs', async () => {
    const r = await runFixture((fx) => {
      const ed = makeEdition(fx.articles.map((a) => a.meta.slug));
      ed.slots.ledger = ['nope'];
      delete ed.article_slugs;
      setEdition(fx, ed);
    });
    expectError(r, 'references unknown article slug "nope"');
  });

  it('rejects non-date edition filenames instead of silently ignoring them', async () => {
    const r = await runFixture((fx) => {
      fx.editions['2026-11-20-draft.json'] = '{}';
      fx.editions['backup.json'] = '{}';
      fx.editions['notes.txt'] = 'x';
    });
    expectError(
      r,
      '2026-11-20-draft.json: unexpected entry',
      'backup.json: unexpected entry',
      'notes.txt: unexpected entry'
    );
  });

  it('rejects a filename/edition_date mismatch', async () => {
    const r = await runFixture((fx) => {
      const ed = makeEdition(
        fx.articles.map((a) => a.meta.slug),
        '2026-11-18'
      );
      fx.editions['2026-11-17.json'] = ed;
    });
    expectError(r, 'filename date "2026-11-17" does not match internal edition_date "2026-11-18"');
  });

  it('gives a clear error (not a build crash) when there are no editions', async () => {
    const r = await runFixture((fx) => {
      fx.editions = {};
    });
    expectError(r, 'no dated edition manifests', 'latest.json: missing');
  });

  it('rejects an edition that features a story from a later edition', async () => {
    const r = await runFixture((fx) => {
      article(fx).meta.edition_date = '2026-11-21';
    });
    expectError(
      r,
      'references "case-1" whose edition_date 2026-11-21 is after this edition (2026-11-20)'
    );
  });

  it('warns for an article newer than the newest edition, errors for one in a gap', async () => {
    const newer = await runFixture((fx) => {
      fx.articles.push({
        dir: '2026/11',
        meta: makeMeta(10, {
          edition_date: '2026-11-22',
          publish_date: '2026-11-22T06:00:00-05:00',
        }),
        body: BODY_HTML,
      });
      fx.paintRefs['case-10'] = makePaintRef('case-10');
      fx.jpegs['case-10'] = VALID_JPEG;
      fx.rollup.total_cases = 10;
    });
    expect(newer.errors).toEqual([]);
    expect(
      newer.warnings.some((w) => w.includes('edition_date 2026-11-22 has no edition file yet'))
    ).toBe(true);

    const gap = await runFixture((fx) => {
      fx.articles.push({
        dir: '2026/11',
        meta: makeMeta(10, {
          edition_date: '2026-11-15',
          publish_date: '2026-11-15T06:00:00-05:00',
        }),
        body: BODY_HTML,
      });
      fx.paintRefs['case-10'] = makePaintRef('case-10');
      fx.jpegs['case-10'] = VALID_JPEG;
      fx.rollup.total_cases = 10;
    });
    expectError(gap, 'edition_date 2026-11-15 has no content/editions/2026-11-15.json');
  });

  it('rejects an edition dated in the future', async () => {
    const r = await runFixture((fx) => {
      fx.editions['2027-01-01.json'] = makeEdition(
        fx.articles.map((a) => a.meta.slug),
        '2027-01-01'
      );
    });
    expectError(r, '2027-01-01.json: edition_date 2027-01-01 is in the future');
  });

  it('rejects a rollup whose edition_date or case count drifted', async () => {
    const r = await runFixture((fx) => {
      fx.rollup.edition_date = '2027-03-15';
      fx.rollup.total_cases = 99;
    });
    expectError(
      r,
      'edition_date (2027-03-15) must equal the newest dated edition (2026-11-20)',
      'total_cases (99) does not match'
    );
  });

  it('keeps unknown generated rollup fields (passthrough) and validates total_frozen_usd', async () => {
    const ok = await runFixture((fx) => {
      fx.rollup.total_frozen_usd = 1000;
      fx.rollup.total_frozen_display = '$1K';
      fx.rollup.some_new_metric = 1;
    });
    expect(ok.errors).toEqual([]);
    const bad = await runFixture((fx) => {
      fx.rollup.total_frozen_usd = -1;
    });
    expectError(bad, 'total_frozen_usd');
  });
});

describe('body.html (V8)', () => {
  it('rejects empty paragraphs padded with whitespace and &nbsp; past 150 chars', async () => {
    const r = await runFixture((fx) => {
      article(fx).body = `<p></p>${' '.repeat(100)}${'&nbsp;'.repeat(40)}<p>   </p>`;
    });
    expectError(r, 'too little prose', 'must contain at least one non-empty <p> paragraph');
  });

  it('rejects http:, mailto:, target=_blank without noopener, spoofed classes, comments and CDATA', async () => {
    const r = await runFixture((fx) => {
      article(fx, 1).body = `${BODY_HTML}<p><a href="http://sec.gov/x">http</a></p>`;
      article(fx, 2).body = `${BODY_HTML}<p><a href="mailto:tips@example.com">mail</a></p>`;
      article(fx, 3).body =
        `${BODY_HTML}<p><a href="https://www.sec.gov/x" target="_blank" rel="opener">x</a></p>`;
      article(fx, 4).body = `${BODY_HTML}<p class="fc-score-badge">99</p>`;
      article(fx, 5).body = `${BODY_HTML}<!-- hidden --><p>x</p>`;
      article(fx, 6).body = `${BODY_HTML}<p><![CDATA[ junk ]]></p>`;
    });
    expectError(
      r,
      'case-1/body.html: disallowed href scheme',
      'case-2/body.html: disallowed href scheme',
      'case-3/body.html: disallowed rel token "opener"',
      'case-3/body.html: target="_blank" on <a> requires rel="noopener noreferrer"',
      'case-4/body.html: disallowed class "fc-score-badge" on <p>',
      'case-5/body.html: HTML comment',
      'case-6/body.html: CDATA section'
    );
  });
});

describe('refs-loader strict manifest parsing (G2)', () => {
  const tmpDirs: string[] = [];
  afterEach(async () => {
    for (const d of tmpDirs.splice(0)) await fs.rm(d, { recursive: true, force: true });
  });
  async function writeManifest(content: string): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fc-refs-'));
    tmpDirs.push(dir);
    const file = path.join(dir, 'paint-refs.json');
    await fs.writeFile(file, content);
    return file;
  }

  it('returns the parsed manifest when valid', async () => {
    const file = await writeManifest(JSON.stringify({ 'case-1': makePaintRef('case-1') }));
    const manifest = await readPaintRefsManifest(file);
    expect(manifest['case-1'].sourceUrl).toMatch(/^https:\/\//);
  });

  it('throws on a javascript: sourceUrl instead of passing it to an href', async () => {
    const file = await writeManifest(
      JSON.stringify({ 'case-1': makePaintRef('case-1', { sourceUrl: 'javascript:alert(1)' }) })
    );
    await expect(readPaintRefsManifest(file)).rejects.toThrow(/sourceUrl/);
  });

  it('throws on corrupt JSON and on a missing file (no silent painting-less build)', async () => {
    const file = await writeManifest('{ "case-1": ');
    await expect(readPaintRefsManifest(file)).rejects.toThrow(/not valid JSON/);
    await expect(
      readPaintRefsManifest(path.join(os.tmpdir(), 'definitely-missing-fc.json'))
    ).rejects.toThrow(/unreadable/);
  });

  it('throws on a non-allowlisted licence', async () => {
    const file = await writeManifest(
      JSON.stringify({ 'case-1': makePaintRef('case-1', { sourceLicense: 'Getty Images' }) })
    );
    await expect(readPaintRefsManifest(file)).rejects.toThrow(/sourceLicense/);
  });
});

it('fixture sanity: edition date constant', () => {
  expect(EDITION_DATE).toBe('2026-11-20');
});
