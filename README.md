# Arc Paper Trading Bot

Arc EVMネットワークへ**読み取り専用**で接続する paper trading 管理アプリです。公開ウォレットアドレスのネイティブ残高と Arc の実際の Chain ID を JSON-RPC から取得します。秘密鍵の読み込み、署名、送金、実トランザクション送信は実装していません。

## セットアップ

`.env.example` を `.env` にコピーし、次を設定します。

```dotenv
APP_MODE=paper
PAPER_TRADING=true
ARC_RPC_URL=https://your-arc-rpc.example
ARC_NATIVE_SYMBOL=ARC
WALLET_ADDRESS=0x公開ウォレットアドレス
```

`WALLET_ADDRESS` は残高を読むだけの公開 EVM アドレスです。`PRIVATE_KEY` は不要で、設定しないでください。

## 起動

```bash
npm install
npm start
```

- Dashboard: `http://localhost:3000`
- Arc ウォレット状態: `GET /api/arc/status`
- 任意アドレスの残高確認: `GET /api/arc/status?address=0x...`

Arc API は `eth_chainId` と `eth_getBalance` のみを使用します。RPC の値が未設定・到達不能な場合は、アプリは paper trading を維持したまま Arc 接続を未接続として返します。

## Discord コマンド

- `/on`, `/off`, `/status` — 自動売買の ON/OFF と状態
- `/balance` — paper 残高と Arc ウォレットアドレス
- `/price` — 模擬価格
- `/conditions` — 買い・売り条件
- `/risk` — 損切り・利確
- `/history` — 取引履歴
- `/settings` — 監視トークン、条件、リスク設定
- `/stop`, `/reset-stop` — 緊急停止と解除

管理操作は Discord サーバーの Manage Guild 権限、または `DISCORD_ADMIN_USER_IDS` に登録したユーザーだ��が実行できます。

## 安全制約

- `APP_MODE=paper` と `PAPER_TRADING=true` が必須です。
- Arc 接続は読み取り専用です。
- 秘密鍵・署名機能・トランザクション送信機能はありません。
- 価格、残高、売買履歴は paper trading 用です。Arc の実残高は `/api/arc/status` の読み取り値として別途表示されます。
- Bot Token、秘密情報、秘密鍵を GitHub やチャットへ貼り付けず、Replit Secrets 等で管理してください。
