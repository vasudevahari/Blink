// ── NAVIGATION ────────────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

function goBack() {
  ['productResults','taxiResults'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });
  ['productError','taxiError'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.innerHTML = ''; el.style.display = 'none'; }
  });
  document.getElementById('productLoading').style.display = 'none';
  document.getElementById('taxiLoading').style.display    = 'none';
  document.getElementById('productForm').style.display    = 'block';
  document.getElementById('taxiForm').style.display       = 'block';
  showScreen('landing');
}

// ── HELPERS ───────────────────────────────────────────────────
const fmtINR = n => '₹' + Number(n).toLocaleString('en-IN');

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function setLoading(section, msg) {
  document.getElementById(section + 'Form').style.display    = 'none';
  document.getElementById(section + 'Loading').style.display = 'block';
  const key = section === 'product' ? 'loadingMsg' : 'taxiLoadingMsg';
  document.getElementById(key).textContent = msg;
}

function stopLoading(section) {
  document.getElementById(section + 'Loading').style.display = 'none';
}

function showError(section, message, tip) {
  const el = document.getElementById(section + 'Error');
  el.innerHTML = `<div>${escHtml(message)}</div>${tip ? `<div class="err-tip">💡 ${escHtml(tip)}</div>` : ''}`;
  el.style.display = 'block';
  document.getElementById(section + 'Form').style.display = 'block';
}

// ── PRODUCTS ──────────────────────────────────────────────────
async function compareProducts() {
  const url = document.getElementById('productUrl').value.trim();
  if (!url) {
    document.getElementById('productUrl').classList.add('error');
    return;
  }
  document.getElementById('productUrl').classList.remove('error');
  document.getElementById('productError').style.display = 'none';
  document.getElementById('productResults').innerHTML    = '';
  document.getElementById('productBtn').disabled         = true;
  setLoading('product', 'Fetching product page...');

  try {
    const res  = await fetch('/api/products/compare', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ url }),
    });
    const data = await res.json();
    stopLoading('product');
    document.getElementById('productBtn').disabled = false;

    if (!res.ok) { showError('product', data.error, data.tip); return; }
    renderProductResults(data);
  } catch (err) {
    stopLoading('product');
    document.getElementById('productBtn').disabled = false;
    showError('product', 'Network error — is the server running on port 3000?');
  }
}

function renderProductResults(data) {
  const { query, searchQuery, results, fetchedAt, cached } = data;
  const sorted  = [...results].sort((a, b) => a.price - b.price);
  const best    = sorted[0];
  const worst   = sorted[sorted.length - 1];
  const savings = worst.price - best.price;

  let html = `
    <div class="results-header">
      <div>
        <div class="results-title">${escHtml(query.substring(0, 80))}</div>
        <div class="results-sub">
          Searched as: <em>"${escHtml(searchQuery)}"</em> ·
          ${sorted.length} platform${sorted.length > 1 ? 's' : ''} ·
          ${cached ? 'Cached' : 'Live'} · ${new Date(fetchedAt).toLocaleTimeString('en-IN')}
        </div>
      </div>
      <span class="live-tag green">${cached ? 'CACHED' : 'LIVE'}</span>
    </div>
  `;

  if (sorted.length < 2) {
    html += `<div class="warn-box">
      ℹ️ Only found results on <strong>${sorted[0]?.platform}</strong> for this search.
      Other platforms may not carry this exact product, or were blocked temporarily.
      Try searching directly on Flipkart/Myntra for: <strong>"${escHtml(searchQuery)}"</strong>
    </div>`;
  } else if (savings > 0) {
    html += `
      <div class="savings-bar">
        <div>
          <div class="savings-label">Buy from <strong>${escHtml(best.platform)}</strong> instead of <strong>${escHtml(worst.platform)}</strong></div>
          <div class="savings-detail">and save</div>
        </div>
        <div class="savings-amount">${fmtINR(savings)}</div>
      </div>
    `;
  }

  html += '<div class="results-grid">';
  sorted.forEach((p, i) => {
    const isWinner = i === 0;
    const extra    = i > 0 ? p.price - best.price : 0;
    html += `
      <div class="result-card ${isWinner ? 'winner' : ''}">
        ${isWinner ? '<span class="winner-badge green">BEST PRICE</span>' : ''}
        ${p.image ? `<img class="card-img" src="${escHtml(p.image)}" alt="" onerror="this.style.display='none'" />` : ''}
        <div class="card-platform">
          ${escHtml(p.platform)}
          ${!p.available ? '<span class="unavailable-tag">Out of stock</span>' : ''}
        </div>
        <div class="card-type">${escHtml(p.name.substring(0, 60))}</div>
        <div class="card-price ${isWinner ? 'green' : ''}">${fmtINR(p.price)}</div>
        <div class="card-price-note">Selling price</div>
        <div class="card-details">
          <div class="card-row"><span>Delivery</span><span>${escHtml(p.delivery || 'Check site')}</span></div>
          <div class="card-row"><span>Rating</span><span>${escHtml(p.rating || 'N/A')}</span></div>
          <div class="card-row"><span>Reviews</span><span>${escHtml(String(p.reviews || 'N/A'))}</span></div>
          ${extra > 0 ? `<div class="card-row"><span>vs cheapest</span><span class="extra">+${fmtINR(extra)}</span></div>` : ''}
        </div>
        <a class="card-action" href="${escHtml(p.url)}" target="_blank" rel="noopener">
          View on ${escHtml(p.platform)} →
        </a>
      </div>
    `;
  });

  html += `</div><div class="data-note">Prices fetched live from platform pages · Not affiliated</div>`;
  document.getElementById('productResults').innerHTML = html;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── TAXIS ─────────────────────────────────────────────────────
async function compareTaxis() {
  const pickup  = document.getElementById('pickup').value.trim();
  const dropoff = document.getElementById('dropoff').value.trim();
  document.getElementById('pickup').classList.toggle('error', !pickup);
  document.getElementById('dropoff').classList.toggle('error', !dropoff);
  if (!pickup || !dropoff) return;

  document.getElementById('taxiError').style.display  = 'none';
  document.getElementById('taxiResults').innerHTML     = '';
  document.getElementById('taxiBtn').disabled          = true;
  const filter = document.getElementById('rideFilter').value;
  setLoading('taxi', 'Calculating route & fetching fares...');

  try {
    const res  = await fetch('/api/taxis/compare', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ pickup, dropoff, filter }),
    });
    const data = await res.json();
    stopLoading('taxi');
    document.getElementById('taxiBtn').disabled = false;

    if (!res.ok) { showError('taxi', data.error); return; }
    renderTaxiResults(data);
  } catch (err) {
    stopLoading('taxi');
    document.getElementById('taxiBtn').disabled = false;
    showError('taxi', 'Network error — is the server running on port 3000?');
  }
}

function renderTaxiResults(data) {
  const { results, distanceKm, durationMin, origin, destination, dataSource, fetchedAt, cached } = data;
  const best  = results[0];
  const worst = results[results.length - 1];

  let html = `
    <div class="results-header">
      <div>
        <div class="results-title">${escHtml(origin)} → ${escHtml(destination)}</div>
        <div class="results-sub">
          ${distanceKm} km · ~${durationMin} min · ${results.length} options ·
          Distance via <strong>${escHtml(dataSource)}</strong> ·
          ${new Date(fetchedAt).toLocaleTimeString('en-IN')}
        </div>
      </div>
      <span class="live-tag orange">${cached ? 'CACHED' : 'LIVE'}</span>
    </div>
    <div class="savings-bar">
      <div>
        <div class="savings-label">Cheapest: <strong>${escHtml(best.name)}</strong></div>
        <div class="savings-detail">vs most expensive option</div>
      </div>
      <div class="savings-amount orange">Save ₹${worst.fare - best.fare}</div>
    </div>
    <div class="results-grid">
  `;

  results.forEach((r, i) => {
    const isWinner  = i === 0;
    const surgeText = r.surge > 1.0 ? `${r.surge}x 🔴` : 'No surge ✅';
    const extra     = i > 0 ? r.fare - best.fare : 0;

    html += `
      <div class="result-card ${isWinner ? 'winner-orange' : ''}">
        ${isWinner ? '<span class="winner-badge orange">CHEAPEST</span>' : ''}
        <div class="card-platform">${escHtml(r.platform)}</div>
        <div class="card-type">${escHtml(r.name)} · ${escHtml(r.type)}</div>
        <div class="card-price ${isWinner ? 'orange' : ''}">₹${r.fare}</div>
        <div class="card-price-note">Estimated fare</div>
        <div class="card-details">
          <div class="card-row"><span>ETA</span><span>~${r.eta} min</span></div>
          <div class="card-row"><span>Surge</span><span>${surgeText}</span></div>
          <div class="card-row"><span>Seats</span><span>${r.capacity}</span></div>
          <div class="card-row"><span>AC</span><span>${r.ac ? 'Yes ❄️' : 'No'}</span></div>
          ${extra > 0 ? `<div class="card-row"><span>vs cheapest</span><span class="extra">+₹${extra}</span></div>` : ''}
        </div>
        <a class="card-action orange" href="${escHtml(r.bookingUrl)}" target="_blank" rel="noopener">
          Book on ${escHtml(r.platform)} →
        </a>
      </div>
    `;
  });

  html += `</div><div class="data-note">Fares are estimates using real per-km rates · Actual fare may vary · Clicking "Book" opens the platform directly</div>`;
  document.getElementById('taxiResults').innerHTML = html;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── ENTER KEY ─────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (document.getElementById('products').classList.contains('active')) compareProducts();
  if (document.getElementById('taxis').classList.contains('active'))    compareTaxis();
});
