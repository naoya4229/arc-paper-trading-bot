require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
} = require('discord.js');

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://127.0.0.1:3000';
const ADMIN_IDS = new Set(
  String(process.env.DISCORD_ADMIN_USER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),
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
  new SlashCommandBuilder().setName('status').setDescription('自動売買の状態を表示します'),
  new SlashCommandBuilder().setName('on').setDescription('paper tradingの自動売買をONにします'),
  new SlashCommandBuilder().setName('off').setDescription('paper tradingの自動売買をOFFにします'),
  new SlashCommandBuilder().setName('balance').setDescription('paper残高を表示します'),
  new SlashCommandBuilder()
    .setName('price')
    .setDescription('監視対象トークンの模擬価格を表示します')
    .addStringOption((option) => option.setName('token').setDescription('トークン名（省略可）').setRequired(false)),
  new SlashCommandBuilder().setName('conditions').setDescription('買い・売り条件を表示します'),
  new SlashCommandBuilder().setName('risk').setDescription('損切り・利確設定を表示します'),
  new SlashCommandBuilder()
    .setName('history')
    .setDescription('paper取引履歴を表示します')
    .addIntegerOption((option) => option.setName('count').setDescription('表示件数（1〜10）').setMinValue(1).setMaxValue(10).setRequired(false)),
  new SlashCommandBuilder()
    .setName('settings')
    .setDescription('paper tradingの設定を変更します')
    .addStringOption((option) => option
      .setName('key')
      .setDescription('変更する設定')
      .setRequired(true)
      .addChoices(
        { name: '監視トークン', value: 'monitoredTokens' },
        { name: '買い条件', value: 'buyThreshold' },
        { name: '売り条件', value: 'sellThreshold' },
        { name: '損切り率', value: 'stopLossPct' },
        { name: '利確率', value: 'takeProfitPct' },
      ))
    .addStringOption((option) => option.setName('value').setDescription('設定値').setRequired(true)),
  new SlashCommandBuilder().setName('stop').setDescription('自動売買を緊急停止します'),
  new SlashCommandBuilder().setName('reset-stop').setDescription('緊急停止を解除します（自動売買はOFFのまま）'),
].map((command) => command.toJSON());

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function api(endpoint, options = {}) {
  const response = await fetch(`${DASHBOARD_URL}${endpoint}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Dashboard API returned ${response.status}`);
  return data;
}

function privateReply(content) {
  return { content: String(content).slice(0, 1900), ephemeral: true };
}

function canManage(interaction) {
  return ADMIN_IDS.has(interaction.user.id)
    || Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild));
}

function pct(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(2)}%` : '未設定';
}

function safeAddress(address) {
  if (!address) return '未設定';
  return address.length > 18 ? `${address.slice(0, 8)}...${address.slice(-6)}` : address;
}

function formatConditions(data) {
  const tokens = (data.monitoredTokens || []).join(', ') || '未設定';
  return [
    '📋 **売買条件（paper trading）**',
    `監視対象: ${tokens}`,
    `買い条件: ${data.buyThreshold ?? '未設定'}`,
    `売り条件: ${data.sellThreshold ?? '未設定'}`,
    `損切り: ${pct(data.stopLossPct)}`,
    `利確: ${pct(data.takeProfitPct)}`,
    '※ 実トランザクションは送信されません。',
  ].join('\n');
}

client.once('ready', async (readyClient) => {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  const route = GUILD_ID
    ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
    : Routes.applicationCommands(CLIENT_ID);
  await rest.put(route, { body: commands });
  console.log(`Discord bot logged in as ${readyClient.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    const name = interaction.commandName;
    if (name === 'status') {
      const data = await api('/api/dashboard');
      return interaction.reply(privateReply([
        `状態: ${data.botStatus || 'Stopped'}`,
        `自動売買: ${data.botEnabled ? 'ON' : 'OFF'}`,
        `モード: ${data.paperTrading ? 'paper trading' : '停止'}`,
        `緊急停止: ${data.emergencyStop ? '有効' : '無効'}`,
      ].join('\n')));
    }

    if (name === 'balance') {
      const data = await api('/api/dashboard');
      return interaction.reply(privateReply([
        `💰 paper残高: ${Number(data.walletBalance || 0).toFixed(2)}`,
        `現金残高: ${Number(data.cashBalance || 0).toFixed(2)}`,
        `ウォレット: ${safeAddress(data.walletAddress)}`,
      ].join('\n')));
    }

    if (name === 'price') {
      const data = await api('/api/prices');
      const requested = interaction.options.getString('token')?.trim().toUpperCase();
      const values = requested ? { [requested]: data.prices?.[requested] } : data.prices;
      const lines = Object.entries(values || {}).map(([token, price]) => `${token}: ${Number(price).toFixed(6)}`);
      return interaction.reply(privateReply(`📈 **価格**\n${lines.length ? lines.join('\n') : '価格データなし'}`));
    }

    if (name === 'conditions' || name === 'risk') {
      const data = await api('/api/config');
      return interaction.reply(privateReply(name === 'risk'
        ? `🛡️ **リスク設定**\n損切り: ${pct(data.stopLossPct)}\n利確: ${pct(data.takeProfitPct)}\n※ paper trading専用です。`
        : formatConditions(data)));
    }

    if (name === 'history') {
      const data = await api('/api/trades');
      const count = interaction.options.getInteger('count') || 5;
      const history = (data.tradeHistory || []).slice(0, count);
      const lines = history.map((trade) => {
        const time = trade.timestamp ? new Date(trade.timestamp).toLocaleString('ja-JP') : '';
        return `${trade.side || trade.action || 'TRADE'} ${trade.token || ''} @ ${trade.price ?? '-'} ${time}`.trim();
      });
      return interaction.reply(privateReply(`🧾 **取引履歴**\n${lines.length ? lines.join('\n') : '履歴はありません'}`));
    }

    if (!canManage(interaction)) {
      return interaction.reply(privateReply('この操作にはDiscordサーバー管理権限、またはDISCORD_ADMIN_USER_IDSへの登録が必要です。'));
    }

    if (name === 'on' || name === 'off') {
      const data = await api('/api/toggle-bot', { method: 'POST', body: JSON.stringify({ enabled: name === 'on' }) });
      return interaction.reply(privateReply(`自動売買を${data.botEnabled ? 'ON' : 'OFF'}にしました。状態: ${data.botStatus}`));
    }

    if (name === 'stop') {
      await api('/api/emergency-stop', { method: 'POST' });
      return interaction.reply(privateReply('🚨 緊急停止しました。解除には /reset-stop が必要です。'));
    }

    if (name === 'reset-stop') {
      await api('/api/emergency-reset', { method: 'POST' });
      return interaction.reply(privateReply('緊急停止を解除しました。安全のため自動売買はOFFのままです。'));
    }

    if (name === 'settings') {
      const key = interaction.options.getString('key', true);
      const value = interaction.options.getString('value', true);
      const payload = key === 'monitoredTokens'
        ? { monitoredTokens: value.split(',').map((token) => token.trim().toUpperCase()).filter(Boolean) }
        : { [key]: value };
      await api('/api/config', { method: 'POST', body: JSON.stringify(payload) });
      return interaction.reply(privateReply(`設定を更新しました: ${key} = ${value}`));
    }
  } catch (error) {
    console.error(`Discord command failed: ${error.message}`);
    const reply = privateReply('処理に失敗しました。Dashboardが起動中か、設定値を確認してください。');
    if (interaction.replied || interaction.deferred) return interaction.followUp(reply);
    return interaction.reply(reply);
  }
});

client.login(TOKEN);
