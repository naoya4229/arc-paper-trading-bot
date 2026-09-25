require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const PAPER_MODE = String(process.env.APP_MODE || 'paper').toLowerCase() === 'paper' && String(process.env.PAPER_TRADING || 'true').toLowerCase() === 'true';

if (!PAPER_MODE) {
  throw new Error('安全ロック: APP_MODE=paper かつ PAPER_TRADING=true が必要です。実売買モードは実装されていません。');
}

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
  prices: { BTC: 68000, ETH: 3500, SOL: 150 },
  referencePrices: { BTC: 68000, ETH: 3500, SOL: 150 },
  positions: {},
  tradeHistory: []
};

function cloneDefault() { return JSON.parse(JSON.stringify(defaultConfig)); }
function ensureDataDir() { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); }

function loadStore() {
  ensureDataDir();
  if (!fs.existsSync(STORE_PATH)) { const fresh = cloneDefault(); fs.writeFileSync(STORE_PATH, JSON.stringify(fresh, null, 2)); return fresh; }
  try {
    const parsed = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    return { ...cloneDefault(), ...parsed, paperTrading: true, prices: { ...defaultConfig.prices, ...(parsed.prices || {}) }, referencePrices: { ...defaultConfig.referencePrices, ...(parsed.referencePrices || {}) }, monitoredTokens: sanitizeTokenList(parsed.monitoredTokens), positions: parsed.positions || {}, tradeHistory: Array.isArray(parsed.tradeHistory) ? parsed.tradeHistory : [] };
  } catch (_error) { const fresh = cloneDefault(); fs.writeFileSync(STORE_PATH, JSON.stringify(fresh, null, 2)); return fresh; }
}

function saveStore(store) { ensureDataDir(); fs.writeFileSync(STORE_PATH, JSON.stringify({ ...store, paperTrading: true }, null, 2), 'utf8'); }
function safeNumber(value, fallback) { const num = Number(value); return Number.isFinite(num) ? num : fallback; }
function bounded(value, fallback, min = 0, max = 1000000000) { return Math.min(max, Math.max(min, safeNumber(value, fallback))); }
function sanitizeTokenList(value) {
  if (!Array.isArray(value) || value.length === 0) return [...defaultConfig.monitoredTokens];
  return value.map((item) => String(item).trim().toUpperCase()).filter((item) => /^[A-Z0-9_-]{1,20}$/.test(item)).filter((item, index, array) => array.indexOf(item) === index).slice(0, 20);
}
function createTradeEntry(token, side, price, amount, reason) { return { timestamp: new Date().toISOString(), token, side, price, amount, reason }; }
function ensureStatus(store) { store.paperTrading = true; store.botStatus = store.botEnabled && !store.emergencyStop ? 'Running' : 'Stopped'; store.walletBalance = Math.max(0, safeNumber(store.walletBalance, 0)); store.cashBalance = Math.max(0, safeNumber(store.cashBalance, 0)); return store; }

function refreshMarketPrices(store) {
  const next = { ...store.prices };
  for (const token of store.monitoredTokens) {
    const current = Number(store.prices[token] || store.referencePrices[token] || 1000);
    const updated = current * (1 + ((Math.random() * 0.08) - 0.04));
    next[token] = Number(Math.max(0.00000001, updated).toFixed(2));
    store.referencePrices[token] = Number((store.referencePrices[token] || updated).toFixed(2));
  }
  store.prices = next;
  return store;
}

function runPaperTradeEngine(store) {
  if (!store.botEnabled || store.emergencyStop || !store.paperTrading) return ensureStatus(store);
  for (const token of store.monitoredTokens) {
    const price = safeNumber(store.prices[token], 0);
    const reference = safeNumber(store.referencePrices[token], price);
    const position = store.positions[token] || { quantity: 0, entryPrice: 0 };
    if (position.quantity > 0) {
      const stopLoss = position.entryPrice * (1 - store.stopLossPercent / 100);
      const takeProfit = position.entryPrice * (1 + store.takeProfitPercent / 100);
      const sellTarget = reference * (1 + store.sellConditionPercent / 100);
      let reason = '';
      if (price <= stopLoss) reason = 'Stop loss triggered';
      else if (price >= takeProfit) reason = 'Take profit triggered';
      else if (price >= sellTarget) reason = 'Sell condition triggered';
      if (reason) { store.cashBalance += position.quantity * price; store.positions[token] = { quantity: 0, entryPrice: 0 }; store.tradeHistory.unshift(createTradeEntry(token, 'SELL', price, position.quantity, reason)); }
      continue;
    }
    const threshold = reference * (1 - store.buyConditionPercent / 100);
    if (price > 0 && price <= threshold && store.cashBalance >= store.maxPurchaseAmount && store.maxPurchaseAmount > 0) {
      const amount = Math.min(store.maxPurchaseAmount, store.cashBalance);
      store.cashBalance -= amount;
      store.positions[token] = { quantity: amount / price, entryPrice: price };
      store.tradeHistory.unshift(createTradeEntry(token, 'BUY', price, amount / price, 'Buy condition triggered'));
    }
  }
  store.tradeHistory = store.tradeHistory.slice(0, 1000);
  return ensureStatus(store);
}

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/health', (_req, res) => res.json({ ok: true, mode: 'paper-trading', paperTrading: true }));
app.get('/api/dashboard', (_req, res) => { const store = ensureStatus(loadStore()); res.json({ ...store, monitoredTokens: sanitizeTokenList(store.monitoredTokens), tradeHistory: store.tradeHistory.slice(0, 20) }); });
app.get('/api/config', (_req, res) => { const store = ensureStatus(loadStore()); res.json({ botEnabled: !!store.botEnabled, botStatus: store.botStatus, emergencyStop: !!store.emergencyStop, paperTrading: true, walletAddress: store.walletAddress || '', monitoredTokens: store.monitoredTokens, buyConditionPercent: store.buyConditionPercent, sellConditionPercent: store.sellConditionPercent, stopLossPercent: store.stopLossPercent, takeProfitPercent: store.takeProfitPercent, maxPurchaseAmount: store.maxPurchaseAmount }); });

app.post('/api/config', (req, res) => {
  const current = loadStore();
  const input = req.body || {};
  const updated = { ...current,
    walletAddress: typeof input.walletAddress === 'string' ? input.walletAddress.trim().slice(0, 200) : current.walletAddress,
    monitoredTokens: input.monitoredTokens === undefined ? current.monitoredTokens : sanitizeTokenList(input.monitoredTokens),
    buyConditionPercent: bounded(input.buyConditionPercent, current.buyConditionPercent, 0, 100),
    sellConditionPercent: bounded(input.sellConditionPercent, current.sellConditionPercent, 0, 100),
    stopLossPercent: bounded(input.stopLossPercent, current.stopLossPercent, 0, 100),
    takeProfitPercent: bounded(input.takeProfitPercent, current.takeProfitPercent, 0, 1000),
    maxPurchaseAmount: bounded(input.maxPurchaseAmount, current.maxPurchaseAmount, 0, 100000000),
    paperTrading: true
  };
  // Config API cannot change bot state, paper mode, balances, or the emergency latch.
  ensureStatus(updated); saveStore(updated); res.json({ ok: true, config: updated });
});

app.post('/api/toggle-bot', (req, res) => {
  const store = loadStore();
  const enabled = Boolean(req.body && req.body.enabled !== undefined ? req.body.enabled : !store.botEnabled);
  if (enabled && store.emergencyStop) return res.status(409).json({ error: '緊急停止中です。解除操作が必要です。' });
  store.botEnabled = enabled; ensureStatus(store); saveStore(store); res.json({ ok: true, botEnabled: store.botEnabled, botStatus: store.botStatus });
});
app.post('/api/emergency-stop', (_req, res) => { const store = loadStore(); store.emergencyStop = true; store.botEnabled = false; ensureStatus(store); saveStore(store); res.json({ ok: true, emergencyStop: true, botStatus: store.botStatus }); });
app.post('/api/emergency-reset', (_req, res) => { const store = loadStore(); store.emergencyStop = false; store.botEnabled = false; ensureStatus(store); saveStore(store); res.json({ ok: true, emergencyStop: false, botStatus: store.botStatus }); });
app.post('/api/refresh-prices', (_req, res) => { const store = runPaperTradeEngine(refreshMarketPrices(loadStore())); saveStore(store); res.json({ ok: true, prices: store.prices, positions: store.positions, tradeHistory: store.tradeHistory.slice(0, 10) }); });
app.get('/api/prices', (_req, res) => { const store = loadStore(); res.json({ prices: store.prices, monitoredTokens: store.monitoredTokens }); });
app.get('/api/trades', (_req, res) => { const store = loadStore(); res.json({ tradeHistory: store.tradeHistory }); });
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
setInterval(() => { const store = loadStore(); if (store.botEnabled && !store.emergencyStop) saveStore(runPaperTradeEngine(refreshMarketPrices(store))); }, 30000);
app.listen(PORT, () => console.log(`Arc paper trading dashboard running on http://localhost:${PORT}`));
module.exports = { app, defaultConfig };
