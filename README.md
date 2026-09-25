# Arc Paper Trading Bot / Discord Bot

Arc向け暗号資産自動売買アプリの安全な土台です。現在は **paper trading（模擬売買）専用** で、実際のブロックチェーン取引は実行しません。

## Discordコマンドについて

Discordのスラッシュコマンド名には英字を使用します。Discordの仕様上、`/残高` のような日本語を実際のコマンド名として登録することはできません。

ただし、説明・設定項目・返信は日本語です。Discordの候補一覧から選ぶと、日本語の説明を確認できます。

| コマンド | 日本語の意味 | 権限 |
| --- | --- | --- |
| `/status` | Botの状態を表示 | 全員 |
| `/on` | paper tradingを有効化 | 管理者 |
| `/off` | paper tradingを無効化 | 管理者 |
| `/balance` | paper残高を表示 | 全員 |
| `/price` | トークン価格を表示 | 全員 |
| `/settings` | paper trading設定を変更 | 管理者 |
| `/stop` | 緊急停止 | 管理者 |

使用例:

```text
/status
/balance
/price token:BTC
/settings key:買い条件 value:5
/settings key:監視トークン value:BTC,ETH,SOL
/stop
```

`/settings` の `key` は英語の内部値ではなく、日本語表示の選択肢から選びます。値は買い条件・売り条件・損切り・利確・最大購入額が数値、監視トークンがカンマ区切りです。

## 安全仕様

- Discordから操作できるのはpaper tradingの状態と設定だけです。
- 実際のブロックチェーントランザクション送信処理はありません。
- 返信は実行者だけに見えるephemeral形式です。
- `/on`、`/off`、`/settings`、`/stop` はDiscordサーバー管理権限、または `DISCORD_ADMIN_USER_IDS` に登録したユーザーだけが実行できます。
- 秘密鍵、シードフレーズ、取引所APIキーは不要です。チャットやGitHubに絶対に貼り付けないでください。
- 秘密情報を画面、Discord返信、ログ、取引履歴に表示しません。

## 起動方法

Node.js 18以上とnpmを使用します。

```bash
npm install
npm start
```

`npm start` でExpress管理画面とDiscord Botを同時に起動します。`DISCORD_BOT_TOKEN` が未設定の場合は管理画面だけ起動します。

別々に起動する場合:

```bash
npm run start:dashboard
npm run start:discord
```

管理画面:

```text
http://localhost:3000
```

## Discord Developer Portal

1. Discord Developer PortalでApplicationを作成
2. Botを追加
3. Bot TokenをReplit Secretsなどの環境変数に保存
4. OAuth2 URL Generatorで `bot` と `applications.commands` を選択
5. Botをサーバーへ招待

Bot TokenはGitHub、チャット、READMEへ登録しないでください。

## 環境変数

`.env.example` を参考に、Replit Secretsまたはホスティング環境へ設定します。

```text
PORT=3000
APP_MODE=paper
PAPER_TRADING=true
DISCORD_BOT_TOKEN=DiscordのBot Token
DISCORD_CLIENT_ID=Application ID
DISCORD_GUILD_ID=テスト用サーバーID（任意）
DISCORD_ADMIN_USER_IDS=あなたのDiscordユーザーID
DASHBOARD_URL=http://127.0.0.1:3000
```

- `DISCORD_GUILD_ID` を指定すると、テストサーバーにコマンドがすぐ反映されます。
- `DISCORD_ADMIN_USER_IDS` はカンマ区切りで複数指定できます。
- `DASHBOARD_URL` は同じプロセスで起動する場合、通常 `http://127.0.0.1:3000` です。

## Replitでの起動

1. GitHubからこのリポジトリをImport
2. Secretsに必要な環境変数を登録
3. Run commandを `npm start` に設定
4. Discord Developer PortalでBotをサーバーへ招待
5. Discordで `/status` を実行

## 管理画面

- 自動売買ON/OFF
- Bot稼働状態
- ウォレットアドレスとpaper残高
- 監視対象トークンと模擬価格
- 買い条件、売り条件、損切り、利確、最大購入額
- 模擬取引履歴
- 緊急停止

設定と取引履歴は `data/store.json` に保存されます。このファイルはGitへコミットしない設定です。

## 重要な注意

価格は模擬値です。実資産、ウォレット、秘密鍵、ブロックチェーン送信には接続していません。本番運用や実売買へ変更する場合は、paper/liveの分離、認証、権限管理、監査ログ、入力検証、テスト、停止手順を別途設計してください。
