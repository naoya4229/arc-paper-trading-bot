const { spawn } = require('child_process');
require('dotenv').config();
const children = [];
function shutdown(code = 0) { for (const child of children) if (!child.killed) child.kill('SIGTERM'); process.exitCode = code; }
const dashboard = spawn(process.execPath, ['server.js'], { stdio: 'inherit', env: process.env });
children.push(dashboard);
dashboard.on('exit', (code) => { if (code !== 0) { console.error(`Dashboard stopped with code ${code || 'unknown'}.`); shutdown(code || 1); } });
if (process.env.DISCORD_BOT_TOKEN) children.push(spawn(process.execPath, ['discord-bot.js'], { stdio: 'inherit', env: process.env }));
else console.log('Discord bot is disabled: DISCORD_BOT_TOKEN is not configured.');
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
