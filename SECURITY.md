# Security

- 書き込みは same-origin のJSONリクエストだけ受け付ける。
- 編集鍵は32バイト乱数で生成し、D1にはSHA-256ハッシュだけを保存する。
- 編集鍵はURL fragmentに置き、HTTPリクエストやアクセスログへ送らない。
- 取り込み先は `charasheet.vampire-blood.net` の単一公開シートJSONに限定する。
- 取り込み結果は既知の項目だけへ変換し、元JSONの未知フィールドを返さない。
- 共有札は検索エンジンに載せず、入力HTMLをサーバー側で描画しない。
- CSP、HSTS、frame拒否、MIME sniffing拒否を常時付与する。
- 端末だけのメモはAPI payloadへ含めない。

編集鍵を失った場合は本人確認できないため復旧しません。
