const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

const defaultConfig = {
  botEnabled: false,
  botStatus: 'Stopped',
  emergencyStop: false,
  paperTrading: true,
  walletAddress: process.env.WALLET_ADDRESS || '',
  walletBalance: 10000,
  cashBalance: 10000,
  monitoredTokens: ['BTC', 'ETH', 'SOL'],
  buyConditionPercent: 5,
  sellConditionPercent: 8,
  stopLossPercent: 8,
  takeProfitPercent: 15,
  maxPurchaseAmount: 500,
  prices: {
    BTC: 68000,
    ETH: 3500,
    SOL: 150
  },
  referencePrices: {
    BTC: 68000,
    ETH: 3500,
    SOL: 150
  },
  positions: {},
  tradeHistory: []
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadStore() {
  ensureDataDir();

  if (!fs.existsSync(STORE_PATH)) {
    fs.writeFileSync(STORE_PATH, JSON.stringify(defaultConfig, null, 2), 'utf8');
    return JSON.parse(JSON.stringify(defaultConfig));
  }

  try {
    const raw = fs.readFileSync(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      ...JSON.parse(JSON.stringify(defaultConfig)),
      ...parsed,
      prices: { ...defaultConfig.prices, ...(parsed.prices || {}) },
      referencePrices: { ...defaultConfig.referencePrices, ...(parsed.referencePrices || {}) },
      monitoredTokens: Array.isArray(parsed.monitoredTokens) && parsed.monitoredTokens.length ? parsed.monitoredTokens : defaultConfig.monitoredTokens,
      positions: parsed.positions || {},
      tradeHistory: Array.isArray(parsed.tradeHistory) ? parsed.tradeHistory : []
    };
  } catch (error) {
    fs.writeFileSync(STORE_PATH, JSON.stringify(defaultConfig, null, 2), 'utf8');
    return JSON.parse(JSON.stringify(defaultConfig));
  }
}

function saveStore(store) {
  ensureDataDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function safeNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function sanitizeTokenList(value) {
  if (!Array.isArray(value) || value.length === 0) return ['BTC', 'ETH', 'SOL'];
  return value
    .map((item) => String(item).trim().toUpperCase())
    .filter(Boolean)
    .filter((item, idx, arr) => arr.indexOf(item) === idx);
}

function createTradeEntry(token, side, price, amount, reason) {
  return {
    timestamp: new Date().toISOString(),
    token,
    side,
    price,
    amount,
    reason
  };
}

function ensureStatus(store) {
  store.botStatus = store.botEnabled && !store.emergencyStop ? 'Running' : 'Stopped';
  store.walletBalance = safeNumber(store.walletBalance, 0);
  store.cashBalance = safeNumber(store.cashBalance, 0);
  return store;
}

function refreshMarketPrices(store) {
  const tokens = store.monitoredTokens || ['BTC', 'ETH', 'SOL'];
  const next = { ...store.prices };

  tokens.forEach((token) => {
    const current = Number(store.prices[token] || store.referencePrices[token] || 1000);
    const volatility = (Math.random() * 0.08) - 0.04;
    const updated = current * (1 + volatility);
    next[token] = Number(updated.toFixed(2));
    store.referencePrices[token] = Number((store.referencePrices[token] || updated).toFixed(2));
  });

  store.prices = next;
  return store;
}

function runPaperTradeEngine(store) {
  if (!store.botEnabled || store.emergencyStop || !store.paperTrading) {
    ensureStatus(store);
    return store;
  }

  const tokens = store.monitoredTokens || ['BTC', 'ETH', 'SOL'];

  tokens.forEach((token) => {
    const price = safeNumber(store.prices[token], 0);
    const reference = safeNumber(store.referencePrices[token], price);
    const position = store.positions[token] || { quantity: 0, entryPrice: 0 };

    if (position.quantity > 0) {
      const buyStopLoss = position.entryPrice * (1 - (store.stopLossPercent || 0) / 100);
      const takeProfit = position.entryPrice * (1 + (store.takeProfitPercent || 0) / 100);
      const sellTarget = reference * (1 + (store.sellConditionPercent || 0) / 100);

      if (price <= buyStopLoss) {
        const proceeds = position.quantity * price;
        store.cashBalance += proceeds;
        store.positions[token] = { quantity: 0, entryPrice: 0 };
        store.tradeHistory.unshift(createTradeEntry(token, 'SELL', price, position.quantity, 'Stop loss triggered'));
        return;
      }

      if (price >= takeProfit) {
        const proceeds = position.quantity * price;
        store.cashBalance += proceeds;
        store.positions[token] = { quantity: 0, entryPrice: 0 };
        store.tradeHistory.unshift(createTradeEntry(token, 'SELL', price, position.quantity, 'Take profit triggered'));
        return;
      }

      if (price >= sellTarget) {
        const proceeds = position.quantity * price;
        store.cashBalance += proceeds;
        store.positions[token] = { quantity: 0, entryPrice: 0 };
        store.tradeHistory.unshift(createTradeEntry(token, 'SELL', price, position.quantity, 'Sell condition triggered'));
      }

      return;
    }

    const buyThreshold = reference * (1 - (store.buyConditionPercent || 0) / 100);
    if (price <= buyThreshold && store.cashBalance >= Number(store.maxPurchaseAmount || 0)) {
      const amount = Math.min(Number(store.maxPurchaseAmount), Number(store.cashBalance));
      const quantity = amount / price;
      store.cashBalance -= amount;
      store.positions[token] = { quantity, entryPrice: price };
      store.tradeHistory.unshift(createTradeEntry(token, 'BUY', price, quantity, 'Buy condition triggered'));
    }
  });

  ensureStatus(store);
  return store;
}

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, mode: 'paper-trading' });
});

app.get('/api/dashboard', (_req, res) => {
  const store = ensureStatus(loadStore());
  res.json({
    ...store,
    walletBalance: safeNumber(store.walletBalance, 0),
    cashBalance: safeNumber(store.cashBalance, 0),
    monitoredTokens: sanitizeTokenList(store.monitoredTokens),
    positions: store.positions || {},
    tradeHistory: Array.isArray(store.tradeHistory) ? store.tradeHistory.slice(0, 20) : []
  });
});

app.get('/api/config', (_req, res) => {
  const store = ensureStatus(loadStore());
  res.json({
    botEnabled: Boolean(store.botEnabled),
    botStatus: store.botStatus,
    emergencyStop: Boolean(store.emergencyStop),
    paperTrading: Boolean(store.paperTrading),
    walletAddress: store.walletAddress || '',
    monitoredTokens: sanitizeTokenList(store.monitoredTokens),
    buyConditionPercent: safeNumber(store.buyConditionPercent, 5),
    sellConditionPercent: safeNumber(store.sellConditionPercent, 8),
    stopLossPercent: safeNumber(store.stopLossPercent, 8),
    takeProfitPercent: safeNumber(store.takeProfitPercent, 15),
    maxPurchaseAmount: safeNumber(store.maxPurchaseAmount, 500),
    prices: store.prices || {},
    positions: store.positions || {},
    tradeHistory: Array.isArray(store.tradeHistory) ? store.tradeHistory.slice(0, 20) : []
  });
});

app.post('/api/config', (req, res) => {
  const current = ensureStatus(loadStore());
  const incoming = req.body || {};

  const patch = {
    botEnabled: incoming.botEnabled !== undefined ? Boolean(incoming.botEnabled) : current.botEnabled,
    paperTrading: incoming.paperTrading !== undefined ? Boolean(incoming.paperTrading) : current.paperTrading,
    emergencyStop: incoming.emergencyStop !== undefined ? Boolean(incoming.emergencyStop) : current.emergencyStop,
    walletAddress: typeof incoming.walletAddress === 'string' ? incoming.walletAddress.trim() : current.walletAddress,
    monitoredTokens: sanitizeTokenList(incoming.monitoredTokens),
    buyConditionPercent: safeNumber(incoming.buyConditionPercent, current.buyConditionPercent || 5),
    sellConditionPercent: safeNumber(incoming.sellConditionPercent, current.sellConditionPercent || 8),
    stopLossPercent: safeNumber(incoming.stopLossPercent, current.stopLossPercent || 8),
    takeProfitPercent: safeNumber(incoming.takeProfitPercent, current.takeProfitPercent || 15),
    maxPurchaseAmount: safeNumber(incoming.maxPurchaseAmount, current.maxPurchaseAmount || 500),
    walletBalance: safeNumber(incoming.walletBalance, current.walletBalance || 10000),
    cashBalance: safeNumber(incoming.cashBalance, current.cashBalance || 10000)
  };

  const updated = { ...current, ...patch };
  ensureStatus(updated);

  if (updated.emergencyStop) {
    updated.botEnabled = false;
    updated.botStatus = 'Stopped';
  }

  saveStore(updated);
  res.json({ ok: true, config: updated });
});

app.post('/api/toggle-bot', (req, res) => {
  const store = ensureStatus(loadStore());
  const enabled = Boolean(req.body && req.body.enabled !== undefined ? req.body.enabled : !store.botEnabled);
  store.botEnabled = enabled;
  store.emergencyStop = false;
  ensureStatus(store);
  saveStore(store);
  res.json({ ok: true, botEnabled: store.botEnabled, botStatus: store.botStatus });
});

app.post('/api/emergency-stop', (_req, res) => {
  const store = ensureStatus(loadStore());
  store.emergencyStop = true;
  store.botEnabled = false;
  ensureStatus(store);
  saveStore(store);
  res.json({ ok: true, emergencyStop: true, botStatus: store.botStatus });
});

app.post('/api/refresh-prices', (_req, res) => {
  const store = ensureStatus(loadStore());
  refreshMarketPrices(store);
  const withEngine = runPaperTradeEngine(store);
  saveStore(withEngine);
  res.json({ ok: true, prices: withEngine.prices, positions: withEngine.positions, tradeHistory: withEngine.tradeHistory.slice(0, 10) });
});

app.get('/api/prices', (_req, res) => {
  const store = ensureStatus(loadStore());
  res.json({ prices: store.prices || {} });
});

app.get('/api/trades', (_req, res) => {
  const store = ensureStatus(loadStore());
  res.json({ tradeHistory: Array.isArray(store.tradeHistory) ? store.tradeHistory : [] });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const tickLoop = () => {
  const store = ensureStatus(loadStore());
  if (store.botEnabled && !store.emergencyStop) {
    const updated = runPaperTradeEngine(refreshMarketPrices(store));
    saveStore(updated);
  }
};

setInterval(tickLoop, 30000);

app.listen(PORT, () => {
  // Important: do not log secrets or wallet private keys.
  console.log(`Arc paper trading dashboard running on http://localhost:${PORT}`);
});

module.exports = { app, defaultConfig };
