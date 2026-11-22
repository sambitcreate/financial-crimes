import sanitizeHtml, { type IOptions } from 'sanitize-html';

export const ALLOWED_ARTICLE_TAGS = [
  'p',
  'h2',
  'h3',
  'blockquote',
  'ul',
  'ol',
  'li',
  'strong',
  'em',
  'b',
  'i',
  'a',
  'br',
  'code',
  'sup',
  'sub',
  'span',
] as const;

/**
 * Attributes allowed per tag. `class` is deliberately NOT listed here: classes are governed
 * by ALLOWED_ARTICLE_CLASSES so a body cannot spoof site chrome (e.g. `fc-score-badge`).
 */
export const ALLOWED_ARTICLE_ATTRIBUTES: Record<string, string[]> = {
  a: ['href', 'title', 'rel', 'target'],
};

/** The only classes body.html may use (the editorial classes styled by the article template). */
export const ALLOWED_ARTICLE_CLASSES: Record<string, string[]> = {
  p: ['fc-lead'],
  span: ['fc-dateline'],
  blockquote: ['fc-pullquote'],
};

/** Absolute hrefs must be https. Relative (`/path`, `#frag`) links remain allowed. */
export const ALLOWED_ARTICLE_SCHEMES = ['https'] as const;

/** rel tokens allowed on <a>. */
export const ALLOWED_REL_TOKENS = [
  'noopener',
  'noreferrer',
  'nofollow',
  'external',
  'ugc',
] as const;
const ALLOWED_REL_SET = new Set<string>(ALLOWED_REL_TOKENS);

function relTokens(rel: string | undefined): string[] {
  return String(rel ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Normalises <a> attributes: `target` may only be `_blank`, and `_blank` always carries
 * `rel="noopener noreferrer"`; unknown rel tokens are dropped. Must stay in lock-step with the
 * corresponding checks in findHtmlSecurityViolations().
 */
function normaliseAnchor(tagName: string, attribs: Record<string, string>) {
  const out: Record<string, string> = { ...attribs };
  if ('target' in out && out.target !== '_blank') delete out.target;
  if ('rel' in out) {
    const kept = relTokens(out.rel).filter((t) => ALLOWED_REL_SET.has(t));
    if (kept.length) out.rel = kept.join(' ');
    else delete out.rel;
  }
  if (out.target === '_blank') {
    const tokens = relTokens(out.rel);
    if (!tokens.includes('noopener') || !tokens.includes('noreferrer')) {
      const merged = [...new Set([...tokens, 'noopener', 'noreferrer'])];
      out.rel = merged.join(' ');
    }
  }
  return { tagName, attribs: out };
}

export const ARTICLE_SANITIZE_OPTIONS: IOptions = {
  allowedTags: [...ALLOWED_ARTICLE_TAGS],
  allowedAttributes: ALLOWED_ARTICLE_ATTRIBUTES,
  allowedClasses: ALLOWED_ARTICLE_CLASSES,
  allowedSchemes: [...ALLOWED_ARTICLE_SCHEMES],
  allowedSchemesByTag: {
    a: [...ALLOWED_ARTICLE_SCHEMES],
  },
  allowedSchemesAppliedToAttributes: ['href'],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  transformTags: {
    a: normaliseAnchor,
  },
};

const ALLOWED_TAG_SET = new Set<string>(ALLOWED_ARTICLE_TAGS);

const IPV4_RE = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const RESERVED_HOST_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.test',
  '.invalid',
  '.example',
  '.onion',
];

/**
 * Strict HTTPS-only URL validator for external citations and reference manifests.
 * Rejects: non-https schemes (javascript:, data:, http:), protocol-relative and scheme-only
 * forms (`https:host`), backslashes, embedded whitespace/control characters, credentials
 * (`https://user@host`), IP literals (v4/v6, incl. integer forms normalised by URL), localhost
 * and reserved/single-label hosts, explicit ports, and malformed URLs.
 */
export function isSafeHttpsUrl(url: string): boolean {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (!trimmed.startsWith('https://')) return false;
  if (/[\\\s\u0000-\u001f\u007f]/.test(trimmed)) return false;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  if (parsed.username || parsed.password) return false;
  if (parsed.port) return false;
  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (!host || !host.includes('.')) return false;
  if (host.startsWith('[') || host.includes(':')) return false;
  if (IPV4_RE.test(host)) return false;
  if (host === 'localhost' || RESERVED_HOST_SUFFIXES.some((s) => host.endsWith(s))) return false;
  // Every label must be a valid DNS label (letters, digits, hyphens; punycode allowed).
  if (!host.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
    return false;
  }
  // TLD must be alphabetic (or punycode) — rules out numeric pseudo-hosts.
  const tld = host.slice(host.lastIndexOf('.') + 1);
  if (!/^(?:[a-z]{2,63}|xn--[a-z0-9-]+)$/.test(tld)) return false;
  return true;
}

/**
 * Sanitizes article body HTML against the strict broadsheet allowlist before set:html rendering.
 */
export function sanitizeArticleHtml(html: string): string {
  return sanitizeHtml(html, ARTICLE_SANITIZE_OPTIONS).trim();
}

/** Raw markup constructs that sanitize-html silently drops or mangles. */
const RAW_CONSTRUCT_CHECKS: Array<[RegExp, string]> = [
  [/<!--/, 'HTML comment "<!--" is not allowed'],
  [/<!\[CDATA\[/i, 'CDATA section "<![CDATA[" is not allowed'],
  [/<![a-z]/i, 'markup declaration (e.g. <!DOCTYPE>) is not allowed'],
  [/<\?/, 'processing instruction "<?" is not allowed'],
];

/**
 * Parses HTML with sanitize-html's HTML5-compliant parser (htmlparser2) and reports every
 * disallowed tag, event handler, attribute, class, unsafe URI scheme, unsafe target/rel,
 * comment/CDATA, or any construct that sanitize-html would strip or mutate.
 */
export function findHtmlSecurityViolations(html: string): string[] {
  const violations: string[] = [];

  for (const [re, message] of RAW_CONSTRUCT_CHECKS) {
    if (re.test(html)) violations.push(message);
  }

  const passthrough = sanitizeHtml(html, {
    allowedTags: false,
    allowedAttributes: false,
    allowVulnerableTags: true,
    transformTags: {
      '*': (tagName, attribs) => {
        const tag = tagName.toLowerCase();
        if (!ALLOWED_TAG_SET.has(tag)) {
          violations.push(`disallowed tag <${tag}>`);
        }

        const allowedForTag = new Set(ALLOWED_ARTICLE_ATTRIBUTES[tag] ?? []);
        const allowedClasses = new Set(ALLOWED_ARTICLE_CLASSES[tag] ?? []);
        for (const [rawName, rawVal] of Object.entries(attribs)) {
          const name = rawName.toLowerCase();
          const value = String(rawVal ?? '');
          if (name.startsWith('on')) {
            violations.push(`disallowed event handler "${name}" on <${tag}>`);
          } else if (name === 'class') {
            const classes = value.split(/\s+/).filter(Boolean);
            for (const cls of classes) {
              if (!allowedClasses.has(cls)) {
                violations.push(`disallowed class "${cls}" on <${tag}>`);
              }
            }
          } else if (!allowedForTag.has(name)) {
            violations.push(`disallowed attribute "${name}" on <${tag}>`);
          } else if (name === 'href') {
            const cleaned = value.replace(/[\u0000- ]+/g, '');
            if (cleaned.startsWith('//') || cleaned.startsWith('\\')) {
              violations.push(`disallowed protocol-relative href "${value}" on <${tag}>`);
            } else if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(cleaned)) {
              if (!/^https:/i.test(cleaned)) {
                violations.push(`disallowed href scheme "${value}" on <${tag}> (https only)`);
              } else if (!isSafeHttpsUrl(value)) {
                violations.push(`unsafe https href "${value}" on <${tag}>`);
              }
            }
          } else if (name === 'target') {
            if (value !== '_blank') {
              violations.push(`disallowed target "${value}" on <${tag}> (only _blank)`);
            }
          } else if (name === 'rel') {
            for (const token of relTokens(value)) {
              if (!ALLOWED_REL_SET.has(token)) {
                violations.push(`disallowed rel token "${token}" on <${tag}>`);
              }
            }
          }
        }
        if (attribs.target === '_blank') {
          const tokens = relTokens(attribs.rel);
          if (!tokens.includes('noopener') || !tokens.includes('noreferrer')) {
            violations.push(`target="_blank" on <${tag}> requires rel="noopener noreferrer"`);
          }
        }

        return { tagName, attribs };
      },
    },
  }).trim();

  const sanitized = sanitizeArticleHtml(html);
  if (violations.length === 0 && sanitized !== passthrough) {
    violations.push('HTML contains constructs stripped or mutated by sanitize-html');
  }

  return violations;
}

/** Visible prose of an HTML fragment: tags stripped, entities decoded, whitespace removed. */
export function htmlProseText(html: string): string {
  const text = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });
  return text
    .replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
    .replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+|[a-z]+);/gi, '·')
    .replace(/[\s ​-‍⁠﻿]+/g, '');
}
