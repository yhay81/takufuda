# Stack

- Cloudflare Workers / D1 / Static Assets
- Hono / Hono JSX
- Vite+
- TypeScript 7
- Vanilla JavaScript client
- Vitest / oxlint / oxfmt

Better Auth は初期版では使いません。共有札は閲覧URLと43文字の編集鍵で分け、鍵はURL fragmentに置きます。ログインが必要になるのは、一括管理や複数端末同期を実利用が求めた時です。
