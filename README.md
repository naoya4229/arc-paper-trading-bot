# Arc RPC版のコントラクト・価格対応

DEX Screenerは使用しません。`/add-token` で入力したERC-20コントラクトをArc JSON-RPCの `eth_call` で読み取り、`symbol`、`name`、`decimals`を取得します。

```text
/add-token address:0x... symbol:任意
```

価格は一般のERC-20コントラクトだけから自動算出できません。価格が必要なトークンはArc上のChainlink互換Aggregator等を設定します。

```dotenv
ARC_PRICE_ORACLES={"TOKEN":"0x価格オラクルアドレス"}
```

オラクルから `latestAnswer()` と `decimals()` を読み取り、価格チャートのデータとして保存します。オラクル未設定の場合は、トークン情報は表示されますが価格は「未設定」と表示されます。推測価格で実売買しない安全設計です。

## Discord

- `/add-token` — Arc RPCからERC-20メタデータを読み取り監視対象に追加
- `/chart token:TOKEN` — Dashboardが生成したSVGチャートをDiscordへ添付
- `/price` — 現在価格と取引量
- `/on` `/off` `/stop` `/reset-stop` — paper trading制御

`/chart` はDashboardが起動している必要があります。Discord BotはDashboard URLへアクセスし、SVG画像を取得して添付します。

## 安全性

Arc RPCは読み取り専用です。秘密鍵、署名、送金、DEX Screener、実トランザクションは使用しません。paper tradingのみです。
