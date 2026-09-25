# Arc Paper Trading Bot

Arc向けの読み取り専用ウォレット連携と、paper trading機能を備えたDiscordボットです。

## 文字化け対策

ソースコードと画面はUTF-8で保存してください。ReplitのShellでは次を実行します。

```bash
file -bi README.md discord-bot.js public/index.html
```

`charset=utf-8` と表示されることを確認してください。

## Replit Secrets

```dotenv
APP_MODE=paper
PAPER_TRADING=true
ARC_RPC_URL=https://your-arc-rpc.example
ARC_NATIVE_SYMBOL=ARC
WALLET_ADDRESS=0x公開ウォレットアドレス
DISCORD_BOT_TOKEN=Discord Bot Token
DISCORD_CLIENT_ID=Discord Application ID
DISCORD_GUILD_ID=Discord Server ID
DISCORD_ADMIN_USER_IDS=Discord User ID
DASHBOARD_URL=http://127.0.0.1:3000
```

価格オラクルを使う場合:

```dotenv
ARC_PRICE_ORACLES={"TOKEN":"0x価格オラクルアドレス"}
```

## 起動

```bash
npm install
npm start
```

`npm start` はDashboardとDiscord Botを起動します。`DISCORD_BOT_TOKEN` が未設定の場合はDashboardだけが起動します。

## Discordコマンド

- `/status` - 自動売買の状態
- `/on` / `/off` - paper tradingのON/OFF
- `/balance` - paper残高とArc残高
- `/price` - 価格と取引量
- `/add-token address:0x...` - Arc RPCからERC-20を追加
- `/chart token:SYMBOL` - チャート画像を投稿
- `/stop` - 緊急停止
- `/reset-stop` - 緊急停止を解除

`/add-token`、`/on`、`/off`、`/stop`、`/reset-stop` は、Manage Server権限または `DISCORD_ADMIN_USER_IDS` に登録したユーザーだけが実行できます。

## 重要な安全事項

- `APP_MODE=paper` と `PAPER_TRADING=true` が必須です。
- Arc RPCは読み取り専用です。
- 秘密鍵、署名、送金、実トランザクションは使用しません。
- `WALLET_ADDRESS` は公開アドレスだけを設定してください。
- Discord Tokenや秘密情報をGitHubへ保存しないでください。
- 価格履歴と取引履歴はpaper trading用です。
