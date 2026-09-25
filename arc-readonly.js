require('dotenv').config();

const ARC_RPC_URL = String(process.env.ARC_RPC_URL || '').trim();
const DEFAULT_WALLET_ADDRESS = String(process.env.WALLET_ADDRESS || '').trim();
const ARC_NATIVE_SYMBOL = String(process.env.ARC_NATIVE_SYMBOL || 'ARC').trim() || 'ARC';
const RPC_TIMEOUT_MS = Number(process.env.ARC_RPC_TIMEOUT_MS || 10000);

function isAddress(value) {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}
function strip0x(value) { return String(value || '').replace(/^0x/i, ''); }
function word(hex, index = 0) { return strip0x(hex).slice(index * 64, (index + 1) * 64); }
function uint(hex, index = 0) { const value = word(hex, index); return value ? BigInt(`0x${value}`) : 0n; }
function decodeBytes32(hex) { return Buffer.from(word(hex), 'hex').toString('utf8').replace(/\0/g, '').trim(); }
function decodeDynamicString(hex) {
  const raw = strip0x(hex);
  if (raw.length < 128) return '';
  const offset = Number(BigInt(`0x${raw.slice(0, 64)}`)) * 2;
  if (!Number.isSafeInteger(offset) || raw.length < offset + 64) return '';
  const length = Number(BigInt(`0x${raw.slice(offset, offset + 64)}`));
  if (!Number.isSafeInteger(length) || length < 0) return '';
  return Buffer.from(raw.slice(offset + 64, offset + 64 + length * 2), 'hex').toString('utf8').replace(/\0/g, '').trim();
}
function decodeString(hex) {
  return decodeDynamicString(hex) || decodeBytes32(hex);
}
function decimalString(value, decimals) {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  if (!decimals) return `${negative ? '-' : ''}${absolute}`;
  const text = absolute.toString().padStart(decimals + 1, '0');
  return `${negative ? '-' : ''}${text.slice(0, -decimals)}.${text.slice(-decimals).replace(/0+$/, '') || '0'}`;
}
async function rpc(method, params = []) {
  if (!ARC_RPC_URL) throw new Error('ARC_RPC_URL is not configured');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
  try {
    const response = await fetch(ARC_RPC_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }), signal: controller.signal });
    if (!response.ok) throw new Error(`Arc RPC HTTP ${response.status}`);
    const body = await response.json();
    if (body.error) throw new Error(body.error.message || 'Arc RPC error');
    return body.result;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Arc RPC request timed out');
    throw error;
  } finally { clearTimeout(timer); }
}
async function ethCall(to, data) { return rpc('eth_call', [{ to, data }, 'latest']); }
async function readErc20(address) {
  if (!isAddress(address)) throw new Error('Invalid ERC-20 contract address');
  const [symbolRaw, nameRaw, decimalsRaw] = await Promise.all([
    ethCall(address, '0x95d89b41'),
    ethCall(address, '0x06fdde03'),
    ethCall(address, '0x313ce567'),
  ]);
  const decimals = Number(uint(decimalsRaw));
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) throw new Error('Contract does not expose ERC-20 decimals()');
  return { address, symbol: decodeString(symbolRaw) || 'TOKEN', name: decodeString(nameRaw) || 'Unknown token', decimals };
}
async function readChainlinkPrice(oracleAddress) {
  if (!isAddress(oracleAddress)) throw new Error('Invalid price oracle address');
  const decimalsRaw = await ethCall(oracleAddress, '0x313ce567');
  const decimals = Number(uint(decimalsRaw));
  let answer;
  try {
    // latestRoundData(): (roundId, answer, startedAt, updatedAt, answeredInRound)
    const round = await ethCall(oracleAddress, '0xfeaf968c');
    const answerWord = word(round, 1);
    answer = BigInt(`0x${answerWord}`);
    if (answerWord[0] >= '8') answer -= 1n << 256n;
  } catch {
    const latest = await ethCall(oracleAddress, '0x50d25bcd'); // latestAnswer()
    const answerWord = word(latest);
    answer = BigInt(`0x${answerWord}`);
    if (answerWord[0] >= '8') answer -= 1n << 256n;
  }
  if (answer <= 0n) throw new Error('Price oracle returned a non-positive price');
  const value = Number(decimalString(answer, decimals));
  if (!Number.isFinite(value)) throw new Error('Price oracle returned an invalid price');
  return value;
}
function formatNativeBalance(wei) { return decimalString(wei, 18); }
async function getArcStatus(address = DEFAULT_WALLET_ADDRESS) {
  const chainId = uint(await rpc('eth_chainId')).toString();
  const result = { connected: true, network: 'Arc', chainId, walletAddress: address || '', nativeSymbol: ARC_NATIVE_SYMBOL, balanceWei: null, balanceNative: null };
  if (address) {
    if (!isAddress(address)) throw new Error('WALLET_ADDRESS must be a valid EVM address');
    const wei = uint(await rpc('eth_getBalance', [address, 'latest']));
    result.balanceWei = wei.toString(); result.balanceNative = formatNativeBalance(wei);
  }
  return result;
}
module.exports = { getArcStatus, isAddress, readErc20, readChainlinkPrice, rpc };
