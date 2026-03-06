const express  = require('express');
const router   = express.Router();
const { scrapeAmazon,   searchAmazon }   = require('../scrapers/amazon');
const { scrapeFlipkart, searchFlipkart } = require('../scrapers/flipkart');
const { scrapeMyntra,   searchMyntra }   = require('../scrapers/myntra');
const { productCache }                   = require('../utils/cache');
const { cleanSearchQuery, filterByRelevance } = require('../utils/helpers');

function detectPlatform(url) {
  if (/amazon\.(in|com)/i.test(url))   return 'amazon';
  if (/flipkart\.com/i.test(url))      return 'flipkart';
  if (/myntra\.com/i.test(url))        return 'myntra';
  return null;
}

/**
 * POST /api/products/compare
 * Body: { url }
 */
router.post('/compare', async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required.' });
    }

    const normalizedUrl = url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`;
    const cacheKey = `product:${normalizedUrl}`;
    const cached   = productCache.get(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const platform = detectPlatform(normalizedUrl);
    if (!platform) {
      return res.status(400).json({
        error: 'Unsupported URL. Paste a product link from Amazon, Flipkart, or Myntra.',
      });
    }

    // ── Step 1: Scrape source product ──────────────────────────
    let sourceProduct = null;
    try {
      if (platform === 'amazon')   sourceProduct = await scrapeAmazon(normalizedUrl);
      if (platform === 'flipkart') sourceProduct = await scrapeFlipkart(normalizedUrl);
      if (platform === 'myntra')   sourceProduct = await scrapeMyntra(normalizedUrl);
    } catch (err) {
      return res.status(502).json({
        error:  err.message,
        tip:    platform === 'flipkart'
          ? 'Flipkart blocks scrapers aggressively. Make sure you copy the URL from the actual product page (not search results).'
          : 'Try again in a few seconds. If it keeps failing, add a PROXY_URL in .env',
      });
    }

    // ── Step 2: Build smart search query ───────────────────────
    const searchQuery = cleanSearchQuery(sourceProduct.name);
    console.log(`[Products] Source: "${sourceProduct.name}"`);
    console.log(`[Products] Searching for: "${searchQuery}"`);

    // ── Step 3: Search other platforms in parallel ─────────────
    const tasks = [];
    if (platform !== 'amazon')   tasks.push(searchAmazon(searchQuery).catch(e => { console.error('[Amazon search]', e.message); return []; }));
    if (platform !== 'flipkart') tasks.push(searchFlipkart(searchQuery).catch(e => { console.error('[Flipkart search]', e.message); return []; }));
    if (platform !== 'myntra')   tasks.push(searchMyntra(searchQuery).catch(e => { console.error('[Myntra search]', e.message); return []; }));

    const searchResults = (await Promise.all(tasks)).flat();
    console.log(`[Products] Raw search results: ${searchResults.length}`);

    // ── Step 4: Fuzzy filter — keep only matching products ─────
    const relevant = filterByRelevance(sourceProduct.name, searchResults, 0.2);
    console.log(`[Products] After fuzzy filter: ${relevant.length}`);

    // ── Step 5: Best result per platform ──────────────────────
    const byPlatform = { [sourceProduct.platform]: sourceProduct };
    for (const r of relevant) {
      if (!byPlatform[r.platform]) byPlatform[r.platform] = r;
    }

    const allResults = Object.values(byPlatform)
      .filter(r => r.price > 0)
      .sort((a, b) => a.price - b.price);

    const response = {
      query:     sourceProduct.name,
      searchQuery,
      sourceUrl: normalizedUrl,
      results:   allResults,
      fetchedAt: new Date().toISOString(),
      cached:    false,
    };

    productCache.set(cacheKey, response);
    res.json(response);

  } catch (err) {
    next(err);
  }
});

module.exports = router;
