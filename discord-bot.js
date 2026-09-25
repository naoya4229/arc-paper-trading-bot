const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits
} = require('discord.js');

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://127.0.0.1:3000';
const ADMIN_IDS = new Set(
  String(process.env.DISCORD_ADMIN_USER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
);

if (!TOKEN) {
  console.log('Discord bot disabled: DISCORD_BOT_TOKEN is not configured.');
  process.exit(0);
}

if (!CLIENT_ID) {
  console.error('DISCORD_CLIENT_ID is required when DISCORD_BOT_TOKEN is configured.');
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder().setName('status').setDescription('Botの稼働状態を表示します'),
  new SlashCommandBuilder().setName('on').setDescription('paper tradingを有効化します'),
  new SlashCommandBuilder().setName('off').setDescription('paper tradingを無効化します'),
  new SlashCommandBuilder().setName('balance').setDescription('paper残高を表示します'),
  new SlashCommandBuilder()
    .setName('price')
    .setDescription('監視対象トークンの模擬価格を表示します')
    .addStringOption((option) => option.setName('token').setDescription('トークン名。例: BTC').setRequired(false)),
  new SlashCommandBuilder()
    .setName('settings')
    .setDescription('paper tradingの設定を変更します')
    .addStringOption((option) => option.setName('key').setDescription('設定名').setRequired(true)
      .addChoices(
        { name: '買い条件', value: 'buyConditionPercent' },
        { name: '売り条件', value: 'sellConditionPercent' },
        { name: '損切り', value: 'stopLossPercent' },
        { name: '利確', value: 'takeProfitPercent' },
        { name: '最大購入額', value: 'maxPurchaseAmount' },
        { name: '監視トークン', value: 'monitoredTokens' }
      ))
    .addStringOption((option) => option.setName('value').setDescription('設定値').setRequired(true)),
  new SlashCommandBuilder().setName('stop').setDescription('緊急停止します')
].map((command) => command.toJSON());

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function api(path, options = {}) {
  const response = await fetch(`${DASHBOARD_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `Dashboard API error: ${response.status}`);
  return body;
}

function canManage(interaction) {
  if (ADMIN_IDS.has(interaction.user.id)) return true;
  return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild));
}

function privateReply(content) {
  return { content, ephemeral: true };
}

function safeAddress(address) {
  if (!address) return '未設定';
  return address.length > 18 ? `${address.slice(0, 8)}...${address.slice(-6)}` : address;
}

client.once('ready', async (readyClient) => {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  const route = GUILD_ID
    ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
    : Routes.applicationCommands(CLIENT_ID);
  await rest.put(route, { body: commands });
  console.log(`Discord bot logged in as ${readyClient.user.tag}`);
  console.log(`Slash commands registered${GUILD_ID ? ' for the configured guild' : ' globally'}.`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === 'status') {
      const data = await api('/api/dashboard');
      await interaction.reply(privateReply(
        `状態: ${data.botStatus}\nモード: ${data.paperTrading ? 'paper trading' : '停止'}\n緊急停止: ${data.emergencyStop ? 'ON' : 'OFF'}\nウォレット: ${safeAddress(data.walletAddress)}`
      ));
      return;
    }

    if (interaction.commandName === 'balance') {
      const data = await api('/api/dashboard');
      await interaction.reply(privateReply(`paper残高: ${Number(data.walletBalance || 0).toFixed(2)}\n現金残高: ${Number(data.cashBalance || 0).toFixed(2)}\nウォレット: ${safeAddress(data.walletAddress)}`));
      return;
    }

    if (interaction.commandName === 'price') {
      const data = await api('/api/prices');
      const requested = interaction.options.getString('token')?.toUpperCase();
      const prices = requested ? { [requested]: data.prices?.[requested] } : data.prices;
      const lines = Object.entries(prices || {})
        .filter(([, price]) => price !== undefined)
        .map(([token, price]) => `${token}: ${Number(price).toFixed(2)}`);
      await interaction.reply(privateReply(lines.length ? lines.join('\n') : '価格情報がありません。'));
      return;
    }

    if (!canManage(interaction)) {
      await interaction.reply(privateReply('この操作にはDiscordサーバー管理権限、またはDISCORD_ADMIN_USER_IDSへの登録が必要です。'));
      return;
    }

    if (interaction.commandName === 'on' || interaction.commandName === 'off') {
      const enabled = interaction.commandName === 'on';
      const data = await api('/api/toggle-bot', { method: 'POST', body: JSON.stringify({ enabled }) });
      await interaction.reply(privateReply(`paper tradingを${data.botEnabled ? 'ON' : 'OFF'}にしました。状態: ${data.botStatus}`));
      return;
    }

    if (interaction.commandName === 'stop') {
      await api('/api/emergency-stop', { method: 'POST' });
      await interaction.reply(privateReply('緊急停止しました。実売買は存在せず、paper tradingのみ停止します。'));
      return;
    }

    if (interaction.commandName === 'settings') {
      const key = interaction.options.getString('key', true);
      const value = interaction.options.getString('value', true);
      const payload = {};
      if (key === 'monitoredTokens') payload[key] = value.split(',').map((token) => token.trim()).filter(Boolean);
      else payload[key] = Number(value);
      if (key !== 'monitoredTokens' && !Number.isFinite(payload[key])) {
        await interaction.reply(privateReply('数値を入力してください。'));
        return;
      }
      await api('/api/config', { method: 'POST', body: JSON.stringify(payload) });
      await interaction.reply(privateReply(`設定を更新しました: ${key}`));
    }
  } catch (error) {
    console.error(`Discord command failed: ${error.message}`);
    if (interaction.replied || interaction.deferred) await interaction.followUp(privateReply('処理に失敗しました。秘密情報は表示していません。'));
    else await interaction.reply(privateReply('処理に失敗しました。秘密情報は表示していません。'));
  }
});

client.login(TOKEN);
