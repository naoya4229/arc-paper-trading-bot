require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  AttachmentBuilder,
} = require('discord.js');

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const DASHBOARD_URL = (process.env.DASHBOARD_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const ADMIN_IDS = new Set(
  String(process.env.DISCORD_ADMIN_USER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),
);

if (!TOKEN) {
  console.log('Discord Bot disabled: DISCORD_BOT_TOKEN is not configured.');
  process.exit(0);
}
if (!CLIENT_ID) {
  console.error('DISCORD_CLIENT_ID is required.');
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder().setName('status').setDescription('自動売買の状態を表示'),
  new SlashCommandBuilder().setName('on').setDescription('自動売買をONにする'),
  new SlashCommandBuilder().setName('off').setDescription('自動売買をOFFにする'),
  new SlashCommandBuilder().setName('balance').setDescription('paper残高とArc残高を表示'),
  new SlashCommandBuilder()
    .setName('price')
    .setDescription('価格と取引量を表示')
    .addStringOption((option) => option.setName('token').setDescription('トークン名').setRequired(false)),
  new SlashCommandBuilder()
    .setName('chart')
    .setDescription('価格チャート画像を表示')
    .addStringOption((option) => option.setName('token').setDescription('監視対象トークン').setRequired(true)),
  new SlashCommandBuilder()
    .setName('add-token')
    .setDescription('Arc RPCからERC-20トークンを追加')
    .addStringOption((option) => option.setName('address').setDescription('0xから始まるコントラクトアドレス').setRequired(true))
    .addStringOption((option) => option.setName('symbol').setDescription('表示シンボル（任意）').setRequired(false)),
  new SlashCommandBuilder().setName('stop').setDescription('緊急停止'),
  new SlashCommandBuilder().setName('reset-stop').setDescription('緊急停止を解除'),
].map((command) => command.toJSON());

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function api(endpoint, options = {}) {
  const response = await fetch(`${DASHBOARD_URL}${endpoint}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Dashboard API ${response.status}`);
  return data;
}

function canManage(interaction) {
  return ADMIN_IDS.has(interaction.user.id)
    || Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild));
}

function reply(content) {
  return { content: String(content).slice(0, 1900), ephemeral: true };
}

async function sendChart(interaction, symbol) {
  await interaction.deferReply({ ephemeral: true });
  const response = await fetch(`${DASHBOARD_URL}/api/token/${encodeURIComponent(symbol)}/chart.svg`);
  if (!response.ok) throw new Error(await response.text());
  const image = Buffer.from(await response.arrayBuffer());
  return interaction.editReply({
    content: `📊 ${symbol} / Arc paper chart`,
    files: [new AttachmentBuilder(image, { name: `${symbol.toLowerCase()}-chart.svg` })],
  });
}

client.once('ready', async (readyClient) => {
  try {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    const route = GUILD_ID
      ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
      : Routes.applicationCommands(CLIENT_ID);
    await rest.put(route, { body: commands });
    console.log(`Discord Bot logged in as ${readyClient.user.tag}`);
  } catch (error) {
    console.error(`Discord command registration failed: ${error.message}`);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  try {
    const command = interaction.commandName;

    if (command === 'chart') {
      return sendChart(interaction, interaction.options.getString('token', true).trim().toUpperCase());
    }

    if (command === 'price') {
      const data = await api('/api/prices');
      const requested = interaction.options.getString('token')?.trim().toUpperCase();
      const entries = requested ? [[requested, data.prices?.[requested]]] : Object.entries(data.prices || {});
      const text = entries
        .map(([token, price]) => `${token}: ${price ?? '未設定'} / 取引量 ${Number(data.volumes?.[token] || 0).toLocaleString('ja-JP')}`)
        .join('\n') || '価格データがありません。';
      return interaction.reply(reply(text));
    }

    if (command === 'add-token') {
      if (!canManage(interaction)) return interaction.reply(reply('この操作には管理権限が必要です。'));
      const data = await api('/api/tokens/import', {
        method: 'POST',
        body: JSON.stringify({
          address: interaction.options.getString('address', true),
          symbol: interaction.options.getString('symbol') || undefined,
        }),
      });
      return interaction.reply(reply([
        `✅ ${data.token} を追加しました。`,
        `コントラクト: ${data.contractAddress}`,
        `名称: ${data.meta.name}`,
        `Decimals: ${data.meta.decimals}`,
        `価格: ${data.price ?? '未設定（ARC_PRICE_ORACLESを設定してください）'}`,
      ].join('\n')));
    }

    if (command === 'status') {
      const data = await api('/api/dashboard');
      return interaction.reply(reply([
        `状態: ${data.botStatus}`,
        `自動売買: ${data.botEnabled ? 'ON' : 'OFF'}`,
        `緊急停止: ${data.emergencyStop ? '有効' : '無効'}`,
      ].join('\n')));
    }

    if (command === 'balance') {
      const data = await api('/api/dashboard');
      const arc = await api('/api/arc/status').catch((error) => ({ error: error.message }));
      return interaction.reply(reply([
        `paper残高: ${Number(data.cashBalance || 0).toFixed(2)}`,
        `Arc残高: ${arc.error || `${arc.balanceNative ?? '-'} ${arc.nativeSymbol || ''}`}`,
        `ウォレット: ${data.walletAddress || '未設定'}`,
      ].join('\n')));
    }

    if (!canManage(interaction)) return interaction.reply(reply('この操作には管理権限が必要です。'));

    if (command === 'on' || command === 'off') {
      const data = await api('/api/toggle-bot', {
        method: 'POST',
        body: JSON.stringify({ enabled: command === 'on' }),
      });
      return interaction.reply(reply(`自動売買を${data.botEnabled ? 'ON' : 'OFF'}にしました。`));
    }
    if (command === 'stop') {
      await api('/api/emergency-stop', { method: 'POST' });
      return interaction.reply(reply('🚨 緊急停止しました。'));
    }
    if (command === 'reset-stop') {
      await api('/api/emergency-reset', { method: 'POST' });
      return interaction.reply(reply('緊急停止を解除しました。自動売買はOFFです。'));
    }
  } catch (error) {
    console.error(`Discord command failed: ${error.message}`);
    if (interaction.deferred || interaction.replied) return interaction.editReply({ content: `処理に失敗しました: ${error.message}`, files: [] });
    return interaction.reply(reply(`処理に失敗しました: ${error.message}`));
  }
});

client.login(TOKEN).catch((error) => {
  console.error(`Discord login failed: ${error.message}`);
  process.exitCode = 1;
});
