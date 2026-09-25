const API_URL = '/api';

const els = {
  botStatus: document.getElementById('botStatus'),
  mode: document.getElementById('mode'),
  emergencyStatus: document.getElementById('emergencyStatus'),
  toggleBot: document.getElementById('toggleBot'),
  emergencyStop: document.getElementById('emergencyStop'),
  walletAddress: document.getElementById('walletAddress'),
  walletBalance: document.getElementById('walletBalance'),
  cashBalance: document.getElementById('cashBalance'),
  tokenTable: document.getElementById('tokenTable'),
  historyBody: document.getElementById('historyBody'),
  positionsTable: document.getElementById('positionsTable'),
  refreshPrices: document.getElementById('refreshPrices'),
  settingsForm: document.getElementById('settingsForm'),
  walletAddressInput: document.getElementById('walletAddressInput'),
  buyConditionPercent: document.getElementById('buyConditionPercent'),
  sellConditionPercent: document.getElementById('sellConditionPercent'),
  stopLossPercent: document.getElementById('stopLossPercent'),
  takeProfitPercent: document.getElementById('takeProfitPercent'),
  maxPurchaseAmount: document.getElementById('maxPurchaseAmount'),
  monitoredTokens: document.getElementById('monitoredTokens')
};

function formatMoney(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(number);
}

function renderTokens(prices = {}) {
  const entries = Object.entries(prices).map(([token, price]) => `
    <div class="token-row">
      <span>${token}</span>
      <strong>${formatMoney(price)}</strong>
    </div>
  `);

  els.tokenTable.innerHTML = entries.join('') || '<p>監視対象がありません</p>';
}

function renderPositions(positions = {}) {
  const rows = Object.entries(positions).map(([token, pos]) => `
    <div class="position-row">
      <span>${token}</span>
      <span>数量: ${Number(pos.quantity || 0).toFixed(4)}</span>
      <span>平均価格: ${formatMoney(pos.entryPrice || 0)}</span>
    </div>
  `);

  els.positionsTable.innerHTML = rows.join('') || '<p>保有ポジションがありません</p>';
}

function renderHistory(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    els.historyBody.innerHTML = '<tr><td colspan="6">取引履歴はありません</td></tr>';
    return;
  }

  els.historyBody.innerHTML = items.map((entry) => `
    <tr>
      <td>${new Date(entry.timestamp).toLocaleString('ja-JP')}</td>
      <td>${entry.token}</td>
      <td>${entry.side}</td>
      <td>${formatMoney(entry.price)}</td>
      <td>${Number(entry.amount || 0).toFixed(4)}</td>
      <td>${entry.reason || '-'}</td>
    </tr>
  `).join('');
}

async function fetchDashboard() {
  const response = await fetch(`${API_URL}/dashboard`);
  const data = await response.json();

  els.botStatus.textContent = data.botStatus || 'Stopped';
  els.mode.textContent = data.paperTrading ? 'Paper' : 'Live';
  els.emergencyStatus.textContent = data.emergencyStop ? 'ON' : 'OFF';
  els.walletAddress.textContent = data.walletAddress || '未設定';
  els.walletBalance.textContent = formatMoney(data.walletBalance || 0);
  els.cashBalance.textContent = formatMoney(data.cashBalance || 0);

  els.walletAddressInput.value = data.walletAddress || '';
  els.buyConditionPercent.value = data.buyConditionPercent ?? 5;
  els.sellConditionPercent.value = data.sellConditionPercent ?? 8;
  els.stopLossPercent.value = data.stopLossPercent ?? 8;
  els.takeProfitPercent.value = data.takeProfitPercent ?? 15;
  els.maxPurchaseAmount.value = data.maxPurchaseAmount ?? 500;
  els.monitoredTokens.value = Array.isArray(data.monitoredTokens) ? data.monitoredTokens.join(',') : 'BTC,ETH,SOL';

  renderTokens(data.prices || {});
  renderPositions(data.positions || {});
  renderHistory(data.tradeHistory || []);
}

els.toggleBot.addEventListener('click', async () => {
  const response = await fetch(`${API_URL}/toggle-bot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });

  if (response.ok) {
    await fetchDashboard();
  }
});

els.emergencyStop.addEventListener('click', async () => {
  const response = await fetch(`${API_URL}/emergency-stop`, { method: 'POST' });
  if (response.ok) {
    await fetchDashboard();
  }
});

els.refreshPrices.addEventListener('click', async () => {
  const response = await fetch(`${API_URL}/refresh-prices`, { method: 'POST' });
  if (response.ok) {
    await fetchDashboard();
  }
});

els.settingsForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    walletAddress: els.walletAddressInput.value.trim(),
    buyConditionPercent: Number(els.buyConditionPercent.value),
    sellConditionPercent: Number(els.sellConditionPercent.value),
    stopLossPercent: Number(els.stopLossPercent.value),
    takeProfitPercent: Number(els.takeProfitPercent.value),
    maxPurchaseAmount: Number(els.maxPurchaseAmount.value),
    monitoredTokens: els.monitoredTokens.value.split(',').map((token) => token.trim()).filter(Boolean)
  };

  await fetch(`${API_URL}/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  await fetchDashboard();
});

fetchDashboard();
setInterval(fetchDashboard, 15000);
