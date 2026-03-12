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