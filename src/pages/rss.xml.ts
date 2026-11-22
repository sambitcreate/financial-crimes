import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { loadAllArticles } from '../loaders/articles';

export async function GET(context: APIContext) {
  const articles = await loadAllArticles();
  const site = context.site ?? new URL('https://financialcrimes.fyi');

  return rss({
    title: 'The Financial Crimes',
    description:
      'All the Crimes Fit to Fine — Daily broadsheet tracking global white-collar crime, regulatory fines, and prison time from primary court and agency filings.',
    site,
    trailingSlash: false,
    items: articles.map((article) => ({
      title: article.headline,
      description: article.deck,
      pubDate: new Date(article.publish_date),
      link: new URL(article.url, site).toString(),
      categories: [article.category, ...article.agencies],
      author: article.byline.replace(/^By\s+/i, '').trim(),
    })),
    customData: '<language>en-us</language>',
  });
}
