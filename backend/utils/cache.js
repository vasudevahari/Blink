const NodeCache = require('node-cache');

const productCache = new NodeCache({ stdTTL: parseInt(process.env.CACHE_TTL_PRODUCTS) || 300 });
const taxiCache    = new NodeCache({ stdTTL: parseInt(process.env.CACHE_TTL_TAXIS)    || 60  });

module.exports = { productCache, taxiCache };
