const cheerio = require('cheerio');
const { getHttpClient } = require('../utils/httpClient');
const { delay, parsePrice } = require('../utils/helpers');

/**
 * Scrape a Flipkart product page
 * Flipkart returns 403 on direct hit — we need to hit homepage first (cookie warm-up)
 */
async function scrapeFlipkart(productUrl) {
  const client = getHttpClient({ 'Referer': 'https://www.google.com/' });

  // Warm up cookies by hitting homepage first
  try {
    await client.get('https://www.flipkart.com/', { timeout: 8000 });
    await delay(600);
  } catch (_) {}

  let html;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await client.get(productUrl, {
        headers: { 'Referer': 'https://www.flipkart.com/' }
      });
      html = res.data;
      break;
    } catch (err) {
      if (err.response?.status === 403 && attempt < 3) {
        await delay(attempt * 2000);
        continue;
      }
      throw err;
    }
  }

  const $ = cheerio.load(html);

  // Multiple title selectors across Flipkart's different page layouts
  const name = $('span.VU-ZEz').text().trim()
    || $('h1.yhB1nd span').text().trim()
    || $('span._35KyD6').text().trim()
    || $('h1').first().text().trim()
    || null;

  const rawPrice = $('div.Nx9bqj').first().text().trim()
    || $('div._30jeq3').first().text().trim()
    || $('div._16Jk6d').first().text().trim()
    || $('div.hl05eU div.Nx9bqj').first().text().trim()
    || null;
  const price = parsePrice(rawPrice);

  const image = $('img._396cs4').first().attr('src')
    || $('img._2r_T1I').first().attr('src')
    || $('img.DByuf4').first().attr('src')
    || null;

  const rating  = $('div.XQDdHH').first().text().trim() || $('div._3LWZlK').first().text().trim() || null;
  const reviews = $('span.Wphh3N').first().text().replace(/[^0-9,]/g,'') || null;
  const delivery = $('span._1k90VS').first().text().trim()
    || $('div.C7fEHH').first().text().trim()
    || 'Check on site';
  const available = !html.includes('Currently Out of Stock') && !$('div._16FRp0').length;

  if (!name || !price) {
    throw new Error('Could not extract product info from Flipkart. The page may have bot protection or the URL is invalid.');
  }

  return {
    platform: 'Flipkart',
    type:     'E-commerce',
    name:     name.substring(0, 150),
    price,
    image,
    rating:   rating ? `${rating}★` : 'N/A',
    reviews:  reviews || 'N/A',
    delivery: delivery.substring(0, 80),
    available,
    url:      productUrl,
  };
}

/**
 * Search Flipkart for a product
 */
async function searchFlipkart(query) {
  await delay(800);
  const client = getHttpClient({ 'Referer': 'https://www.flipkart.com/' });

  let html;
  try {
    const res = await client.get(`https://www.flipkart.com/search?q=${encodeURIComponent(query)}&otracker=search`);
    html = res.data;
  } catch (err) {
    console.error('[Flipkart search error]', err.message);
    return [];
  }

  const $ = cheerio.load(html);
  const results = [];

  // Flipkart search can show grid or list layouts
  const containers = $('div._1AtVbE, div.tUxRFH, div._2kHMtA').toArray();

  for (const el of containers) {
    if (results.length >= 3) break;
    const $el = $(el);

    const href  = $el.find('a[href*="/p/"]').first().attr('href');
    const title = $el.find('div.KzDlHZ, div._4rR01T, div.WKTcLC').first().text().trim()
      || $el.find('a.s1Q9rs').text().trim();
    const price = parsePrice($el.find('div.Nx9bqj, div._30jeq3').first().text());
    const image = $el.find('img._396cs4, img.DByuf4').first().attr('src');
    const rating = $el.find('div.XQDdHH, div._3LWZlK').first().text().trim();

    if (href && title && price) {
      results.push({
        platform: 'Flipkart',
        type:     'E-commerce',
        name:     title.substring(0, 150),
        price,
        image,
        rating:   rating ? `${rating}★` : 'N/A',
        reviews:  'N/A',
        delivery: 'See product page',
        available: true,
        url:      `https://www.flipkart.com${href.split('?')[0]}`,
      });
    }
  }

  return results;
}

module.exports = { scrapeFlipkart, searchFlipkart };
