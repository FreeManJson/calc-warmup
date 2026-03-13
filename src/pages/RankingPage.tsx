import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

export function RankingPage () {
    const navigate = useNavigate();
    const { ranking, clearRanking } = useAppContext();

    function handleClearRanking (): void {
        if (ranking.length <= 0) {
            return;
        }

        const confirmed = window.confirm('ランキングを全件削除します。よろしいですか？');

        if (confirmed === false) {
            return;
        }

        clearRanking();
    }

    return (
        <div className="page-container">
            <h1>ランキング</h1>

            <section className="card">
                <div className="button-row bottom-gap">
                    <button
                        type="button"
                        onClick={() => {
                            handleClearRanking();
                        }}
                        disabled={ranking.length <= 0}
                    >
                        ランキングクリア
                    </button>
                </div>

                {ranking.length <= 0 && (
                    <p>まだランキングはありません。</p>
                )}

                {ranking.length > 0 && (
                    <table className="result-table">
                        <thead>
                            <tr>
                                <th>順位</th>
                                <th>ユーザー</th>
                                <th>コース</th>
                                <th>スコア</th>
                                <th>正答率</th>
                                <th>平均時間</th>
                                <th>日時</th>
                            </tr>
                        </thead>

                        <tbody>
                            {ranking.map((entry, index) => {
                                return (
                                    <tr key={entry.id}>
                                        <td>{index + 1}</td>
                                        <td>{entry.userName}</td>
                                        <td>{entry.courseLabel}</td>
                                        <td>{entry.score}</td>
                                        <td>{entry.accuracyRate}%</td>
                                        <td>{entry.averageAnswerMs} ms</td>
                                        <td>{entry.playedAt}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </section>

            <section className="card">
                <div className="button-row">
                    <button
                        type="button"
                        onClick={() => {
                            navigate('/');
                        }}
                    >
                        TOPへ戻る
                    </button>
                </div>
            </section>
        </div>
    );
}