import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { loadAllArticles } from '../loaders/articles';
import { articleModifiedAt } from '../utils/format';
import { listedArticles, RSS_MAX_ITEMS, selectRssItems } from '../utils/ledger';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET(context: APIContext) {
  // Retracted stories never appear in the feed
  const articles = listedArticles(await loadAllArticles());
  const latest = selectRssItems(articles, RSS_MAX_ITEMS);
  const site = context.site ?? new URL('https://financialcrimes.fyi');
  const feedUrl = new URL('/rss.xml', site).toString();

  // Deterministic: the newest publish/update among the items, not the build clock
  const lastBuildMs = latest.reduce((max, article) => {
    const ms = Date.parse(articleModifiedAt(article));
    return Number.isFinite(ms) && ms > max ? ms : max;
  }, 0);
  const lastBuildDate = lastBuildMs > 0 ? new Date(lastBuildMs).toUTCString() : null;

  return rss({
    title: 'The Financial Crimes',
    description:
      'All the Crimes Fit to Fine — Satirical daily broadsheet tracking global white-collar crime, regulatory fines, and prison time from primary court and agency filings.',
    site,
    trailingSlash: false,
    xmlns: {
      atom: 'http://www.w3.org/2005/Atom',
      dc: 'http://purl.org/dc/elements/1.1/',
    },
    items: latest.map((article) => ({
      title: article.headline,
      description: article.deck,
      pubDate: new Date(article.publish_date),
      link: new URL(article.url, site).toString(),
      categories: [article.category, ...article.agencies],
      // RSS <author> must be an email address; desk bylines go in dc:creator
      customData: `<dc:creator>${escapeXml(article.byline.replace(/^By\s+/i, '').trim())}</dc:creator>`,
    })),
    customData: [
      '<language>en-us</language>',
      lastBuildDate ? `<lastBuildDate>${lastBuildDate}</lastBuildDate>` : '',
      `<atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml"/>`,
    ].join(''),
  });
}
