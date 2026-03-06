const cheerio = require('cheerio');
const { getHttpClient } = require('../utils/httpClient');
const { delay, parsePrice, cleanSearchQuery } = require('../utils/helpers');

/**
 * Scrape a single Amazon product page
 */
async function scrapeAmazon(productUrl) {
  const client = getHttpClient({
    'Referer':         'https://www.google.com/',
    'Accept-Language': 'en-IN,en;q=0.9',
  });

  let html;
  // Retry up to 3 times with increasing delay
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await client.get(productUrl);
      html = res.data;
      break;
    } catch (err) {
      if (attempt === 3) throw err;
      await delay(attempt * 1500);
    }
  }

  const $ = cheerio.load(html);

  // Bot check
  if ($('#captchacharacters').length || html.includes('Type the characters you see')) {
    throw new Error('Amazon is showing a CAPTCHA. Try again in a few seconds or add a PROXY_URL in .env');
  }

  const name = $('#productTitle').text().trim()
    || $('h1.a-size-large span').text().trim()
    || null;

  const priceSelectors = [
    '.priceToPay .a-offscreen',
    '.a-price[data-a-size="xl"] .a-offscreen',
    '#priceblock_ourprice',
    '#priceblock_dealprice',
    '#apex_offerDisplay_mobile .a-offscreen',
    '.a-price .a-offscreen',
  ];

  let rawPrice = null;
  for (const sel of priceSelectors) {
    const val = $(sel).first().text().trim();
    if (val && val.includes('₹')) { rawPrice = val; break; }
  }
  const price = parsePrice(rawPrice);

  const image = $('#landingImage').attr('src')
    || $('#imgBlkFront').attr('src')
    || $('img#main-image').attr('src')
    || null;

  const ratingText = $('#acrPopover').attr('title') || $('span.a-icon-alt').first().text();
  const rating     = ratingText ? ratingText.split(' ')[0] : null;
  const reviews    = $('#acrCustomerReviewText').first().text().replace(/[^0-9,]/g, '') || null;
  const delivery   = $('#mir-layout-DELIVERY_BLOCK .a-text-bold').first().text().trim()
    || $('#ddmDeliveryMessage').text().trim()
    || 'Check on site';
  const available  = !$('#availability span').text().toLowerCase().includes('unavailable');

  if (!name || !price) {
    throw new Error('Could not extract product info from Amazon. The page structure may have changed or bot protection is active.');
  }

  return {
    platform: 'Amazon',
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
 * Search Amazon for a product by name — returns top 3 results
 */
async function searchAmazon(query) {
  await delay(800); // be polite
  const client = getHttpClient({ 'Referer': 'https://www.google.com/' });
  const searchUrl = `https://www.amazon.in/s?k=${encodeURIComponent(query)}&ref=nb_sb_noss`;

  let html;
  try {
    const res = await client.get(searchUrl);
    html = res.data;
  } catch (err) {
    console.error('[Amazon search error]', err.message);
    return [];
  }

  const $ = cheerio.load(html);
  if ($('#captchacharacters').length) {
    console.warn('[Amazon] CAPTCHA on search page');
    return [];
  }

  const results = [];

  $('[data-component-type="s-search-result"]').each((i, el) => {
    if (results.length >= 3) return false;

    const href  = $(el).find('h2 a.a-link-normal').attr('href');
    const title = $(el).find('h2 span.a-text-normal').text().trim()
      || $(el).find('h2 a span').text().trim();
    const priceRaw = $(el).find('.a-price .a-offscreen').first().text();
    const price    = parsePrice(priceRaw);
    const image    = $(el).find('img.s-image').attr('src');
    const rating   = $(el).find('span.a-icon-alt').first().text().split(' ')[0];
    const reviews  = $(el).find('span[aria-label*="ratings"]').attr('aria-label')?.replace(/[^0-9,]/g,'') || 'N/A';

    if (href && title && price) {
      results.push({
        platform: 'Amazon',
        type:     'E-commerce',
        name:     title.substring(0, 150),
        price,
        image,
        rating:   rating ? `${rating}★` : 'N/A',
        reviews,
        delivery: 'See product page',
        available: true,
        url:      `https://www.amazon.in${href.split('?')[0]}`,
      });
    }
  });

  return results;
}

module.exports = { scrapeAmazon, searchAmazon };
