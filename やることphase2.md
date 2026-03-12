OK。
では **PWA なしの最小構成** で、まずは **画面遷移だけ通る骨組み** を作ります。
Vite は開発サーバーと本番ビルドをそのまま使えますし、React Router の公式もまずルーターをアプリに組み込んでクライアントサイドルーティングを有効にする流れを案内しています。 ([vitejs][1])

今回は一気に複雑にせず、次の状態を目標にします。

* `/` で TOP
* `/settings` で 設定
* `/quiz` で 出題
* `/result` で 結果
* `/ranking` で ランキング

## 1. まず作るファイル

`src` の中を、いったんこうしてください。

```text
src
├─pages
│  ├─TopPage.tsx
│  ├─SettingsPage.tsx
│  ├─QuizPage.tsx
│  ├─ResultPage.tsx
│  └─RankingPage.tsx
├─App.tsx
├─main.tsx
└─styles.css
```

使わない初期ファイルがあれば、いったん外して大丈夫です。

* `src/App.css`
* `src/index.css`
* `src/assets/react.svg`

## 2. `src/main.tsx`

これに差し替えてください。

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </React.StrictMode>
);
```

## 3. `src/App.tsx`

これに差し替えてください。

```tsx
import { Routes, Route } from 'react-router-dom';
import { TopPage } from './pages/TopPage';
import { SettingsPage } from './pages/SettingsPage';
import { QuizPage } from './pages/QuizPage';
import { ResultPage } from './pages/ResultPage';
import { RankingPage } from './pages/RankingPage';

export default function App () {
    return (
        <Routes>
            <Route path="/" element={<TopPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/quiz" element={<QuizPage />} />
            <Route path="/result" element={<ResultPage />} />
            <Route path="/ranking" element={<RankingPage />} />
        </Routes>
    );
}
```

## 4. `src/pages/TopPage.tsx`

```tsx
import { Link } from 'react-router-dom';

export function TopPage () {
    return (
        <div className="page-container">
            <h1>計算ウォーミングアップ</h1>

            <section className="card">
                <h2>ユーザー選択</h2>
                <select className="input-control" defaultValue="son">
                    <option value="father">お父さん</option>
                    <option value="son">息子</option>
                </select>
            </section>

            <section className="card">
                <h2>コース選択</h2>

                <div className="check-group">
                    <label><input type="checkbox" defaultChecked /> 足し算</label>
                    <label><input type="checkbox" /> 引き算</label>
                    <label><input type="checkbox" /> 掛け算</label>
                    <label><input type="checkbox" /> 割り算</label>
                </div>
            </section>

            <section className="card">
                <h2>メニュー</h2>

                <div className="button-row">
                    <Link className="button-like" to="/quiz">開始</Link>
                    <Link className="button-like" to="/settings">オプション設定</Link>
                    <Link className="button-like" to="/ranking">ランキング</Link>
                </div>
            </section>
        </div>
    );
}
```

## 5. `src/pages/SettingsPage.tsx`

```tsx
import { Link } from 'react-router-dom';

export function SettingsPage () {
    return (
        <div className="page-container">
            <h1>オプション設定</h1>

            <section className="card">
                <h2>基本設定</h2>

                <div className="form-grid">
                    <label>
                        最大項目数
                        <input className="input-control" type="number" min="2" max="9" defaultValue="2" />
                    </label>

                    <label>
                        1項目目 最大桁数
                        <input className="input-control" type="number" min="1" max="9" defaultValue="2" />
                    </label>

                    <label>
                        2項目目 最大桁数
                        <input className="input-control" type="number" min="1" max="9" defaultValue="2" />
                    </label>

                    <label>
                        出題数
                        <input className="input-control" type="number" min="1" max="100" defaultValue="10" />
                    </label>
                </div>
            </section>

            <section className="card">
                <h2>時間設定</h2>

                <label className="single-check">
                    <input type="checkbox" />
                    時間制限あり
                </label>

                <label>
                    時間制限（秒）
                    <input className="input-control" type="number" min="1" max="300" defaultValue="10" />
                </label>
            </section>

            <section className="card">
                <h2>追加オプション</h2>

                <div className="check-group">
                    <label><input type="checkbox" /> マイナス計算を許可</label>
                    <label><input type="checkbox" /> 小数を許可</label>
                    <label><input type="checkbox" /> 割り算の余りを許可</label>
                    <label><input type="checkbox" /> 実数の割り算を許可</label>
                    <label><input type="checkbox" /> 手書きメモ欄を有効化</label>
                </div>
            </section>

            <section className="card">
                <h2>プリセット</h2>

                <div className="button-row">
                    <button type="button">小4</button>
                    <button type="button">中1</button>
                    <button type="button">高校基礎</button>
                </div>
            </section>

            <section className="card">
                <div className="button-row">
                    <Link className="button-like" to="/">TOPへ戻る</Link>
                    <Link className="button-like" to="/quiz">この設定で開始</Link>
                </div>
            </section>
        </div>
    );
}
```

## 6. `src/pages/QuizPage.tsx`

```tsx
import { Link } from 'react-router-dom';

export function QuizPage () {
    return (
        <div className="page-container">
            <header className="quiz-header">
                <h1>出題画面</h1>

                <div className="button-row">
                    <button type="button">一時停止</button>
                    <Link className="button-like" to="/">TOPへ戻る</Link>
                    <button type="button">リトライ</button>
                </div>
            </header>

            <section className="card">
                <h2>カウントダウン</h2>
                <div className="big-display">3</div>
                <p className="sub-text">今は見た目だけです。</p>
            </section>

            <section className="card">
                <h2>問題</h2>
                <div className="question-box">123 + 45 + 6 = ?</div>

                <label>
                    回答入力
                    <input className="input-control" type="text" placeholder="ここに答えを入力" />
                </label>
            </section>

            <section className="card">
                <h2>メモ欄（ダミー）</h2>
                <div className="memo-dummy">将来的にここへ手書きメモを実装</div>
            </section>

            <section className="card">
                <div className="button-row">
                    <button type="button">次へ</button>
                    <Link className="button-like" to="/result">ダミー結果表示</Link>
                </div>
            </section>
        </div>
    );
}
```

## 7. `src/pages/ResultPage.tsx`

```tsx
import { Link } from 'react-router-dom';

export function ResultPage () {
    return (
        <div className="page-container">
            <h1>結果画面</h1>

            <section className="card">
                <h2>結果サマリ</h2>
                <ul className="simple-list">
                    <li>総問題数: 10</li>
                    <li>正答数: 8</li>
                    <li>正答率: 80%</li>
                    <li>平均回答時間: 2400 ms</li>
                    <li>スコア: 820</li>
                </ul>
            </section>

            <section className="card">
                <h2>問題別結果</h2>

                <table className="result-table">
                    <thead>
                        <tr>
                            <th>問題</th>
                            <th>回答</th>
                            <th>正解</th>
                            <th>判定</th>
                            <th>時間</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>12 + 8</td>
                            <td>20</td>
                            <td>20</td>
                            <td>〇</td>
                            <td>1800 ms</td>
                        </tr>
                        <tr>
                            <td>45 - 19</td>
                            <td>25</td>
                            <td>26</td>
                            <td>×</td>
                            <td>3200 ms</td>
                        </tr>
                    </tbody>
                </table>
            </section>

            <section className="card">
                <div className="button-row">
                    <Link className="button-like" to="/quiz">リトライ</Link>
                    <Link className="button-like" to="/ranking">ランキングへ</Link>
                    <Link className="button-like" to="/">TOPへ戻る</Link>
                </div>
            </section>
        </div>
    );
}
```

## 8. `src/pages/RankingPage.tsx`

```tsx
import { Link } from 'react-router-dom';

export function RankingPage () {
    return (
        <div className="page-container">
            <h1>ランキング</h1>

            <section className="card">
                <table className="result-table">
                    <thead>
                        <tr>
                            <th>順位</th>
                            <th>ユーザー</th>
                            <th>スコア</th>
                            <th>正答率</th>
                            <th>平均時間</th>
                            <th>コース</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>1</td>
                            <td>息子</td>
                            <td>980</td>
                            <td>100%</td>
                            <td>1800 ms</td>
                            <td>足し算</td>
                        </tr>
                        <tr>
                            <td>2</td>
                            <td>息子</td>
                            <td>920</td>
                            <td>90%</td>
                            <td>2200 ms</td>
                            <td>引き算</td>
                        </tr>
                        <tr>
                            <td>3</td>
                            <td>お父さん</td>
                            <td>850</td>
                            <td>80%</td>
                            <td>2600 ms</td>
                            <td>掛け算</td>
                        </tr>
                    </tbody>
                </table>
            </section>

            <section className="card">
                <div className="button-row">
                    <Link className="button-like" to="/">TOPへ戻る</Link>
                </div>
            </section>
        </div>
    );
}
```

## 9. `src/styles.css`

```css
:root {
    font-family: Arial, "Yu Gothic", "Hiragino Kaku Gothic ProN", sans-serif;
    color: #222;
    background-color: #f5f7fb;
    line-height: 1.5;
}

* {
    box-sizing: border-box;
}

body {
    margin: 0;
    min-width: 320px;
}

a {
    color: inherit;
    text-decoration: none;
}

button,
input,
select {
    font: inherit;
}

button,
.button-like {
    display: inline-block;
    cursor: pointer;
    border: 1px solid #c7cbd6;
    border-radius: 8px;
    padding: 10px 16px;
    background-color: #ffffff;
}

button:hover,
.button-like:hover {
    background-color: #f0f4ff;
}

.page-container {
    max-width: 920px;
    margin: 0 auto;
    padding: 20px;
}

.card {
    background-color: #ffffff;
    border: 1px solid #d9deea;
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 16px;
}

.card h2 {
    margin-top: 0;
    font-size: 20px;
}

.input-control {
    display: block;
    width: 100%;
    margin-top: 6px;
    padding: 10px;
    border: 1px solid #c7cbd6;
    border-radius: 8px;
    background-color: #ffffff;
}

.form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
}

.check-group {
    display: grid;
    gap: 10px;
}

.single-check {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
}

.button-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
}

.quiz-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    margin-bottom: 20px;
}

.big-display {
    font-size: 64px;
    font-weight: bold;
    text-align: center;
    padding: 16px;
}

.question-box {
    font-size: 32px;
    font-weight: bold;
    text-align: center;
    padding: 20px;
    background-color: #f8fbff;
    border: 1px solid #d9deea;
    border-radius: 12px;
    margin-bottom: 16px;
}

.memo-dummy {
    min-height: 180px;
    border: 2px dashed #9ea8bf;
    border-radius: 12px;
    background-color: #fcfdff;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #6f7890;
    text-align: center;
    padding: 16px;
}

.simple-list {
    margin: 0;
    padding-left: 20px;
}

.sub-text {
    color: #666;
    font-size: 14px;
}

.result-table {
    width: 100%;
    border-collapse: collapse;
}

.result-table th,
.result-table td {
    border: 1px solid #d9deea;
    padding: 8px 10px;
    text-align: left;
    vertical-align: top;
}

.result-table th {
    background-color: #f3f6fc;
}

@media (max-width: 640px) {
    .quiz-header {
        flex-direction: column;
        align-items: flex-start;
    }

    .question-box {
        font-size: 24px;
    }
}
```

## 10. 起動確認

ここまで入れたら、実行してください。

```powershell
npm run dev
```

React Router のドキュメントどおり、まずルーターをアプリに組み込むとクライアントサイドルーティングが使えるようになります。Vite 側は開発サーバーで確認し、本番時は `vite build` で静的ホスティング向けの成果物を作れます。 ([React Router][2])

## 11. ここで確認したいこと

次の5つが通ればOKです。

* TOP が開く
* オプション設定へ行ける
* 開始で出題画面へ行ける
* ダミー結果表示で結果へ行ける
* ランキングへ行ける

## 12. 次の段階

これが通ったら、次は **状態を本物にする** 段階です。
順番はこの流れが安全です。

1. ユーザー選択と設定値を React の state で保持
2. 前回設定をブラウザ保存
3. 足し算だけ問題生成
4. 正誤判定
5. 結果画面へ反映

ここまでまず入れてみて、エラーが出たら **`App.tsx` / `main.tsx` / 出たエラーメッセージ全文** を貼ってください。

[1]: https://vite.dev/guide/?utm_source=chatgpt.com "Getting Started"
[2]: https://reactrouter.com/6.30.3/start/tutorial?utm_source=chatgpt.com "Tutorial v6.30.3"
