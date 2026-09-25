require('dotenv').config();

const ARC_RPC_URL = String(process.env.ARC_RPC_URL || '').trim();
const DEFAULT_WALLET_ADDRESS = String(process.env.WALLET_ADDRESS || '').trim();
const ARC_NATIVE_SYMBOL = String(process.env.ARC_NATIVE_SYMBOL || 'ARC').trim() || 'ARC';
const RPC_TIMEOUT_MS = Number(process.env.ARC_RPC_TIMEOUT_MS || 10000);

function isAddress(value) { return typeof value === 'string' && /^0x[a-f-f0-9]{40}$/i.test(value.trim()); }
function stripHex(value) { return String(value || '').replace(/^0x/, ''); }
function hexBigInt(value) { return BigInt(`0x${stripHex(value) || '0'}`); }
function decodeUint(value) { return Number(hexBigInt(value)); }
function decodeString(value) {
  const hex = stripHex(value);
  if (!hex) return '';
  try {
    const offset = Number(BigInt(`0x${hex.slice(0, 64)}`)) * 2;
    const length = Number(BigInt(`0x${hex.slice(offset, offset + 64)}`)) * 2;
    return Buffer.from(hex.slice(offset + 64, offset + 64 + length), 'hex').toString('utf8').replace(/\0/g, '');
  } catch { return ''; }
}
async function rpc(method, params = []) {
  if (!ARC_RPC_URL) throw new Error('ARC_RPC_URL is not configured');
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
  try {
    const response = await fetch(ARC_RPC_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }), signal: controller.signal });
    if (!response.ok) throw new Error(`Arc RPC HTTP ${response.status}`);
    const body = await response.json(); if (body.error) throw new Error(body.error.message || 'Arc RPC error'); return body.result;
  } catch (error) { if (error.name === 'AbortError') throw new Error('Arc RPC request timed out'); throw error; } finally { clearTimeout(timer); }
}
async function ethCall(to, data) { return rpc('eth_call', [{ to, data }, 'latest']); }
function encodeAddress(address) { return `${'0'.repeat(24)}${stripHex(address).toLowerCase()}`; }
async function readErc20(address) {
  if (!isAddress(address)) throw new Error('Invalid ERC-20 contract address');
  const [symbolRaw, nameRaw, decimalsRaw] = await Promise.all([
    ethCall(address, '0x95d89b41').catch(() => '0x'),
    ethCall(address, '0x06fdde03').catch(() => '0x'),
    ethCall(address, '0x313ce567').catch(() => '0x'),
  ]);
  return { address, symbol: decodeString(symbolRaw) || 'TOKEN', name: decodeString(nameRaw) || 'Unknown token', decimals: decimalsRaw && decimalsRaw !== '0x' ? decodeUint(decimalsRaw) : 18 };
}
async function readChainlinkPrice(oracleAddress) {
  if (!isAddress(oracleAddress)) throw new Error('Invalid price oracle address');
  const [answerRaw, decimalsRaw] = await Promise.all([ethCall(oracleAddress, '0xfeaf968c'), ethCall(oracleAddress, '0x313ce567')]);
  const answer = hexBigInt(answerRaw); const decimals = decodeUint(decimalsRaw); return Number(answer) / (10 ** decimals);
}
function formatNativeBalance(wei) { const whole = wei / 1000000000000000000n; const fraction = (wei % 1000000000000000000n).toString().padStart(18, '0').replace(/0+$/, ''); return fraction ? `${whole}.${fraction}` : whole.toString(); }
async function getArcStatus(address = DEFAULT_WALLET_ADDRESS) {
  const chainId = hexBigInt(await rpc('eth_chainId')).toString(); const result = { connected: true, network: 'Arc', chainId, walletAddress: address || '', nativeSymbol: ARC_NATIVE_SYMBOL, balanceWei: null, balanceNative: null };
  if (address) { if (!isAddress(address)) throw new Error('WALLET_ADDRESS must be a valid EVM address'); const wei = hexBigInt(await rpc('eth_getBalance', [address, 'latest'])); result.balanceWei = wei.toString(); result.balanceNative = formatNativeBalance(wei); }
  return result;
}
module.exports = { getArcStatus, isAddress, readErc20, readChainlinkPrice, rpc, encodeAddress };
