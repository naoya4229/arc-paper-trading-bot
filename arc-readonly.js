require('dotenv').config();

const ARC_RPC_URL = String(process.env.ARC_RPC_URL || '').trim();
const DEFAULT_WALLET_ADDRESS = String(process.env.WALLET_ADDRESS || '').trim();
const ARC_NATIVE_SYMBOL = String(process.env.ARC_NATIVE_SYMBOL || 'ARC').trim() || 'ARC';
const RPC_TIMEOUT_MS = Number(process.env.ARC_RPC_TIMEOUT_MS || 10000);

function isAddress(address) {
  return typeof address === 'string' && /^0x[a-fA-F0-9]{40}$/.test(address.trim());
}

async function rpc(method, params = []) {
  if (!ARC_RPC_URL) throw new Error('ARC_RPC_URL is not configured');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
  try {
    const response = await fetch(ARC_RPC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Arc RPC HTTP ${response.status}`);
    const body = await response.json();
    if (body.error) throw new Error(body.error.message || 'Arc RPC error');
    return body.result;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Arc RPC request timed out');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function hexToBigInt(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-f]+$/i.test(value)) throw new Error('Invalid hexadecimal RPC value');
  return BigInt(value);
}

function formatNativeBalance(wei) {
  const whole = wei / 1000000000000000000n;
  const fraction = (wei % 1000000000000000000n).toString().padStart(18, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

async function getArcStatus(address = DEFAULT_WALLET_ADDRESS) {
  const chainIdHex = await rpc('eth_chainId');
  const chainId = hexToBigInt(chainIdHex).toString();
  const result = {
    connected: true,
    network: 'Arc',
    chainId,
    walletAddress: address || '',
    nativeSymbol: ARC_NATIVE_SYMBOL,
    balanceWei: null,
    balanceNative: null,
  };
  if (!address) return result;
  if (!isAddress(address)) throw new Error('WALLET_ADDRESS must be a valid EVM address');
  const balanceWei = hexToBigInt(await rpc('eth_getBalance', [address, 'latest']));
  result.balanceWei = balanceWei.toString();
  result.balanceNative = formatNativeBalance(balanceWei);
  return result;
}

module.exports = { getArcStatus, isAddress, rpc };
