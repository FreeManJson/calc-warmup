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