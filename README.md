# Arc Paper Trading Bot

Arc向けのpaper trading専用アプリです。Arcチェーンは**読み取り専用**で接続し、RPCからChain IDとネイティブ残高を取得します。実トランザクション、秘密鍵、シードフレーズは使用しません。

## Arc設定

`.env.example`または`.env.arc.example`を参考に、Replit Secretsへ設定してください。

```text
APP_MODE=paper
PAPER_TRADING=true
ARC_RPC_URL=Arcの読み取り用JSON-RPC URL
WALLET_ADDRESS=残高を確認するEVMウォレットアドレス
```

`ARC_CHAIN_ID`は表示・設定確認用の任意値です。実際のChain IDは起動時にArc RPCの`eth_chainId`から取得します。RPC URLが未設定の場合、Arc表示は「未接続」になります。

## 起動

```bash
npm install
npm start
```

ブラウザで `http://localhost:3000` を開きます。

## Arc API

- `GET /api/arc/status` — Arc RPC接続、Chain ID、ウォレット残高を取得
- 残高取得はEVMの`eth_getBalance`を使用します
- RPCエラー時はHTTP 503を返します

## Discord

既存のDiscord Botはpaper trading操作用です。秘密鍵やBot TokenをGitHub・チャットに貼り付けないでください。Replit Secretsのみで管理してください。

## 安全制約

- `APP_MODE=paper` と `PAPER_TRADING=true` が必須です。
- Arc接続は読み取り専用です。
- 秘密鍵を読み込まず、トランザクション送信メソッドもありません。
- 価格と取引は模擬データです。
