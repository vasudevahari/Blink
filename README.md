# PriceSnap — Production-Grade Price Comparison

Compare **real** product prices across Amazon, Flipkart & Myntra.
Compare **estimated** ride fares across Ola, Uber, Rapido, InDrive & BluSmart.

---

## Project Structure

```
pricecheck/
├── backend/
│   ├── server.js                  # Express entry point
│   ├── routes/
│   │   ├── products.js            # POST /api/products/compare
│   │   └── taxis.js               # POST /api/taxis/compare
│   ├── scrapers/
│   │   ├── amazon.js              # Real scraper + search
│   │   ├── flipkart.js            # Real scraper + search
│   │   ├── myntra.js              # Real scraper + search
│   │   └── taxis.js               # Fare model (real per-km rates + Google Maps)
│   ├── middleware/
│   │   └── errorHandler.js
│   └── utils/
│       ├── httpClient.js          # Axios + user-agent rotation + proxy
│       └── cache.js               # In-memory cache
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
├── .env.example
├── package.json
└── README.md
```

---

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```

Edit `.env`:
```
PORT=3000
GOOGLE_MAPS_API_KEY=your_key_here   # optional but recommended for taxis
PROXY_URL=                          # optional, add for production scraping
```

**Get a free Google Maps key:**
1. https://console.cloud.google.com → New project
2. Enable "Distance Matrix API" + "Geocoding API"
3. Create API key → paste in .env

### 3. Run
```bash
npm run dev    # development (auto-restart)
npm start      # production
```
Open: http://localhost:3000

---

## How It Works

### Products
1. Paste a URL from Amazon / Flipkart / Myntra
2. Server scrapes that page live with Cheerio (real price)
3. Searches all other platforms by product name
4. Returns all results sorted cheapest first

### Taxis
1. Enter pickup + dropoff as text
2. If Google Maps API key set → real road distance
3. If not → geocoding fallback + Haversine formula
4. Real per-km rates from Ola/Uber/Rapido public fare pages
5. Time-of-day surge model (IST peak hours)

---

## Caching
- Products: 5 minutes · Taxis: 1 minute
- Configure via `CACHE_TTL_PRODUCTS` / `CACHE_TTL_TAXIS` in .env

## Rate Limiting
- 30 req/min per IP (edit in backend/server.js)

---

## Known Limitations

| Platform | Notes |
|----------|-------|
| Amazon | May CAPTCHA under heavy use — use a proxy in production |
| Flipkart | CSS class names change — may need selector updates after redesigns |
| Myntra | Parses embedded JSON — reliable but may break on major redesign |
| Ola/Uber | No public API — fares are model estimates, not live quotes |

**For production:** add `PROXY_URL` (BrightData / OxyLabs / Smartproxy) to avoid blocks.

---

## Deploy to VPS
```bash
npm install -g pm2
pm2 start backend/server.js --name pricesnap
pm2 save && pm2 startup
```
Then point Nginx to localhost:3000.
