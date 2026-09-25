const { spawn } = require('child_process');

const children = [];

function start(name, script) {
  const child = spawn(process.execPath, [script], {
    stdio: 'inherit',
    env: process.env
  });

  child.on('exit', (code, signal) => {
    if (name === 'dashboard' && code !== 0) {
      console.error(`Dashboard stopped with code ${code || 'unknown'}${signal ? ` (${signal})` : ''}.`);
      shutdown(code || 1);
    }
  });

  children.push(child);
}

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  process.exitCode = code;
}

start('dashboard', 'server.js');

if (process.env.DISCORD_BOT_TOKEN) {
  start('discord', 'discord-bot.js');
} else {
  console.log('Discord bot is disabled: DISCORD_BOT_TOKEN is not configured.');
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
