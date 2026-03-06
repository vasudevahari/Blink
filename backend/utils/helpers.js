/**
 * Sleep for ms milliseconds
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Parse a price string like "₹1,23,456" or "Rs. 999" into a number
 */
function parsePrice(raw) {
  if (!raw) return null;
  const num = parseFloat(String(raw).replace(/[^0-9.]/g, ''));
  return isNaN(num) || num <= 0 ? null : num;
}

/**
 * Clean a product name into a short search query
 * Removes storage sizes, colors, parentheses, model suffixes
 * e.g. "Apple iPhone 15 Pro Max (256GB, Black Titanium)" -> "Apple iPhone 15 Pro Max"
 */
function cleanSearchQuery(name) {
  return name
    .replace(/\(.*?\)/g, '')          // remove (256GB, Black)
    .replace(/\[.*?\]/g, '')          // remove [Renewed]
    .replace(/\b(gb|tb|mb|ram|rom|inch|"|cm|mm|kg|g|l|ml|watt|w|hz|mp)\b/gi, '')
    .replace(/\b\d{3,}\b/g, '')       // remove standalone big numbers
    .replace(/[,|\/\-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 5)                       // max 5 words for broadest match
    .join(' ');
}

/**
 * Fuzzy score between two product names (0-1, higher = better match)
 * Uses token overlap — handles "iPhone 15 Pro Max" vs "Apple iPhone 15 Pro Max 256GB"
 */
function fuzzyScore(a, b) {
  const tokenize = s => s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(t => t.length > 1 && !STOP_WORDS.has(t));

  const tokA = new Set(tokenize(a));
  const tokB = new Set(tokenize(b));

  if (!tokA.size || !tokB.size) return 0;

  let matches = 0;
  for (const t of tokA) {
    if (tokB.has(t)) matches++;
  }

  // Jaccard similarity
  const union = new Set([...tokA, ...tokB]).size;
  return matches / union;
}

/**
 * Given a source product name and an array of search results,
 * return only results that are likely the same product (score >= threshold)
 * sorted by relevance
 */
function filterByRelevance(sourceName, results, threshold = 0.25) {
  return results
    .map(r => ({ ...r, _score: fuzzyScore(sourceName, r.name) }))
    .filter(r => r._score >= threshold)
    .sort((a, b) => b._score - a._score)
    .map(({ _score, ...r }) => r);
}

const STOP_WORDS = new Set([
  'the','a','an','and','or','for','with','in','on','at','to','of','by',
  'new','best','top','buy','latest','official','original','genuine',
  'pack','combo','set','kit','bundle','edition',
]);

module.exports = { delay, parsePrice, cleanSearchQuery, fuzzyScore, filterByRelevance };
