# Arc Paper Trading Bot

Arc向け暗号資産自動売買アプリの安全な土台です。現在は **paper trading（模擬売買）専用** で、実際のブロックチェーン取引は実行しません。

## 安全上の制約

- `APP_MODE=paper` を前提に動作します。
- 実トランザクション送信機能は実装していません。
- 秘密鍵をコードに直接書きません。
- 秘密鍵を画面、APIレスポンス、ログ、取引履歴に表示しません。
- `PRIVATE_KEY` は将来の拡張用の環境変数名としてのみ案内しています。現在のpaper tradingエンジンでは読み込み・利用しません。
- 緊急停止を実行するとBotを停止し、以降の模擬売買を止めます。

## 機能

- Node.js + Express
- スマホ対応Web管理画面
- 自動売買のON/OFF
- Bot稼働状態表示
- ウォレットアドレス表示
- paper残高・現金残高表示
- 監視対象トークン表示
- 模擬現在価格の更新
- 買い条件・売り条件
- 損切り・利確
- 1回あたりの最大購入額
- 模擬取引履歴
- 緊急停止ボタン
- 設定と履歴のJSON保存

## 必要環境

- Node.js 18以上を推奨
- npm

## 起動方法

```bash
npm install
npm start
```

起動後、ブラウザまたはスマートフォンで以下を開きます。

```text
http://localhost:3000
```

Replitでは、Run設定の起動コマンドを `npm start` にしてください。公開URLはReplitが表示するWebviewまたはPublic URLから開けます。

## 環境変数

`.env.example` を参考に、Replit Secretsまたは実行環境の環境変数へ設定してください。

| 変数 | 必須 | 説明 |
| --- | --- | --- |
| `PORT` | 任意 | Expressのポート。既定値は `3000` |
| `NODE_ENV` | 任意 | 実行環境。既定値は `development` |
| `APP_MODE` | 任意 | `paper` を設定。実売買モードはありません |
| `PAPER_TRADING` | 任意 | `true` を設定 |
| `AUTO_TRADING` | 任意 | 初期自動売買状態。既定値は `false` |
| `WALLET_ADDRESS` | 任意 | 表示用ウォレットアドレス。秘密情報ではありません |
| `ARC_RPC_URL` | 任意 | 将来の参照用RPC URL。現在は送信に使用しません |
| `PRIVATE_KEY` | 任意 | **チャットやGitへ絶対に登録しない秘密情報**。現在のpaper tradingでは使用しません |
| `BOT_STATUS` | 任意 | 初期状態の参考値 |
| `MONITORED_TOKENS` | 任意 | 監視対象の初期値。例: `BTC,ETH,SOL` |
| `BUY_CONDITION_PERCENT` | 任意 | 買い条件の初期値 |
| `SELL_CONDITION_PERCENT` | 任意 | 売り条件の初期値 |
| `STOP_LOSS_PERCENT` | 任意 | 損切り率の初期値 |
| `TAKE_PROFIT_PERCENT` | 任意 | 利確率の初期値 |
| `MAX_PURCHASE_AMOUNT` | 任意 | 最大購入額の初期値 |

`.env` ファイルを使う場合も、秘密情報をGitへコミットしないでください。`.gitignore` で `.env` は除外されています。

## Replit Secretsの例

値は自分のReplit環境で登録してください。このREADMEやGitHubへ実際の値を書き込まないでください。

```text
PORT=3000
APP_MODE=paper
PAPER_TRADING=true
WALLET_ADDRESS=表示したいウォレットアドレス
ARC_RPC_URL=使用する場合のRPC URL
PRIVATE_KEY=秘密鍵（コードやチャットに貼り付けない）
```

## データ保存

初回起動時に `data/store.json` が作成され、設定、模擬残高、ポジション、取引履歴が保存されます。`data/` はGitへコミットしない設定です。

本番運��や複数ユーザー対応へ進む場合は、認証とSQLite/PostgreSQLなどのデータベースを追加してください。

## API

- `GET /api/health` — 稼働確認
- `GET /api/dashboard` — ダッシュボード情報
- `GET /api/config` — 安全な設定情報
- `POST /api/config` — 設定保存
- `POST /api/toggle-bot` — paper botのON/OFF
- `POST /api/emergency-stop` — 緊急停止
- `POST /api/refresh-prices` — 模擬価格更新とpaper engine実行
- `GET /api/prices` — 模擬価格
- `GET /api/trades` — 模擬取引履歴

## 重要な注意

このプロジェクトは学習・検証用のpaper trading土台です。価格データは模擬的に変動します。実資産を扱う前に、認証、権限管理、入力検証、監査ログ、レート制限、秘密管理、テスト、停止手順を十分に整備してください。
