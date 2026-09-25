require('dotenv').config();

const ARC_RPC_URL = process.env.ARC_RPC_URL || '';
const WALLET_ADDRESS = process.env.WALLET_ADDRESS || '';

function isAddress(address) {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

async function rpc(method, params = []) {
  if (!ARC_RPC_URL) throw new Error('ARC_RPC_URL is not configured');
  const response = await fetch(ARC_RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params })
  });
  if (!response.ok) throw new Error(`Arc RPC HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(body.error.message || 'Arc RPC error');
  return body.result;
}

function hexToDecimal(hex) {
  return BigInt(hex).toString();
}

async function getArcStatus(address = WALLET_ADDRESS) {
  const chainIdHex = await rpc('eth_chainId');
  const result = { connected: true, chainId: hexToDecimal(chainIdHex), walletAddress: address || '', balanceWei: null, balanceNative: null };
  if (address) {
    if (!isAddress(address)) throw new Error('WALLET_ADDRESS must be a valid EVM address');
    const balanceHex = await rpc('eth_getBalance', [address, 'latest']);
    const wei = BigInt(balanceHex);
    result.balanceWei = wei.toString();
    result.balanceNative = `${Number(wei) / 1e18}`;
  }
  return result;
}

module.exports = { getArcStatus, isAddress };
