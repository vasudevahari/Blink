const express = require('express');
const router  = express.Router();
const { estimateFares } = require('../scrapers/taxis');
const { taxiCache }     = require('../utils/cache');

/**
 * POST /api/taxis/compare
 * Body: { pickup: "...", dropoff: "...", filter: "all|bike|auto|cab|premium" }
 */
router.post('/compare', async (req, res, next) => {
  try {
    const { pickup, dropoff, filter = 'all' } = req.body;

    if (!pickup || !dropoff) {
      return res.status(400).json({ error: 'Both pickup and dropoff locations are required.' });
    }

    const validFilters = ['all', 'bike', 'auto', 'cab', 'premium'];
    if (!validFilters.includes(filter)) {
      return res.status(400).json({ error: `Invalid filter. Use one of: ${validFilters.join(', ')}` });
    }

    const cacheKey = `taxi:${pickup.toLowerCase()}:${dropoff.toLowerCase()}:${filter}`;
    const cached   = taxiCache.get(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const data = await estimateFares({ pickup, dropoff, filter });

    if (!data.results.length) {
      return res.status(404).json({ error: 'No ride options found for this route and filter.' });
    }

    const response = {
      ...data,
      fetchedAt: new Date().toISOString(),
      cached:    false,
    };

    taxiCache.set(cacheKey, response);
    res.json(response);

  } catch (err) {
    next(err);
  }
});

module.exports = router;
