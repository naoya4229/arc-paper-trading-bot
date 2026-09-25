require('dotenv').config();

const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://127.0.0.1:3000';
const ADMIN_IDS = new Set(String(process.env.DISCORD_ADMIN_USER_IDS || '').split(',').map((id) => id.trim()).filter(Boolean));

if (!TOKEN) { console.log('Discord bot disabled: DISCORD_BOT_TOKEN is not configured.'); process.exit(0); }
if (!CLIENT_ID) { console.error('DISCORD_CLIENT_ID is required when DISCORD_BOT_TOKEN is configured.'); process.exit(1); }

const commands = [
  new SlashCommandBuilder().setName('status').setDescription('Botの稼働状態を表示します'),
  new SlashCommandBuilder().setName('on').setDescription('paper tradingを有効化します'),
  new SlashCommandBuilder().setName('off').setDescription('paper tradingを無効化します'),
  new SlashCommandBuilder().setName('balance').setDescription('paper残高を表示します'),
  new SlashCommandBuilder().setName('price').setDescription('監視対象トークンの模擬価格を表示します').addStringOption((o) => o.setName('token').setDescription('トークン名。例: BTC').setRequired(false)),
  new SlashCommandBuilder().setName('settings').setDescription('paper tradingの設定を変更します').addStringOption((o) => o.setName('key').setDescription('変更する設定').setRequired(true).addChoices({ name: '買い条件', value: 'buyConditionPercent' }, { name: '売り条件', value: 'sellConditionPercent' }, { name: '損切り', value: 'stopLossPercent' }, { name: '利確', value: 'takeProfitPercent' }, { name: '最大購入額', value: 'maxPurchaseAmount' }, { name: '監視トークン', value: 'monitoredTokens' })).addStringOption((o) => o.setName('value').setDescription('設定値').setRequired(true)),
  new SlashCommandBuilder().setName('stop').setDescription('paper tradingを緊急停止します'),
  new SlashCommandBuilder().setName('reset-stop').setDescription('緊急停止を解除します')
].map((command) => command.toJSON());

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
async function api(endpoint, options = {}) { const response = await fetch(`${DASHBOARD_URL}${endpoint}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } }); const body = await response.json(); if (!response.ok) throw new Error(body.error || `Dashboard API error: ${response.status}`); return body; }
function canManage(interaction) { return ADMIN_IDS.has(interaction.user.id) || Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)); }
function privateReply(content) { return { content, ephemeral: true }; }
function safeAddress(address) { if (!address) return '未設定'; return address.length > 18 ? `${address.slice(0, 8)}...${address.slice(-6)}` : address; }

client.once('ready', async (readyClient) => { const rest = new REST({ version: '10' }).setToken(TOKEN); const route = GUILD_ID ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID) : Routes.applicationCommands(CLIENT_ID); await rest.put(route, { body: commands }); console.log(`Discord bot logged in as ${readyClient.user.tag}`); console.log(`Slash commands registered${GUILD_ID ? ' for the configured guild' : ' globally'}.`); });
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  try {
    if (interaction.commandName === 'status') { const d = await api('/api/dashboard'); return interaction.reply(privateReply(`状態: ${d.botStatus}\nモード: paper trading\n緊急停止: ${d.emergencyStop ? 'ON' : 'OFF'}\nウォレット: ${safeAddress(d.walletAddress)}`)); }
    if (interaction.commandName === 'balance') { const d = await api('/api/dashboard'); return interaction.reply(privateReply(`paper残高: ${Number(d.walletBalance || 0).toFixed(2)}\n現金残高: ${Number(d.cashBalance || 0).toFixed(2)}\nウォレット: ${safeAddress(d.walletAddress)}`)); }
    if (interaction.commandName === 'price') { const d = await api('/api/prices'); const requested = interaction.options.getString('token')?.toUpperCase(); const values = requested ? { [requested]: d.prices?.[requested] } : d.prices; const lines = Object.entries(values || {}).filter(([, p]) => p !== undefined).map(([token, price]) => `${token}: ${Number(price).toFixed(2)}`); return interaction.reply(privateReply(lines.length ? lines.join('\n') : '価格情報がありません。')); }
    if (!canManage(interaction)) return interaction.reply(privateReply('この操作にはDiscordサーバー管理権限、またはDISCORD_ADMIN_USER_IDSへの登録が必要です。'));
    if (interaction.commandName === 'on' || interaction.commandName === 'off') { const d = await api('/api/toggle-bot', { method: 'POST', body: JSON.stringify({ enabled: interaction.commandName === 'on' }) }); return interaction.reply(privateReply(`paper tradingを${d.botEnabled ? 'ON' : 'OFF'}にしました。状態: ${d.botStatus}`)); }
    if (interaction.commandName === 'stop') { await api('/api/emergency-stop', { method: 'POST' }); return interaction.reply(privateReply('緊急停止しました。解除には /reset-stop が必要です。')); }
    if (interaction.commandName === 'reset-stop') { await api('/api/emergency-reset', { method: 'POST' }); return interaction.reply(privateReply('緊急停止を解除しました。BotはOFFのままです。必要なら /on で再開できます。')); }
    if (interaction.commandName === 'settings') { const key = interaction.options.getString('key', true); const value = interaction.options.getString('value', true); const payload = key === 'monitoredTokens' ? { [key]: value.split(',').map((t) => t.trim()).filter(Boolean) } : { [key]: Number(value) }; if (key !== 'monitoredTokens' && !Number.isFinite(payload[key])) return interaction.reply(privateReply('数値を入力してください。')); await api('/api/config', { method: 'POST', body: JSON.stringify(payload) }); return interaction.reply(privateReply(`設定を更新しました: ${key}`)); }
  } catch (error) { console.error(`Discord command failed: ${error.message}`); const reply = privateReply('処理に失敗しました。秘密情報は表示していません。'); if (interaction.replied || interaction.deferred) await interaction.followUp(reply); else await interaction.reply(reply); }
});
client.login(TOKEN);
