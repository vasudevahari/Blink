function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  // Axios errors (network/scraping failures)
  if (err.isAxiosError) {
    const status = err.response?.status;
    if (status === 404) return res.status(404).json({ error: 'Product page not found.' });
    if (status === 403 || status === 429) {
      return res.status(503).json({
        error: 'The platform is blocking our request. Try again in a few seconds.',
        tip:   'Adding a PROXY_URL in .env significantly improves reliability.',
      });
    }
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      return res.status(504).json({ error: 'Request timed out. The platform may be slow.' });
    }
    return res.status(502).json({ error: 'Failed to reach the external platform.' });
  }

  res.status(500).json({ error: 'Internal server error.' });
}

module.exports = { errorHandler };
