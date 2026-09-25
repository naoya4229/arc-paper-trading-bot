# チャート・取引量・Xバズり指標

- 価格チャート: paper trading の価格更新履歴を Canvas で表示
- 取引量: paper market の模擬 volume を表示
- Xバズり: `X_BEARER_TOKEN` を設定すると X API v2 Recent Search から直近投稿を取得し、投稿数・いいね・リポスト等を使った0〜100の参考スコアを表示

## X API設定

`.env` または Replit Secrets に次を追加します。

```dotenv
X_BEARER_TOKEN=あなたのX API Bearer Token
X_SEARCH_LANG=ja
```

トークン未設定時は取得不能として表示します。Xの「バズり」スコアは公式ランキングではなく、直近検索結果の反応量から算出した参考値です。X APIの利用枠・検索仕様・認証エラーによって取得できない場合があります。

## 重要な安全事項

価格と取引量は外部取引所のリアルタイム値ではなく、paper trading用の模擬値です。実データを使う場合は、別途、利用規約に従った市場データAPIを接続してください。
