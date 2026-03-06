const axios = require('axios');

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function getHttpClient(extraHeaders = {}) {
  const config = {
    timeout: parseInt(process.env.SCRAPE_TIMEOUT) || 15000,
    headers: {
      'User-Agent':      randomUA(),
      'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-IN,en;q=0.9,hi;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection':      'keep-alive',
      'Cache-Control':   'no-cache',
      'Pragma':          'no-cache',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest':  'document',
      'Sec-Fetch-Mode':  'navigate',
      'Sec-Fetch-Site':  'none',
      'DNT':             '1',
      ...extraHeaders,
    },
  };

  if (process.env.PROXY_URL) {
    try {
      const url = new URL(process.env.PROXY_URL);
      config.proxy = {
        host:     url.hostname,
        port:     parseInt(url.port),
        protocol: url.protocol.replace(':', ''),
        ...(url.username ? { auth: { username: url.username, password: url.password } } : {}),
      };
    } catch (_) {
      console.warn('[Proxy] Invalid PROXY_URL in .env — ignored');
    }
  }

  return axios.create(config);
}

module.exports = { getHttpClient };
