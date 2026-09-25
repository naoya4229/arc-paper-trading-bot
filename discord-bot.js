require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const TOKEN=process.env.DISCORD_BOT_TOKEN; const CLIENT_ID=process.env.DISCORD_CLIENT_ID; const GUILD_ID=process.env.DISCORD_GUILD_ID; const DASHBOARD_URL=(process.env.DASHBOARD_URL||'http://127.0.0.1:3000').replace(/\/$/,'');
const ADMINS=new Set(String(process.env.DISCORD_ADMIN_USER_IDS||'').split(',').map(x=>x.trim()).filter(Boolean));
if(!TOKEN){console.log('Discord bot disabled: DISCORD_BOT_TOKEN is not configured.');process.exit(0);} if(!CLIENT_ID){console.error('DISCORD_CLIENT_ID is required.');process.exit(1);}
const commands=[
 new SlashCommandBuilder().setName('status').setDescription('自動売買の状態'),new SlashCommandBuilder().setName('on').setDescription('自動売買ON'),new SlashCommandBuilder().setName('off').setDescription('自動売買OFF'),new SlashCommandBuilder().setName('balance').setDescription('残高'),
 new SlashCommandBuilder().setName('price').setDescription('価格').addStringOption(o=>o.setName('token').setDescription('シンボル').setRequired(false)),
 new SlashCommandBuilder().setName('chart').setDescription('価格チャート画像').addStringOption(o=>o.setName('token').setDescription('監視対象シンボル').setRequired(true)),
 new SlashCommandBuilder().setName('add-token').setDescription('Arc RPCでERC-20を追加').addStringOption(o=>o.setName('address').setDescription('0xコントラクトアドレス').setRequired(true)).addStringOption(o=>o.setName('symbol').setDescription('表示シンボル（任意）').setRequired(false)),
 new SlashCommandBuilder().setName('stop').setDescription('緊急停止'),new SlashCommandBuilder().setName('reset-stop').setDescription('緊急停止解除'),
].map(c=>c.toJSON());
const client=new Client({intents:[GatewayIntentBits.Guilds]});
async function api(endpoint,options={}){const response=await fetch(`${DASHBOARD_URL}${endpoint}`,{...options,headers:{'content-type':'application/json',...(options.headers||{})}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||`Dashboard API ${response.status}`);return data;}
function canManage(i){return ADMINS.has(i.user.id)||Boolean(i.memberPermissions?.has(PermissionFlagsBits.ManageGuild));}
function privateReply(content){return{content:String(content).slice(0,1900),ephemeral:true};}
async function sendChart(i,symbol){await i.deferReply({ephemeral:true});const response=await fetch(`${DASHBOARD_URL}/api/token/${encodeURIComponent(symbol.toUpperCase())}/chart.svg`);if(!response.ok)throw new Error(await response.text());const image=Buffer.from(await response.arrayBuffer());return i.editReply({content:`📊 ${symbol.toUpperCase()} / Arc paper chart`,files:[new AttachmentBuilder(image,{name:`${symbol.toLowerCase()}-chart.svg`})]});}
client.once('ready',async c=>{try{const rest=new REST({version:'10'}).setToken(TOKEN);await rest.put(GUILD_ID?Routes.applicationGuildCommands(CLIENT_ID,GUILD_ID):Routes.applicationCommands(CLIENT_ID),{body:commands});console.log(`Discord bot logged in as ${c.user.tag}`);}catch(e){console.error(`Discord command registration failed: ${e.message}`);}});
client.on('interactionCreate',async i=>{if(!i.isChatInputCommand())return;try{const n=i.commandName;
 if(n==='chart')return sendChart(i,i.options.getString('token',true));
 if(n==='price'){const d=await api('/api/prices');const q=i.options.getString('token')?.toUpperCase();const list=q?[[q,d.prices?.[q]]]:Object.entries(d.prices||{});return i.reply(privateReply(list.map(([t,p])=>`${t}: ${p??'未設定'} / volume ${Number(d.volumes?.[t]||0).toLocaleString()}`).join('\n')||'データな��'));}
 if(n==='add-token'){if(!canManage(i))return i.reply(privateReply('管理権限が必要です。'));const d=await api('/api/tokens/import',{method:'POST',body:JSON.stringify({address:i.options.getString('address',true),symbol:i.options.getString('symbol')||undefined})});return i.reply(privateReply(`✅ ${d.token} を追加しました\nContract: ${d.contractAddress}\n${d.meta.name} / decimals ${d.meta.decimals}\n価格: ${d.price??'未設定（ARC_PRICE_ORACLESを設定）'}`));}
 if(n==='status'){const d=await api('/api/dashboard');return i.reply(privateReply(`状態: ${d.botStatus}\n自動売買: ${d.botEnabled?'ON':'OFF'}\n緊急停止: ${d.emergencyStop?'有効':'無効'}`));}
 if(n==='balance'){const d=await api('/api/dashboard');const a=await api('/api/arc/status').catch(e=>({error:e.message}));return i.reply(privateReply(`paper残高: ${Number(d.cashBalance||0).toFixed(2)}\nArc残高: ${a.error||`${a.balanceNative??'-'} ${a.nativeSymbol||''}`}`));}
 if(!canManage(i))return i.reply(privateReply('管理権限が必要です。'));
 if(n==='on'||n==='off'){const d=await api('/api/toggle-bot',{method:'POST',body:JSON.stringify({enabled:n==='on'})});return i.reply(privateReply(`自動売買を${d.botEnabled?'ON':'OFF'}にしました。`));}
 if(n==='stop'){await api('/api/emergency-stop',{method:'POST'});return i.reply(privateReply('🚨 緊急停止しました。'));}
 if(n==='reset-stop'){await api('/api/emergency-reset',{method:'POST'});return i.reply(privateReply('緊急停止を解除しました。自動売買はOFFです。'));}
 }catch(error){console.error(`Discord command failed: ${error.message}`);if(i.deferred||i.replied)return i.editReply({content:`処理に失敗しました: ${error.message}`,files:[]});return i.reply(privateReply(`処理に失敗しました: ${error.message}`));}});
client.login(TOKEN).catch(error=>{console.error(`Discord login failed: ${error.message}`);process.exitCode=1;});
