const cheerio = require('cheerio');
const { getHttpClient } = require('../utils/httpClient');
const { delay, parsePrice } = require('../utils/helpers');

/**
 * Myntra is a React SPA — it embeds product JSON in a <script> tag
 */
async function scrapeMyntra(productUrl) {
  const client = getHttpClient({ 'Referer': 'https://www.google.com/' });
  await delay(500);

  const { data: html } = await client.get(productUrl);
  const $ = cheerio.load(html);

  let name, price, image, rating, reviews;

  // Try extracting embedded JSON first
  $('script').each((_, el) => {
    const src = $(el).html() || '';
    if (!src.includes('pdpData') && !src.includes('__myx')) return;
    try {
      const m = src.match(/window\.__myx_initialData__\s*=\s*(\{[\s\S]+?\});\s*<\/script>/)
        || src.match(/var pdpData\s*=\s*(\{[\s\S]+?\});/);
      if (!m) return;
      const json = JSON.parse(m[1]);
      const p    = json?.pdpData?.product || json?.product;
      if (!p) return;
      name    = p.name || p.productName;
      price   = p.price?.discounted || p.discountedPrice || p.price?.mrp;
      image   = p.media?.albums?.[0]?.images?.[0]?.src || null;
      rating  = p.rating?.averageRating;
      reviews = p.rating?.totalCount;
    } catch (_) {}
  });

  // HTML fallback
  if (!name) name  = $('h1.pdp-name').text().trim() || $('h1.pdp-title').text().trim();
  if (!price) price = parsePrice($('span.pdp-price strong').text() || $('div.pdp-price').text());
  if (!image) image = $('img.image-grid-image').first().attr('src');
  if (!rating) rating = $('div.index-overallRating span').first().text().trim();

  if (!name || !price) {
    throw new Error('Could not extract product info from Myntra.');
  }

  return {
    platform: 'Myntra',
    type:     'Fashion & Lifestyle',
    name:     String(name).substring(0, 150),
    price:    typeof price === 'number' ? price : parsePrice(String(price)),
    image:    image || null,
    rating:   rating ? `${rating}★` : 'N/A',
    reviews:  reviews ? String(reviews) : 'N/A',
    delivery: 'Free delivery on orders above ₹499',
    available: true,
    url:      productUrl,
  };
}

/**
 * Search Myntra — tries internal API first, falls back to HTML
 */
async function searchMyntra(query) {
  await delay(600);
  const client = getHttpClient({ 'Referer': 'https://www.myntra.com/' });

  // Try Myntra's internal search API
  try {
    const apiUrl = `https://www.myntra.com/gateway/v2/product/list/search?rawQuery=${encodeURIComponent(query)}&p=1&rows=3`;
    const { data } = await client.get(apiUrl);
    const products = data?.products || [];
    if (products.length) {
      return products.slice(0, 3).map(p => ({
        platform: 'Myntra',
        type:     'Fashion & Lifestyle',
        name:     (p.productName || p.name || '').substring(0, 150),
        price:    p.price?.discounted || p.discountedPrice || p.price?.mrp,
        image:    p.thumbnail || p.searchImage || null,
        rating:   p.rating ? `${p.rating}★` : 'N/A',
        reviews:  p.ratingCount ? String(p.ratingCount) : 'N/A',
        delivery: 'Free delivery on orders above ₹499',
        available: true,
        url:      `https://www.myntra.com/${p.landingPageUrl || ''}`,
      })).filter(r => r.price > 0);
    }
  } catch (_) {}

  // HTML fallback
  try {
    const { data: html } = await client.get(`https://www.myntra.com/${encodeURIComponent(query)}`);
    const $ = cheerio.load(html);
    const results = [];

    $('li.product-base').each((i, el) => {
      if (i >= 3) return false;
      const href  = $(el).find('a').attr('href');
      const brand = $(el).find('h3.product-brand').text().trim();
      const pname = $(el).find('h4.product-product').text().trim();
      const title = `${brand} ${pname}`.trim();
      const price = parsePrice($(el).find('span.product-discountedPrice').text() || $(el).find('div.product-price').text());
      const image = $(el).find('img.img-responsive').attr('src');

      if (href && title && price) {
        results.push({
          platform: 'Myntra',
          type:     'Fashion & Lifestyle',
          name:     title.substring(0, 150),
          price,
          image,
          rating:   'N/A',
          reviews:  'N/A',
          delivery: 'Free delivery on orders above ₹499',
          available: true,
          url:      `https://www.myntra.com/${href}`,
        });
      }
    });
    return results;
  } catch (err) {
    console.error('[Myntra search error]', err.message);
    return [];
  }
}

module.exports = { scrapeMyntra, searchMyntra };
