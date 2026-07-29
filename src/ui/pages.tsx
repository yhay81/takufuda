import { Layout } from "./layout";

const statLabels = [
  ["str", "STR"],
  ["con", "CON"],
  ["pow", "POW"],
  ["dex", "DEX"],
  ["app", "APP"],
  ["siz", "SIZ"],
  ["int", "INT"],
  ["edu", "EDU"],
] as const;

export function HomePage({ sheetId = "" }: { sheetId?: string }) {
  return (
    <Layout noindex={Boolean(sheetId)} sheetId={sheetId}>
      <section class="import-strip" aria-label="既存シートの取り込み">
        <div class="import-state" aria-hidden="true">
          <span class="source-card">旧</span>
          <span class="transfer-track">
            <i></i>
          </span>
          <span class="source-card active">卓</span>
        </div>
        <form data-import-form>
          <label for="source-url">
            キャラクター保管所の公開URL
            <span>を貼ると、能力値と技能を移します</span>
          </label>
          <div class="inline-control">
            <input
              id="source-url"
              inputmode="url"
              name="sourceUrl"
              placeholder="https://charasheet.vampire-blood.net/..."
              type="url"
            />
            <button class="primary-button" type="submit">
              取り込む
            </button>
          </div>
        </form>
        <button class="quiet-button new-sheet-button" data-action="new" type="button">
          新しい札
        </button>
      </section>

      <div class="workspace-shell">
        <aside class="identity-panel">
          <div class="portrait-card" data-color="amber">
            <div class="portrait-orbit" aria-hidden="true">
              <span data-monogram>?</span>
              <i></i>
            </div>
            <label class="name-field">
              <span>探索者名</span>
              <input autocomplete="off" data-field="name" maxlength={80} placeholder="名前を入力" />
            </label>
            <label class="occupation-field">
              <span>職業</span>
              <input
                autocomplete="off"
                data-field="occupation"
                maxlength={80}
                placeholder="職業・肩書き"
              />
            </label>
            <div class="palette-row" aria-label="札の色">
              {["amber", "cyan", "violet", "green", "rose"].map((color) => (
                <button
                  aria-label={`${color}に変更`}
                  class={`color-dot ${color}`}
                  data-color-choice={color}
                  type="button"
                ></button>
              ))}
            </div>
          </div>

          <div class="identity-grid">
            <label>
              <span>PL</span>
              <input data-field="player" maxlength={80} placeholder="プレイヤー" />
            </label>
            <label>
              <span>年齢</span>
              <input data-field="age" maxlength={24} />
            </label>
            <label>
              <span>性別</span>
              <input data-field="gender" maxlength={32} />
            </label>
            <label>
              <span>出身</span>
              <input data-field="origin" maxlength={80} />
            </label>
          </div>

          <div class="vital-rack">
            <label class="vital hp">
              <span>HP</span>
              <input data-field="hp" inputmode="numeric" type="number" min="0" max="999" />
              <i>/</i>
              <input
                aria-label="最大HP"
                data-field="hpMax"
                inputmode="numeric"
                type="number"
                min="0"
                max="999"
              />
            </label>
            <label class="vital mp">
              <span>MP</span>
              <input data-field="mp" inputmode="numeric" type="number" min="0" max="999" />
              <i>/</i>
              <input
                aria-label="最大MP"
                data-field="mpMax"
                inputmode="numeric"
                type="number"
                min="0"
                max="999"
              />
            </label>
            <label class="vital san">
              <span>SAN</span>
              <input data-field="san" inputmode="numeric" type="number" min="0" max="999" />
              <i>/</i>
              <input
                aria-label="最大SAN"
                data-field="sanMax"
                inputmode="numeric"
                type="number"
                min="0"
                max="999"
              />
            </label>
          </div>
        </aside>

        <section class="sheet-board" aria-label="探索者シート">
          <nav class="board-tabs" aria-label="編集項目">
            <button aria-selected="true" data-tab="abilities" type="button">
              能力
            </button>
            <button aria-selected="false" data-tab="skills" type="button">
              技能
              <span data-skill-count>3</span>
            </button>
            <button aria-selected="false" data-tab="notes" type="button">
              持ち物・メモ
            </button>
          </nav>

          <div class="tab-panel abilities-panel" data-panel="abilities">
            <div class="radar-card">
              <div class="radar-wrap">
                <svg aria-label="能力値レーダー" role="img" viewBox="0 0 240 240">
                  <g class="radar-grid" aria-hidden="true">
                    <polygon points="120,30 184,56 210,120 184,184 120,210 56,184 30,120 56,56" />
                    <polygon points="120,60 163,77 180,120 163,163 120,180 77,163 60,120 77,77" />
                    <polygon points="120,90 141,99 150,120 141,141 120,150 99,141 90,120 99,99" />
                    <line x1="120" y1="24" x2="120" y2="216" />
                    <line x1="24" y1="120" x2="216" y2="120" />
                    <line x1="52" y1="52" x2="188" y2="188" />
                    <line x1="188" y1="52" x2="52" y2="188" />
                  </g>
                  <polygon class="radar-shape" data-radar points="" />
                  <g class="radar-points" data-radar-points></g>
                </svg>
                <span class="radar-label str">STR</span>
                <span class="radar-label con">CON</span>
                <span class="radar-label pow">POW</span>
                <span class="radar-label dex">DEX</span>
                <span class="radar-label app">APP</span>
                <span class="radar-label siz">SIZ</span>
                <span class="radar-label int">INT</span>
                <span class="radar-label edu">EDU</span>
              </div>
              <div class="derived-stack">
                <span>
                  アイデア <b data-derived="idea">50</b>
                </span>
                <span>
                  幸運 <b data-derived="luck">50</b>
                </span>
                <span>
                  知識 <b data-derived="knowledge">50</b>
                </span>
              </div>
            </div>

            <div class="stat-grid">
              {statLabels.map(([key, label]) => (
                <label class="stat-cell">
                  <span>{label}</span>
                  <input
                    aria-label={label}
                    data-stat={key}
                    inputmode="numeric"
                    max="999"
                    min="0"
                    type="number"
                    value="10"
                  />
                  <i data-stat-bar={key}></i>
                </label>
              ))}
            </div>
            <button class="calculate-button" data-action="calculate" type="button">
              能力値から HP・MP・SAN を整える
            </button>
          </div>

          <div class="tab-panel skills-panel" data-panel="skills" hidden>
            <div class="skill-tools">
              <label>
                <span class="visually-hidden">技能を絞り込み</span>
                <input data-skill-filter placeholder="技能を絞り込み" type="search" />
              </label>
              <button class="primary-button compact" data-action="add-skill" type="button">
                ＋ 技能
              </button>
            </div>
            <div class="skill-list" data-skill-list></div>
          </div>

          <div class="tab-panel notes-panel" data-panel="notes" hidden>
            <label class="textarea-card">
              <span>持ち物</span>
              <textarea
                data-field="inventory"
                maxlength={12_000}
                placeholder="1行に1つずつ書けます"
                rows={8}
              ></textarea>
            </label>
            <label class="textarea-card">
              <span>公開メモ</span>
              <textarea
                data-field="notes"
                maxlength={24_000}
                placeholder="共有相手に見せる設定・来歴・関係"
                rows={10}
              ></textarea>
            </label>
            <label class="textarea-card private-card">
              <span>
                端末だけのメモ <small>共有・クラウド保存されません</small>
              </span>
              <textarea
                data-private-notes
                maxlength={24_000}
                placeholder="秘匿情報や自分だけのメモ"
                rows={6}
              ></textarea>
            </label>
          </div>
        </section>

        <aside class="session-panel">
          <div class="save-state">
            <span class="state-light" data-save-light></span>
            <div>
              <b data-save-label>端末に下書き保存</b>
              <small data-save-detail>共有すると編集鍵が発行されます</small>
            </div>
          </div>
          <button class="save-button" data-action="save" type="button">
            <span aria-hidden="true">⌁</span>
            保存して共有
          </button>
          <button class="secondary-button" data-action="copy-share" disabled type="button">
            閲覧URLをコピー
          </button>

          <div class="command-card">
            <div>
              <span>セッション用</span>
              <b>判定コマンド</b>
            </div>
            <pre data-command-preview>1D100&lt;=25 【目星】</pre>
            <button class="secondary-button" data-action="copy-commands" type="button">
              全コマンドをコピー
            </button>
            <button class="secondary-button" data-action="copy-ccfolia" type="button">
              ココフォリア用の駒をコピー
            </button>
          </div>

          <details class="export-card">
            <summary>バックアップ</summary>
            <button class="quiet-button" data-action="export" type="button">
              JSONを書き出す
            </button>
            <label class="quiet-button file-button">
              JSONを読み込む
              <input accept="application/json,.json" data-import-file type="file" />
            </label>
          </details>
          <button class="danger-link" data-action="delete" hidden type="button">
            この共有札を削除
          </button>
        </aside>
      </div>

      <dialog class="recent-dialog" data-recent-dialog>
        <div class="dialog-head">
          <div>
            <span>この端末の</span>
            <b>保管棚</b>
          </div>
          <button aria-label="閉じる" data-action="close-recent" type="button">
            ×
          </button>
        </div>
        <div class="recent-list" data-recent-list></div>
      </dialog>

      <div class="toast" data-toast role="status" aria-live="polite"></div>

      <section class="rights-note" aria-label="権利表記">
        <p>
          卓札は非公式の個人制作ツールです。ルールブックの代替ではありません。遊ぶ際は正規のルールブックをご利用ください。
        </p>
        <p>
          本作は、株式会社アークライト及び株式会社KADOKAWAが権利を有する「クトゥルフ神話TRPG」シリーズの二次創作物です。
          Call of Cthulhu is copyright ©1981, 2015, 2019 by Chaosium Inc.; all rights reserved.
          Arranged by Arclight Inc. Call of Cthulhu is a registered trademark of Chaosium Inc.
          PUBLISHED BY KADOKAWA CORPORATION 「クトゥルフ神話TRPG」「新クトゥルフ神話TRPG」
        </p>
      </section>
    </Layout>
  );
}

export function PrivacyPage() {
  return (
    <Layout title="データの取扱い | 卓札">
      <article class="document-page">
        <header>
          <span class="document-icon" aria-hidden="true">
            ◫
          </span>
          <div>
            <p>データの取扱い</p>
            <h1>保存先を、札ごとに分けています</h1>
          </div>
        </header>
        <section>
          <h2>端末に残るもの</h2>
          <p>
            編集中の下書き、編集鍵、最近開いた札、端末だけのメモはブラウザの localStorage
            に保存します。端末だけのメモはサーバーへ送りません。
          </p>
        </section>
        <section>
          <h2>共有時にサーバーへ保存するもの</h2>
          <p>
            「保存して共有」を押した札の公開項目を Cloudflare D1
            に保存します。閲覧URLを知る人は内容を見られます。編集鍵はURLの #
            以降に置き、サーバーにはハッシュだけを保存します。
          </p>
        </section>
        <section>
          <h2>利用状況</h2>
          <p>
            訪問、取り込み、保存、共有、出力などの操作名を、ランダムな端末IDのハッシュとともに35日以内保存します。入力内容、URL、氏名、メモは計測しません。自動QAは集計しません。
          </p>
        </section>
        <section>
          <h2>Cookie・外部送信</h2>
          <p>
            Cookie、広告、外部解析SDKは使いません。取り込みを実行したときだけ、卓札のサーバーからキャラクター保管所の公開JSONへアクセスします。
          </p>
        </section>
        <section>
          <h2>削除</h2>
          <p>
            編集鍵のある端末では共有札を削除できます。編集鍵を失うと本人確認ができず、編集・削除を復旧できません。JSONバックアップも併用してください。
          </p>
        </section>
        <section>
          <h2>非公式ツール</h2>
          <p>
            卓札はキャラクター保管所、ココフォリア、Chaosium、アークライト、KADOKAWAの公式・認定・提携サービスではありません。
          </p>
        </section>
        <a class="primary-button document-back" href="/">
          札へ戻る
        </a>
      </article>
    </Layout>
  );
}

export function NotFoundPage() {
  return (
    <Layout noindex title="ページが見つかりません | 卓札">
      <section class="not-found">
        <div class="empty-card" aria-hidden="true">
          <span>?</span>
        </div>
        <div>
          <h1>札が見つかりません</h1>
          <p>URLを確かめるか、新しい探索者の札を作ってください。</p>
          <a class="primary-button" href="/">
            新しい札を開く
          </a>
        </div>
      </section>
    </Layout>
  );
}
