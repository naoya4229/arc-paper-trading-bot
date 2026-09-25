const express = require('express');
const fs = require('fs');
const path = require('path');
const { getArcStatus, isAddress } = require('./arc-readonly');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');
const defaultConfig = { botEnabled:false, botStatus:'Stopped', emergencyStop:false, paperTrading:true, walletAddress:process.env.WALLET_ADDRESS || '', walletBalance:10000, cashBalance:10000, monitoredTokens:['BTC','ETH','SOL'], buyConditionPercent:5, sellConditionPercent:8, stopLossPercent:8, takeProfitPercent:15, maxPurchaseAmount:500, prices:{BTC:68000,ETH:3500,SOL:150}, referencePrices:{BTC:68000,ETH:3500,SOL:150}, positions:{}, tradeHistory:[] };
const clone = () => JSON.parse(JSON.stringify(defaultConfig));
function ensureDir(){if(!fs.existsSync(DATA_DIR))fs.mkdirSync(DATA_DIR,{recursive:true});}
function tokens(value){if(!Array.isArray(value)||!value.length)return [...defaultConfig.monitoredTokens];return value.map(v=>String(v).trim().toUpperCase()).filter(v=>/^[A-Z0-9_-]{1,20}$/.test(v)).filter((v,i,a)=>a.indexOf(v)===i).slice(0,20);}
function load(){ensureDir();if(!fs.existsSync(STORE_PATH)){const x=clone();fs.writeFileSync(STORE_PATH,JSON.stringify(x,null,2));return x;}try{const p=JSON.parse(fs.readFileSync(STORE_PATH,'utf8'));return {...clone(),...p,paperTrading:true,monitoredTokens:tokens(p.monitoredTokens),prices:{...defaultConfig.prices,...p.prices},referencePrices:{...defaultConfig.referencePrices,...p.referencePrices},positions:p.positions||{},tradeHistory:Array.isArray(p.tradeHistory)?p.tradeHistory:[]};}catch(_e){const x=clone();fs.writeFileSync(STORE_PATH,JSON.stringify(x,null,2));return x;}}
function save(s){ensureDir();fs.writeFileSync(STORE_PATH,JSON.stringify({...s,paperTrading:true},null,2));}
function number(v,f,min=0,max=1e9){const n=Number(v);return Number.isFinite(n)?Math.min(max,Math.max(min,n)):f;}
function status(s){s.paperTrading=true;s.botStatus=s.botEnabled&&!s.emergencyStop?'Running':'Stopped';s.walletBalance=number(s.walletBalance,0);s.cashBalance=number(s.cashBalance,0);return s;}
function refresh(s){const p={...s.prices};for(const t of s.monitoredTokens){const c=Number(s.prices[t]||s.referencePrices[t]||1000);p[t]=Number(Math.max(.00000001,c*(1+Math.random()*.08-.04)).toFixed(2));s.referencePrices[t]=Number((s.referencePrices[t]||c).toFixed(2));}s.prices=p;return s;}
function trade(s){if(!s.botEnabled||s.emergencyStop||!s.paperTrading)return status(s);for(const t of s.monitoredTokens){const p=Number(s.prices[t]||0),r=Number(s.referencePrices[t]||p),pos=s.positions[t]||{quantity:0,entryPrice:0};if(pos.quantity>0){const reason=p<=pos.entryPrice*(1-s.stopLossPercent/100)?'Stop loss triggered':p>=pos.entryPrice*(1+s.takeProfitPercent/100)?'Take profit triggered':p>=r*(1+s.sellConditionPercent/100)?'Sell condition triggered':'';if(reason){s.cashBalance+=pos.quantity*p;s.positions[t]={quantity:0,entryPrice:0};s.tradeHistory.unshift({timestamp:new Date().toISOString(),token:t,side:'SELL',price:p,amount:pos.quantity,reason});}continue;}if(p>0&&p<=r*(1-s.buyConditionPercent/100)&&s.cashBalance>=s.maxPurchaseAmount&&s.maxPurchaseAmount>0){const q=s.maxPurchaseAmount/p;s.cashBalance-=s.maxPurchaseAmount;s.positions[t]={quantity:q,entryPrice:p};s.tradeHistory.unshift({timestamp:new Date().toISOString(),token:t,side:'BUY',price:p,amount:q,reason:'Buy condition triggered'});}}s.tradeHistory=s.tradeHistory.slice(0,1000);return status(s);}
require('dotenv').config();
if(String(process.env.APP_MODE||'paper').toLowerCase()!=='paper'||String(process.env.PAPER_TRADING||'true').toLowerCase()!=='true')throw new Error('Safety lock: APP_MODE=paper and PAPER_TRADING=true are required.');
app.use(express.json({limit:'1mb'}));app.use(express.static(path.join(__dirname,'public')));
app.get('/api/health',(_q,r)=>r.json({ok:true,mode:'paper-trading',paperTrading:true}));
app.get('/api/dashboard',(_q,r)=>{const s=status(load());r.json({...s,monitoredTokens:tokens(s.monitoredTokens),tradeHistory:s.tradeHistory.slice(0,20)});});
app.get('/api/config',(_q,r)=>{const s=status(load());r.json({botEnabled:!!s.botEnabled,botStatus:s.botStatus,emergencyStop:!!s.emergencyStop,paperTrading:true,walletAddress:s.walletAddress,monitoredTokens:s.monitoredTokens,buyConditionPercent:s.buyConditionPercent,sellConditionPercent:s.sellConditionPercent,stopLossPercent:s.stopLossPercent,takeProfitPercent:s.takeProfitPercent,maxPurchaseAmount:s.maxPurchaseAmount});});
app.post('/api/config',(q,r)=>{const s=load(),i=q.body||{};const u={...s,walletAddress:typeof i.walletAddress==='string'?i.walletAddress.trim().slice(0,200):s.walletAddress,monitoredTokens:i.monitoredTokens===undefined?s.monitoredTokens:tokens(i.monitoredTokens),buyConditionPercent:number(i.buyConditionPercent,s.buyConditionPercent,0,100),sellConditionPercent:number(i.sellConditionPercent,s.sellConditionPercent,0,100),stopLossPercent:number(i.stopLossPercent,s.stopLossPercent,0,100),takeProfitPercent:number(i.takeProfitPercent,s.takeProfitPercent,0,1000),maxPurchaseAmount:number(i.maxPurchaseAmount,s.maxPurchaseAmount,0,1e8),paperTrading:true};status(u);save(u);r.json({ok:true,config:u});});
app.post('/api/toggle-bot',(q,r)=>{const s=load(),enabled=Boolean(q.body&&q.body.enabled!==undefined?q.body.enabled:!s.botEnabled);if(enabled&&s.emergencyStop)return r.status(409).json({error:'緊急停止中です。解除操作が必要です。'});s.botEnabled=enabled;save(status(s));r.json({ok:true,botEnabled:s.botEnabled,botStatus:s.botStatus});});
app.post('/api/emergency-stop',(_q,r)=>{const s=load();s.emergencyStop=true;s.botEnabled=false;save(status(s));r.json({ok:true,emergencyStop:true,botStatus:s.botStatus});});
app.post('/api/emergency-reset',(_q,r)=>{const s=load();s.emergencyStop=false;s.botEnabled=false;save(status(s));r.json({ok:true,emergencyStop:false,botStatus:s.botStatus});});
app.post('/api/refresh-prices',(_q,r)=>{const s=trade(refresh(load()));save(s);r.json({ok:true,prices:s.prices,positions:s.positions,tradeHistory:s.tradeHistory.slice(0,10)});});
app.get('/api/prices',(_q,r)=>{const s=load();r.json({prices:s.prices,monitoredTokens:s.monitoredTokens});});
app.get('/api/trades',(_q,r)=>r.json({tradeHistory:load().tradeHistory}));
app.get('/api/arc/status',async(q,r)=>{try{const s=load();const address=q.query.address||s.walletAddress; if(address&&!isAddress(address))return r.status(400).json({error:'Invalid EVM wallet address'});r.json(await getArcStatus(address));}catch(e){r.status(503).json({connected:false,error:e.message});}});
app.get('*',(_q,r)=>r.sendFile(path.join(__dirname,'public','index.html')));
setInterval(()=>{const s=load();if(s.botEnabled&&!s.emergencyStop)save(trade(refresh(s)));},30000);
app.listen(PORT,()=>console.log(`Arc paper trading dashboard running on http://localhost:${PORT}`));
module.exports={app,defaultConfig};
