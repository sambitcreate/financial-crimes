import * as articleLoaders from '../loaders/articles';
import type { ArticleRecord } from '../schemas/article';
import { articleModifiedAt } from '../utils/format';

type ArticleLoader = () => Promise<ArticleRecord[]>;

/**
 * Every article that needs a page, retracted tombstones included. The loader's
 * loadAllArticlesIncludingRetracted() (when present) is the source of truth; older loaders
 * returned everything from loadAllArticles().
 */
export const loadEveryArticle: ArticleLoader =
  (articleLoaders as unknown as { loadAllArticlesIncludingRetracted?: ArticleLoader })
    .loadAllArticlesIncludingRetracted ?? articleLoaders.loadAllArticles;

export const PUBLISHER_NAME = 'The Financial Crimes';
export const PUBLISHER_LOGO_PATH = '/fc-logo-512.png';
export const PUBLISHER_LOGO_SIZE = 512;

/** Plain-language disclosure attached to every story's structured data. */
export const SATIRE_DISCLOSURE =
  'Satirical commentary on real enforcement actions. Every defendant, charge, docket and figure comes from the cited primary filings; jokes and framing are the publication’s own.';

export interface ArticleJsonLdInput
  extends Pick<
    ArticleRecord,
    'headline' | 'deck' | 'publish_date' | 'url' | 'category' | 'byline' | 'template' | 'slug'
  > {
  updated_at?: string | null;
}

/** Organization node used as both author (desk bylines are not people) and publisher. */
export function publisherOrganization(siteBase: URL): Record<string, unknown> {
  const origin = siteBase.toString().replace(/\/+$/, '');
  return {
    '@type': 'NewsMediaOrganization',
    name: PUBLISHER_NAME,
    url: origin,
    logo: {
      '@type': 'ImageObject',
      url: new URL(PUBLISHER_LOGO_PATH, siteBase).toString(),
      width: PUBLISHER_LOGO_SIZE,
      height: PUBLISHER_LOGO_SIZE,
    },
  };
}

/**
 * schema.org NewsArticle / OpinionNewsArticle for a story page. Desk bylines ("The Courts
 * Desk") are credited as organizations, dateModified comes from updated_at, and the satire
 * framing is disclosed via `genre`.
 */
export function buildArticleJsonLd(article: ArticleJsonLdInput, siteBase: URL): Record<string, unknown> {
  const canonicalUrl = new URL(article.url, siteBase).toString();
  const isOpinion = article.template === 'opinion';
  const deskName = article.byline.replace(/^By\s+/i, '').trim();
  const publisher = publisherOrganization(siteBase);
  return {
    '@context': 'https://schema.org',
    '@type': isOpinion ? 'OpinionNewsArticle' : 'NewsArticle',
    headline: article.headline,
    description: article.deck,
    datePublished: article.publish_date,
    dateModified: articleModifiedAt(article),
    url: canonicalUrl,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
    image: [new URL(`/og/${article.slug}.png`, siteBase).toString()],
    articleSection: isOpinion ? 'Opinion' : article.category,
    genre: isOpinion ? ['Opinion', 'Satire'] : ['Satire', 'Financial crime'],
    abstract: SATIRE_DISCLOSURE,
    author: {
      '@type': 'Organization',
      name: deskName ? `${deskName}, ${PUBLISHER_NAME}` : PUBLISHER_NAME,
      url: new URL('/about', siteBase).toString(),
    },
    publisher,
    isAccessibleForFree: true,
  };
}
