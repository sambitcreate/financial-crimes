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

export const ALLOWED_ARTICLE_ATTRIBUTES: Record<string, string[]> = {
  a: ['href', 'title', 'rel', 'target'],
  p: ['class'],
  span: ['class'],
  blockquote: ['class'],
};

export const ALLOWED_ARTICLE_SCHEMES = ['https', 'http', 'mailto'] as const;

export const ARTICLE_SANITIZE_OPTIONS: IOptions = {
  allowedTags: [...ALLOWED_ARTICLE_TAGS],
  allowedAttributes: ALLOWED_ARTICLE_ATTRIBUTES,
  allowedSchemes: [...ALLOWED_ARTICLE_SCHEMES],
  allowedSchemesByTag: {
    a: [...ALLOWED_ARTICLE_SCHEMES],
  },
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
};

const ALLOWED_TAG_SET = new Set<string>(ALLOWED_ARTICLE_TAGS);

/**
 * Strict HTTPS-only URL validator for external citations and reference manifests.
 * Rejects javascript:, data:, http:, protocol-relative, and malformed URLs.
 */
export function isSafeHttpsUrl(url: string): boolean {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' && parsed.hostname.length > 0;
  } catch {
    return false;
  }
}

/**
 * Sanitizes article body HTML against the strict broadsheet allowlist before set:html rendering.
 */
export function sanitizeArticleHtml(html: string): string {
  return sanitizeHtml(html, ARTICLE_SANITIZE_OPTIONS).trim();
}

/**
 * Parses HTML with sanitize-html's HTML5-compliant parser (htmlparser2) and reports every
 * disallowed tag, event handler, disallowed attribute, unsafe URI scheme, or construct that
 * sanitize-html would strip or mutate.
 */
export function findHtmlSecurityViolations(html: string): string[] {
  const violations: string[] = [];

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
        for (const [rawName, rawVal] of Object.entries(attribs)) {
          const name = rawName.toLowerCase();
          if (name.startsWith('on')) {
            violations.push(`disallowed event handler "${name}" on <${tag}>`);
          } else if (!allowedForTag.has(name)) {
            violations.push(`disallowed attribute "${name}" on <${tag}>`);
          } else if (name === 'href') {
            const cleaned = String(rawVal ?? '').replace(/[\u0000-\u0020]+/g, '');
            if (cleaned.startsWith('//')) {
              violations.push(`disallowed protocol-relative href "${rawVal}" on <${tag}>`);
            } else if (
              /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(cleaned) &&
              !/^(https?:|mailto:)/i.test(cleaned)
            ) {
              violations.push(`disallowed href scheme "${rawVal}" on <${tag}>`);
            }
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
