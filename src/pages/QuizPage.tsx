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