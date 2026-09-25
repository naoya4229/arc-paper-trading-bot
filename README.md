# Discord Bot起動

このリポジトリには、paper trading管理画面に接続するDiscord Botを含めています。

## Discord Botの安全仕様

- Discordから操作できるのはpaper tradingの状態・設定だけです。
- 実際のブロックチェーントランザクション送信処理はありません。
- `/status`、`/balance`、`/price` は全ユーザーが利用できます。
- `/on`、`/off`、`/settings`、`/stop` はDiscordサーバー管理権限、または `DISCORD_ADMIN_USER_IDS` に登録されたユーザーだけが利用できます。
- Discordの返信はephemeral（実行者だけに表示）です。
- 秘密鍵はBotへ渡す必要がなく、画面・返信・ログにも出しません。

## 必要環境

- Node.js 18以上（`fetch`を使用します）
- npm
- Discord Developer Portalで作成したBot

## 起動手順

### 1. Discord Applicationを作成

1. Discord Developer PortalでNew Applicationを作成
2. BotページでBotを追加
3. Bot Tokenを再生成して、Replit Secretsなどの環境変数に保存
4. OAuth2 URL Generatorで `bot` と `applications.commands` を選択
5. Bot権限は最低限 `Send Messages` を付与してサーバーへ招待

Bot TokenはGitHub、チャット、READMEへ貼り付けないでください。

### 2. 環境変数を設定

`.env.example` を参考に、Replit Secretsまたはホスティング環境の環境変数へ登録します。

```text
PORT=3000
APP_MODE=paper
PAPER_TRADING=true
DISCORD_BOT_TOKEN=DiscordのBot Token
DISCORD_CLIENT_ID=Application ID
DISCORD_GUILD_ID=テスト用サーバーID（任意。指定するとコマンド反映が速い）
DISCORD_ADMIN_USER_IDS=あなたのDiscordユーザーID
DASHBOARD_URL=http://127.0.0.1:3000
```

`DISCORD_ADMIN_USER_IDS` はカンマ区切りで複数指定できます。空欄の場合、変更系コマンドはDiscordサーバーのManage Server権限が必要です。

秘密鍵、シードフレーズ、取引所APIキーは設定しないでください。現在のアプリは実売買をしないため不要です。

### 3. 起動

```bash
npm install
npm start
```

`npm start` はExpress管理画面とDiscord Botを同時に起動します。Bot Tokenが未設定の場合、管理画面だけ起動します。

別々に起動する場合:

```bash
npm run start:dashboard
npm run start:discord
```

管理画面:

```text
http://localhost:3000
```

## Discordコマンド

Discordの仕様上、コマンド名は英字にしています。

- `/status` — Bot状態、paperモード、ウォレット表示
- `/on` — paper tradingをON
- `/off` — paper tradingをOFF
- `/balance` — paper残高と現金残高
- `/price token:BTC` — 模擬価格
- `/settings` — 買い条件、売り条件、損切り、利確、最大購入額、監視トークンを変更
- `/stop` — paper tradingの緊急停止

日本語名の `/残高` などが必要な場合は、Discordのコマンド名制約上、英字コマンドへのローカライズ表示を使う構成に変更してください。

## Replitでの起動

1. GitHubからこのリポジトリをImport
2. Secretsに上記の環境変数を登録
3. Run commandを `npm start` に設定
4. Discord Developer PortalでBotをサーバーへ招待
5. Discordで `/status` を実行

`DASHBOARD_URL` は同じReplitプロセスで起動する場合、`http://127.0.0.1:3000` のままで動作します。

## paper tradingの注意

価格は模擬値です。BotをONにすると一定間隔で模擬価格が変化し、条件に一致した場合だけJSON上の模擬取引履歴が更新されます。実資産、ウォレット、秘密鍵、ブロックチェーン送信には接続していません。
