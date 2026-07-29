# Metrics

実利用だけを判断するため、`is_automated = 0` のイベントを集計します。

- users: `visited` の匿名端末数
- editors: 技能追加まで進んだ端末数
- importers: 公開シート取り込みに成功した端末数
- savers: 共有札を保存した端末数
- sharers: 閲覧URLをコピーした端末数
- ccfolia_users: ココフォリア用の駒をコピーした端末数
- exporters: JSONを保存した端末数
- returned_users: 24時間以上空けて再訪した端末数
- published_sheets: 現在D1にある共有札数

`npm run metrics` で本番D1を読みます。QAは `?qa=1` または WebDriver を検知し、イベントAPIが永続化前に破棄します。
