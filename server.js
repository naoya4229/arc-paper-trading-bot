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
  botEnabled: false, botStatus: 'Stopped', emergencyStop: false, paperTrading: true,
  walletAddress: process.env.WALLET_ADDRESS || '', walletBalance: 10000, cashBalance: 10000,
  monitoredTokens: envTokens.map((v) => v.trim().toUpperCase()).filter(Boolean),
  buyThreshold: Number(process.env.BUY_CONDITION_PERCENT || 5), sellThreshold: Number(process.env.SELL_CONDITION_PERCENT || 8),
  stopLossPct: Number(process.env.STOP_LOSS_PERCENT || 8), takeProfitPct: Number(process.env.TAKE_PROFIT_PERCENT || 15),
  maxPurchaseAmount: Number(process.env.MAX_PURCHASE_AMOUNT || 500),
  prices: { BTC: 65000, ETH: 3500, SOL: 150 }, referencePrices: { BTC: 65000, ETH: 3500, SOL: 150 },
  volumes: {}, priceHistory: {}, positions: {}, tradeHistory: [], social: {},
};
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function ensureDir() { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); }
function number(value, fallback, min = 0, max = 1e9) { const n = Number(value); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback; }
function tokens(value) { const result = (Array.isArray(value) ? value : defaultConfig.monitoredTokens).map((v) => String(v).trim().toUpperCase()).filter((v) => /^[A-Z0-9_-]{1,20}$/.test(v)); return [...new Set(result.length ? result : defaultConfig.monitoredTokens)]; }
function load() { ensureDir(); if (!fs.existsSync(STORE_PATH)) { const initial = clone(defaultConfig); fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2)); return initial; } try { return { ...clone(defaultConfig), ...JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) }; } catch { return clone(defaultConfig); } }
function save(state) { ensureDir(); fs.writeFileSync(STORE_PATH, JSON.stringify({ ...state, paperTrading: true }, null, 2)); }
function normalize(state) {
  state.paperTrading = true; state.monitoredTokens = tokens(state.monitoredTokens); state.botStatus = state.botEnabled && !state.emergencyStop ? 'Running' : 'Stopped';
  state.walletBalance = number(state.walletBalance, 10000); state.cashBalance = number(state.cashBalance, 10000);
  for (const key of ['buyThreshold', 'sellThreshold', 'stopLossPct', 'takeProfitPct']) state[key] = number(state[key], defaultConfig[key], 0, 100);
  state.maxPurchaseAmount = number(state.maxPurchaseAmount, 500, 0, 1e7); state.tradeHistory = Array.isArray(state.tradeHistory) ? state.tradeHistory : [];
  state.positions = state.positions && typeof state.positions === 'object' ? state.positions : {}; state.volumes = state.volumes && typeof state.volumes === 'object' ? state.volumes : {};
  state.priceHistory = state.priceHistory && typeof state.priceHistory === 'object' ? state.priceHistory : {}; state.social = state.social && typeof state.social === 'object' ? state.social : {};
  return state;
}
function refreshMarket(state) {
  state = normalize(state); state.prices = { ...state.prices }; state.volumes = { ...state.volumes }; state.priceHistory = { ...state.priceHistory };
  const now = Date.now();
  for (const token of state.monitoredTokens) {
    const current = Number(state.prices[token] || state.referencePrices[token] || 1000);
    const price = Number(Math.max(0.00000001, current * (1 + Math.random() * 0.08 - 0.04)).toFixed(8));
    state.prices[token] = price; state.volumes[token] = Math.round(Math.max(1000, (state.volumes[token] || current * 100) * (0.7 + Math.random() * 0.6)));
    const history = Array.isArray(state.priceHistory[token]) ? state.priceHistory[token] : [];
    history.push({ time: now, price, volume: state.volumes[token] }); state.priceHistory[token] = history.slice(-120);
  }
  return state;
}
function paperTrade(state) {
  state = normalize(state); if (!state.botEnabled || state.emergencyStop) return state;
  for (const token of state.monitoredTokens) {
    const price = Number(state.prices[token]); const reference = Number(state.referencePrices[token] || price); const oldPosition = state.positions[token] || { quantity: 0, entryPrice: 0 }; const position = { ...oldPosition }; const changePct = ((price - reference) / reference) * 100; let action = null; let quantity = 0;
    if (!position.quantity && changePct <= -state.buyThreshold && state.cashBalance > 0) { const amount = Math.min(state.maxPurchaseAmount, state.cashBalance); quantity = Number((amount / price).toFixed(8)); position.quantity = quantity; position.entryPrice = price; state.cashBalance -= amount; action = 'BUY'; }
    else if (position.quantity && (changePct >= state.sellThreshold || changePct <= -state.stopLossPct || price >= position.entryPrice * (1 + state.takeProfitPct / 100))) { quantity = position.quantity; state.cashBalance += quantity * price; state.walletBalance += quantity * (price - position.entryPrice); action = changePct <= -state.stopLossPct ? 'STOP_LOSS' : 'TAKE_PROFIT'; position.quantity = 0; position.entryPrice = 0; }
    state.positions[token] = position; if (action) state.tradeHistory.unshift({ timestamp: new Date().toISOString(), token, action, side: action === 'BUY' ? 'BUY' : 'SELL', price, quantity });
  }
  state.tradeHistory = state.tradeHistory.slice(0, 200); return state;
}
function xQueryFor(token) { return `(${token} OR $${token}) -is:retweet lang:ja`; }
async function fetchXBuzz(token) {
  const bearer = String(process.env.X_BEARER_TOKEN || '').trim();
  if (!bearer) return { configured: false, token, score: null, posts: null, message: 'X_BEARER_TOKEN未設定' };
  const url = new URL('https://api.twitter.com/2/tweets/search/recent'); url.searchParams.set('query', xQueryFor(token)); url.searchParams.set('max_results', '100'); url.searchParams.set('tweet.fields', 'public_metrics,created_at');
  const response = await fetch(url, { headers: { Authorization: `Bearer ${bearer}` } }); if (!response.ok) throw new Error(`X API HTTP ${response.status}`); const body = await response.json(); const tweets = body.data || [];
  let score = 0; let likes = 0; let reposts = 0; let replies = 0; let quotes = 0; for (const tweet of tweets) { const m = tweet.public_metrics || {}; likes += m.like_count || 0; reposts += m.retweet_count || 0; replies += m.reply_count || 0; quotes += m.quote_count || 0; }
  score = Math.min(100, Math.round(Math.log10(1 + tweets.length * 10 + likes + reposts * 2 + replies + quotes * 2) * 12));
  return { configured: true, token, score, posts: tweets.length, likes, reposts, replies, quotes, sampleSize: tweets.length, fetchedAt: new Date().toISOString() };
}

if (String(process.env.APP_MODE || 'paper').toLowerCase() !== 'paper' || String(process.env.PAPER_TRADING || 'true').toLowerCase() !== 'true') throw new Error('Safety lock: APP_MODE=paper and PAPER_TRADING=true are required.');
app.use(express.json({ limit: '1mb' })); app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/health', (_q, res) => res.json({ ok: true, mode: 'paper-trading', paperTrading: true, arcReadOnly: true, xConfigured: Boolean(process.env.X_BEARER_TOKEN) }));
app.get('/api/dashboard', (_q, res) => { const s = normalize(load()); res.json({ ...s, tradeHistory: s.tradeHistory.slice(0, 20) }); });
app.get('/api/config', (_q, res) => { const s = normalize(load()); res.json({ botEnabled: !!s.botEnabled, botStatus: s.botStatus, emergencyStop: !!s.emergencyStop, paperTrading: true, walletAddress: s.walletAddress, monitoredTokens: s.monitoredTokens, buyThreshold: s.buyThreshold, sellThreshold: s.sellThreshold, stopLossPct: s.stopLossPct, takeProfitPct: s.takeProfitPct, maxPurchaseAmount: s.maxPurchaseAmount }); });
app.post('/api/config', (req, res) => { const s = normalize(load()); const input = req.body || {}; if (typeof input.walletAddress === 'string') { if (input.walletAddress && !isAddress(input.walletAddress.trim())) return res.status(400).json({ error: 'Invalid EVM wallet address' }); s.walletAddress = input.walletAddress.trim(); } if (input.monitoredTokens !== undefined) s.monitoredTokens = tokens(input.monitoredTokens); for (const key of ['buyThreshold', 'sellThreshold', 'stopLossPct', 'takeProfitPct', 'maxPurchaseAmount']) if (input[key] !== undefined) s[key] = number(input[key], s[key], 0, key === 'maxPurchaseAmount' ? 1e7 : 100); save(normalize(s)); res.json(normalize(s)); });
app.post('/api/toggle-bot', (req, res) => { const s = normalize(load()); const enabled = Boolean(req.body && req.body.enabled !== undefined ? req.body.enabled : !s.botEnabled); if (enabled && s.emergencyStop) return res.status(409).json({ error: '緊急停止中です。先にリセットしてください。' }); s.botEnabled = enabled; save(normalize(s)); res.json({ ok: true, botEnabled: s.botEnabled, botStatus: s.botStatus }); });
app.post('/api/emergency-stop', (_q, res) => { const s = normalize(load()); s.emergencyStop = true; s.botEnabled = false; save(normalize(s)); res.json({ ok: true, emergencyStop: true, botStatus: s.botStatus }); });
app.post('/api/emergency-reset', (_q, res) => { const s = normalize(load()); s.emergencyStop = false; s.botEnabled = false; save(normalize(s)); res.json({ ok: true, emergencyStop: false, botStatus: s.botStatus }); });
app.post('/api/refresh-prices', (_q, res) => { const s = paperTrade(refreshMarket(load())); save(s); res.json({ ok: true, prices: s.prices, volumes: s.volumes, priceHistory: s.priceHistory, positions: s.positions, tradeHistory: s.tradeHistory.slice(0, 10) }); });
app.get('/api/prices', (_q, res) => { const s = normalize(load()); res.json({ prices: s.prices, volumes: s.volumes, priceHistory: s.priceHistory, monitoredTokens: s.monitoredTokens }); });
app.get('/api/trades', (_q, res) => res.json({ tradeHistory: normalize(load()).tradeHistory }));
app.get('/api/social', async (req, res) => { const s = normalize(load()); const requested = req.query.token ? [String(req.query.token).toUpperCase()] : s.monitoredTokens; try { const results = {}; for (const token of requested.slice(0, 10)) results[token] = await fetchXBuzz(token); res.json({ source: 'X API v2 recent search', results }); } catch (error) { res.status(502).json({ error: error.message, source: 'X API v2 recent search' }); } });
app.get('/api/arc/status', async (req, res) => { try { const s = normalize(load()); const address = req.query.address || s.walletAddress; if (address && !isAddress(address)) return res.status(400).json({ error: 'Invalid EVM wallet address' }); res.json(await getArcStatus(address)); } catch (error) { res.status(503).json({ connected: false, network: 'Arc', error: error.message }); } });
app.get('*', (_q, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
setInterval(() => { const s = normalize(load()); if (s.botEnabled && !s.emergencyStop) save(paperTrade(refreshMarket(s))); }, 30000);
app.listen(PORT, () => console.log(`Arc paper trading dashboard running on http://localhost:${PORT}`));
module.exports = { app, defaultConfig };
