OK。
その構成で進めて問題ありません。React 公式も、新規構築ではビルドツールとして Vite などを使う流れを案内しており、Vite 公式も `npm create vite@latest` で React/TypeScript テンプレートを作る手順を出しています。PWA 化も `vite-plugin-pwa` で進められます。Node は公式が **LTS 系の利用** を推奨しています。 ([React][1])

今日はまず、**Windows 上で「起動確認まで」** を通すところまで進めるのがよいです。
順番はこの通りです。

## 1. 入れるもの

* Node.js **LTS**
* VS Code の最低限の拡張
* React + TypeScript + Vite の新規プロジェクト
* PWA プラグイン

Node は公式のダウンロードページにある **LTS** を入れてください。Node のリリース方針でも、運用向けは Active LTS または Maintenance LTS が推奨です。現時点の公式ページでは 24 系 LTS が案内されています。 ([Node.js][2])

---

## 2. Node.js を入れる

### やること

1. Node.js 公式サイトを開く
2. **LTS** を選んで Windows Installer を入れる
3. 基本はデフォルト設定で進める

インストール後、PowerShell かコマンドプロンプトでこれを実行します。

```powershell
node -v
npm -v
```

`v24.x.x` のように出ればOKです。
Node と npm は公式の Windows インストーラーで入ります。 ([Node.js][2])

---

## 3. VS Code は最低限これでよい

VS Code 本体はもう入っているので、最初は拡張を盛りすぎないほうが楽です。
初期はこれだけで十分です。

* ESLint
* Prettier - Code formatter
* Error Lens
* Japanese Language Pack for Visual Studio Code

ただし、**最初は拡張なしでも作業自体は可能**です。VS Code は JavaScript/TypeScript の基本機能を最初から持っています。
なので、まずは **Node と Vite の起動確認を優先** で大丈夫です。

---

## 4. 作業フォルダを作る

たとえばこんな場所にします。

```powershell
cd C:\Users\＜あなたのユーザー名＞\Documents
mkdir calc-training
cd calc-training
```

---

## 5. React + TypeScript + Vite のプロジェクトを作る

Vite 公式の作成手順に沿うと、こうです。Vite のテンプレート一覧にも `react-ts` があります。 ([vitejs][3])

```powershell
npm create vite@latest calc-warmup -- --template react-ts
```

終わったら移動します。

```powershell
cd calc-warmup
```

依存関係を入れます。

```powershell
npm install
```

開発サーバーを起動します。

```powershell
npm run dev
```

Vite 公式の案内どおり、ローカル開発サーバーが立ちます。通常は `http://localhost:5173/` のようなURLが表示されます。 ([vitejs][3])

ブラウザでそのURLを開いて、Vite + React の初期画面が見えれば第1段階クリアです。

---

## 6. VS Code で開く

プロジェクトフォルダで次を実行します。

```powershell
code .
```

もし `code` コマンドが使えなければ、VS Code を起動して
`ファイル` → `フォルダーを開く` で `calc-warmup` を開けばOKです。

---

## 7. PWA プラグインを入れる

PWA 化には `vite-plugin-pwa` を使います。公式ガイドでは、既存の Vite アプリに少ない設定で PWA 機能を足せる形になっています。Workbox 7 ベースのため、Node 16 以上が必要です。今回 LTS を入れていれば問題ありません。 ([Vite PWA][4])

まずインストールします。

```powershell
npm install vite-plugin-pwa -D
```

次に `vite.config.ts` を編集します。

### 変更前のイメージ

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

### 変更後

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Calc Warmup',
        short_name: 'CalcWarmup',
        description: '基礎計算力ウォーミングアップ用アプリ',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})
```

※ アイコン画像はあとで追加でOKです。
最初は設定だけ入れて、画像は仮で後回しでも進められます。

---

## 8. いったんビルド確認

Vite 公式の本番ビルドは `vite build`、つまり npm スクリプトなら `npm run build` です。静的ホスティング向けの成果物が `dist` に出ます。 ([vitejs][5])

```powershell
npm run build
```

エラーが出なければ環境としては健全です。

---

## 9. ここまでで確認したいもの

この時点でチェックするのは4つです。

1. `node -v` が通る
2. `npm -v` が通る
3. `npm run dev` で Vite 初期画面が出る
4. `npm run build` が通る

ここまで通れば、**環境構築はほぼ成功**です。

---

## 10. その次に入れるライブラリ

本体実装に入る前に、あとでほぼ入れることになるのはこのあたりです。

* React Router
  画面遷移用
* Dexie
  IndexedDB を扱いやすくする
* Zustand または Redux Toolkit
  状態管理用
* react-use か usehooks 系
  細かいユーティリティ用

ただし、**今はまだ入れなくていい**です。
まずは素の React + Vite + PWA が正常起動することを優先してください。

---

## 11. おすすめの進め方

今日はここまでやってください。

### 今日のゴール

* Node LTS を入れる
* Vite の React+TS プロジェクトを作る
* `npm run dev` で起動する
* `npm run build` が成功する
* `vite-plugin-pwa` を入れる

### ここまでのコマンドまとめ

```powershell
node -v
npm -v

cd C:\Users\＜あなたのユーザー名＞\Documents
mkdir calc-training
cd calc-training

npm create vite@latest calc-warmup -- --template react-ts
cd calc-warmup
npm install
npm run dev
npm install vite-plugin-pwa -D
npm run build
```

---

## 12. 次の段階

環境構築が通ったら、次はこの順で進めるのがよいです。

* 画面ひな形作成
* TOP画面
* オプション設定画面
* 出題画面
* 結果画面
* ローカル保存
* ランキング

進めやすいように、次は **「1ファイルずつ作る初期テンプレート一式」** を出します。
まずは上の手順を実施して、`node -v`、`npm -v`、`npm run dev`、`npm run build` の結果をそのまま貼ってください。

[1]: https://react.dev/learn/build-a-react-app-from-scratch?utm_source=chatgpt.com "Build a React app from Scratch"
[2]: https://nodejs.org/en/download?utm_source=chatgpt.com "Download Node.js"
[3]: https://vite.dev/guide/?utm_source=chatgpt.com "Getting Started"
[4]: https://vite-pwa-org.netlify.app/guide/?utm_source=chatgpt.com "Getting Started | Guide - Vite PWA - Netlify"
[5]: https://vite.dev/guide/build?utm_source=chatgpt.com "Building for Production"
