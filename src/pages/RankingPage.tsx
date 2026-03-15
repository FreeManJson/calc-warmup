import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

export function RankingPage () {
    const navigate = useNavigate();
    const { ranking, clearRanking, lastRankingEntryId } = useAppContext();
    const [expandedIds, setExpandedIds] = useState<string[]>([]);

    useEffect(() => {
        if (lastRankingEntryId == null) {
            return;
        }

        const timerId = window.setTimeout(() => {
            const target = document.getElementById(`ranking-row-${lastRankingEntryId}`);

            if (target != null) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                });
            }
        }, 150);

        return () => {
            window.clearTimeout(timerId);
        };
    }, [lastRankingEntryId]);

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

    function toggleExpanded (entryId: string): void {
        setExpandedIds((prev) => {
            const exists = prev.includes(entryId);

            if (exists === true) {
                return prev.filter((item) => {
                    return (item !== entryId);
                });
            }

            return [...prev, entryId];
        });
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
                    <div className="ranking-table-wrap">
                        <table className="result-table ranking-table">
                            <thead>
                                <tr>
                                    <th>順位</th>
                                    <th>ユーザー</th>
                                    <th>スコア</th>
                                    <th>正答率</th>
                                    <th>平均(ms)</th>
                                    <th>+</th>
                                </tr>
                            </thead>

                            <tbody>
                                {ranking.map((entry, index) => {
                                    const expanded = expandedIds.includes(entry.id);
                                    const isNewEntry = (entry.id === lastRankingEntryId);

                                    return (
                                        <>
                                            <tr
                                                key={entry.id}
                                                id={`ranking-row-${entry.id}`}
                                                className={isNewEntry === true ? 'ranking-row-highlight' : ''}
                                            >
                                                <td>{index + 1}</td>
                                                <td>
                                                    <div className="ranking-user-cell">
                                                        <span>{entry.userName}</span>
                                                        {isNewEntry === true && (
                                                            <span className="new-badge">NEW</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>{entry.rankingScore}</td>
                                                <td>{entry.accuracyRate}%</td>
                                                <td>{entry.averageAnswerMs}</td>
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="expand-button ranking-expand-button"
                                                        onClick={() => {
                                                            toggleExpanded(entry.id);
                                                        }}
                                                        aria-expanded={expanded}
                                                        aria-label={expanded ? '詳細を閉じる' : '詳細を開く'}
                                                    >
                                                        {expanded === true ? '−' : '+'}
                                                    </button>
                                                </td>
                                            </tr>

                                            {expanded === true && (
                                                <tr className="ranking-expanded-row">
                                                    <td colSpan={6}>
                                                        <div className="ranking-detail-panel">
                                                            <div className="detail-scroll-hint">
                                                                左右にスクロールできます
                                                            </div>

                                                            <div className="ranking-detail-scroll">
                                                                <table className="ranking-detail-table">
                                                                    <thead>
                                                                        <tr>
                                                                            <th>1問平均点</th>
                                                                            <th>総得点</th>
                                                                            <th>出題数</th>
                                                                            <th>コース</th>
                                                                            <th>日時</th>
                                                                        </tr>
                                                                    </thead>

                                                                    <tbody>
                                                                        <tr>
                                                                            <td>{entry.averageQuestionScore}</td>
                                                                            <td>{entry.totalScore}</td>
                                                                            <td>{entry.totalQuestions}</td>
                                                                            <td>{entry.courseLabel}</td>
                                                                            <td>{entry.playedAt}</td>
                                                                        </tr>
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
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