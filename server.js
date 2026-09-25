const express = require('express');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { getArcStatus, isAddress } = require('./arc-readonly');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const envTokens = String(process.env.MONITORED_TOKENS || 'BTC,ETH,SOL').split(',');
const defaultConfig = {
  botEnabled: false,
  botStatus: 'Stopped',
  emergencyStop: false,
  paperTrading: true,
  walletAddress: process.env.WALLET_ADDRESS || '',
  walletBalance: 10000,
  cashBalance: 10000,
  monitoredTokens: envTokens.map((v) => v.trim().toUpperCase()).filter(Boolean),
  buyThreshold: Number(process.env.BUY_CONDITION_PERCENT || 5),
  sellThreshold: Number(process.env.SELL_CONDITION_PERCENT || 8),
  stopLossPct: Number(process.env.STOP_LOSS_PERCENT || 8),
  takeProfitPct: Number(process.env.TAKE_PROFIT_PERCENT || 15),
  maxPurchaseAmount: Number(process.env.MAX_PURCHASE_AMOUNT || 500),
  prices: { BTC: 65000, ETH: 3500, SOL: 150 },
  referencePrices: { BTC: 65000, ETH: 3500, SOL: 150 },
  positions: {},
  tradeHistory: [],
};

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function ensureDir() { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); }
function number(value, fallback, min = 0, max = 1e9) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}
function tokens(value) {
  const result = (Array.isArray(value) ? value : defaultConfig.monitoredTokens)
    .map((v) => String(v).trim().toUpperCase()).filter((v) => /^[A-Z0-9_-]{1,20}$/.test(v));
  return [...new Set(result.length ? result : defaultConfig.monitoredTokens)];
}
function load() {
  ensureDir();
  if (!fs.existsSync(STORE_PATH)) { const initial = clone(defaultConfig); fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2)); return initial; }
  try { return { ...clone(defaultConfig), ...JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) }; } catch { return clone(defaultConfig); }
}
function save(state) { ensureDir(); fs.writeFileSync(STORE_PATH, JSON.stringify({ ...state, paperTrading: true }, null, 2)); }
function normalize(state) {
  state.paperTrading = true;
  state.monitoredTokens = tokens(state.monitoredTokens);
  state.botStatus = state.botEnabled && !state.emergencyStop ? 'Running' : 'Stopped';
  state.walletBalance = number(state.walletBalance, defaultConfig.walletBalance);
  state.cashBalance = number(state.cashBalance, defaultConfig.cashBalance);
  state.buyThreshold = number(state.buyThreshold, defaultConfig.buyThreshold, 0, 100);
  state.sellThreshold = number(state.sellThreshold, defaultConfig.sellThreshold, 0, 100);
  state.stopLossPct = number(state.stopLossPct, defaultConfig.stopLossPct, 0, 100);
  state.takeProfitPct = number(state.takeProfitPct, defaultConfig.takeProfitPct, 0, 100);
  state.maxPurchaseAmount = number(state.maxPurchaseAmount, defaultConfig.maxPurchaseAmount, 0, 1e7);
  state.tradeHistory = Array.isArray(state.tradeHistory) ? state.tradeHistory : [];
  state.positions = state.positions && typeof state.positions === 'object' ? state.positions : {};
  return state;
}
function refreshPrices(state) {
  state.prices = { ...state.prices };
  for (const token of state.monitoredTokens) {
    const current = Number(state.prices[token] || state.referencePrices[token] || 1000);
    state.prices[token] = Number(Math.max(0.00000001, current * (1 + Math.random() * 0.08 - 0.04)).toFixed(8));
  }
  return state;
}
function paperTrade(state) {
  state = normalize(state);
  if (!state.botEnabled || state.emergencyStop) return state;
  for (const token of state.monitoredTokens) {
    const price = Number(state.prices[token]);
    const reference = Number(state.referencePrices[token] || price);
    const position = state.positions[token] || { quantity: 0, entryPrice: 0 };
    const changePct = ((price - reference) / reference) * 100;
    let action = null;
    if (!position.quantity && changePct <= -state.buyThreshold && state.cashBalance >= Math.min(state.maxPurchaseAmount, state.cashBalance)) {
      const amount = Math.min(state.maxPurchaseAmount, state.cashBalance);
      position.quantity = Number((amount / price).toFixed(8)); position.entryPrice = price; state.cashBalance -= amount; action = 'BUY';
    } else if (position.quantity && (changePct >= state.sellThreshold || changePct <= -state.stopLossPct || price >= position.entryPrice * (1 + state.takeProfitPct / 100))) {
      const proceeds = position.quantity * price; state.cashBalance += proceeds; state.walletBalance += proceeds - position.quantity * position.entryPrice; action = changePct <= -state.stopLossPct ? 'STOP_LOSS' : changePct >= state.sellThreshold || price >= position.entryPrice * (1 + state.takeProfitPct / 100) ? 'TAKE_PROFIT' : 'SELL'; position.quantity = 0; position.entryPrice = 0;
    }
    state.positions[token] = position;
    if (action) state.tradeHistory.unshift({ timestamp: new Date().toISOString(), token, action, side: action === 'BUY' ? 'BUY' : 'SELL', price, quantity: position.quantity });
  }
  state.tradeHistory = state.tradeHistory.slice(0, 200);
  return normalize(state);
}

if (String(process.env.APP_MODE || 'paper').toLowerCase() !== 'paper' || String(process.env.PAPER_TRADING || 'true').toLowerCase() !== 'true') throw new Error('Safety lock: APP_MODE=paper and PAPER_TRADING=true are required.');
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/health', (_q, res) => res.json({ ok: true, mode: 'paper-trading', paperTrading: true, arcReadOnly: true }));
app.get('/api/dashboard', (_q, res) => { const s = normalize(load()); res.json({ ...s, tradeHistory: s.tradeHistory.slice(0, 20) }); });
app.get('/api/config', (_q, res) => { const s = normalize(load()); res.json({ botEnabled: !!s.botEnabled, botStatus: s.botStatus, emergencyStop: !!s.emergencyStop, paperTrading: true, walletAddress: s.walletAddress, monitoredTokens: s.monitoredTokens, buyThreshold: s.buyThreshold, sellThreshold: s.sellThreshold, stopLossPct: s.stopLossPct, takeProfitPct: s.takeProfitPct, maxPurchaseAmount: s.maxPurchaseAmount }); });
app.post('/api/config', (req, res) => { const s = normalize(load()); const input = req.body || {}; if (typeof input.walletAddress === 'string') { if (input.walletAddress && !isAddress(input.walletAddress.trim())) return res.status(400).json({ error: 'Invalid EVM wallet address' }); s.walletAddress = input.walletAddress.trim(); } if (input.monitoredTokens !== undefined) s.monitoredTokens = tokens(input.monitoredTokens); for (const key of ['buyThreshold', 'sellThreshold', 'stopLossPct', 'takeProfitPct', 'maxPurchaseAmount']) if (input[key] !== undefined) s[key] = number(input[key], s[key], 0, key === 'maxPurchaseAmount' ? 1e7 : 100); save(normalize(s)); res.json(normalize(s)); });
app.post('/api/toggle-bot', (req, res) => { const s = normalize(load()); const enabled = Boolean(req.body && req.body.enabled !== undefined ? req.body.enabled : !s.botEnabled); if (enabled && s.emergencyStop) return res.status(409).json({ error: '緊急停止中です。先に /api/emergency-reset を実行してください。' }); s.botEnabled = enabled; save(normalize(s)); res.json({ ok: true, botEnabled: s.botEnabled, botStatus: s.botStatus }); });
app.post('/api/emergency-stop', (_q, res) => { const s = normalize(load()); s.emergencyStop = true; s.botEnabled = false; save(normalize(s)); res.json({ ok: true, emergencyStop: true, botStatus: s.botStatus }); });
app.post('/api/emergency-reset', (_q, res) => { const s = normalize(load()); s.emergencyStop = false; s.botEnabled = false; save(normalize(s)); res.json({ ok: true, emergencyStop: false, botStatus: s.botStatus }); });
app.post('/api/refresh-prices', (_q, res) => { const s = paperTrade(refreshPrices(load())); save(s); res.json({ ok: true, prices: s.prices, positions: s.positions, tradeHistory: s.tradeHistory.slice(0, 10) }); });
app.get('/api/prices', (_q, res) => { const s = normalize(load()); res.json({ prices: s.prices, monitoredTokens: s.monitoredTokens }); });
app.get('/api/trades', (_q, res) => res.json({ tradeHistory: normalize(load()).tradeHistory }));
app.get('/api/arc/status', async (req, res) => { try { const s = normalize(load()); const address = req.query.address || s.walletAddress; if (address && !isAddress(address)) return res.status(400).json({ error: 'Invalid EVM wallet address' }); res.json(await getArcStatus(address)); } catch (error) { res.status(503).json({ connected: false, network: 'Arc', error: error.message }); } });
app.get('*', (_q, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
setInterval(() => { const s = normalize(load()); if (s.botEnabled && !s.emergencyStop) save(paperTrade(refreshPrices(s))); }, 30000);
app.listen(PORT, () => console.log(`Arc paper trading dashboard running on http://localhost:${PORT}`));
module.exports = { app, defaultConfig };
