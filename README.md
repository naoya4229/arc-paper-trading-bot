# コントラクトアドレスによるアルトコイン追加

Dashboard の「コントラクトアドレスから追加」API、または Discord の `/add-token` を使います。

```bash
curl -X POST http://localhost:3000/api/tokens/import \
  -H 'content-type: application/json' \
  -d '{"address":"0xコントラクトアドレス"}'
```

アドレスを DEX Screener の token API で検索し、最大流動性のペアからシンボル、名称、価格、24h取引量、DEX、ペアアドレスを取得して監視対象へ追加します。`ARC_DEX_CHAIN_ID` を設定すると、そのチェーンだけに絞り込めます。

Discord:
- `/add-token address:0x... symbol:任意` — コントラクトから追加
- `/chart token:SYMBOL` — 価格・取引量・チャート履歴点
- `/buzz token:SYMBOL` — X API v2 のバズり参考スコア

コントラクトアドレスは EVM の `0x` 形式で、公開情報の取得にのみ使います。秘密鍵は不要です。

X指標には `X_BEARER_TOKEN` が必要です。スコアは公式ランキングではなく、X API v2 の直近検索結果に含まれる投稿数・いいね・リポスト等から計算した参考値です。
