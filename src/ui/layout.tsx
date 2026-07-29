import type { Child } from "hono/jsx";

import { product } from "../config/product";

type LayoutProps = {
  children: Child;
  description?: string;
  noindex?: boolean;
  sheetId?: string;
  title?: string;
};

export function Layout({
  children,
  description = product.description,
  noindex = false,
  sheetId = "",
  title = product.name,
}: LayoutProps) {
  return (
    <html itemscope itemtype="https://schema.org/WebApplication" lang="ja">
      <head>
        <meta charset="utf-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <meta content={description} name="description" />
        <meta content={product.name} itemProp="name" />
        <meta content={description} itemProp="description" />
        <meta content={product.url} itemProp="url" />
        <meta content={product.applicationCategory} itemProp="applicationCategory" />
        <meta content="Web" itemProp="operatingSystem" />
        <meta content="true" itemProp="isAccessibleForFree" />
        <meta content={description} property="og:description" />
        <meta content={`${product.url}/og.svg`} property="og:image" />
        <meta content="ja_JP" property="og:locale" />
        <meta content={title} property="og:title" />
        <meta content="website" property="og:type" />
        <meta content={product.url} property="og:url" />
        <meta content="summary_large_image" name="twitter:card" />
        {noindex ? <meta content="noindex,nofollow,noarchive" name="robots" /> : null}
        <link href={product.url} rel="canonical" />
        <link href="/styles.css" rel="stylesheet" />
        <title>{title}</title>
      </head>
      <body data-sheet-id={sheetId}>
        <a class="skip-link" href="#main">
          編集面へ移動
        </a>
        <header class="site-header">
          <a class="brand" href="/" aria-label="卓札 新しい探索者">
            <span class="brand-mark" aria-hidden="true">
              <i></i>
              <i></i>
              <i></i>
            </span>
            <span>卓札</span>
          </a>
          <div class="header-actions">
            <button class="quiet-button" data-action="recent" type="button">
              保管棚
              <span class="count-badge" data-recent-count>
                0
              </span>
            </button>
            <a class="quiet-button" href="/privacy">
              取扱い
            </a>
          </div>
        </header>
        <main id="main">{children}</main>
        <footer>
          <div>
            <span>卓札</span>
            <span>無料・Cookieなし</span>
          </div>
          <nav aria-label="フッター">
            <a href="/privacy">データの取扱い</a>
            <a href="/healthz">稼働状態</a>
            <a href="https://product.kadokawa.co.jp/cthulhu/" rel="external">
              公式サイト
            </a>
          </nav>
        </footer>
        <script defer src="/app.js"></script>
      </body>
    </html>
  );
}
