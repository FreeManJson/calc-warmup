import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { getCourseLabel } from '../utils/quizUtils';

export function ResultPage () {
    const navigate = useNavigate();
    const { latestResult, startQuiz } = useAppContext();
    const [expandedIndexes, setExpandedIndexes] = useState<number[]>([]);

    if (latestResult == null) {
        return (
            <div className="page-container">
                <h1>結果画面</h1>

                <section className="card">
                    <p>まだ結果がありません。</p>

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

    function handleRetry (): void {
        const started = startQuiz();

        if (started === false) {
            window.alert('開始できませんでした。TOPでコースを確認してください。');
            return;
        }

        navigate('/quiz');
    }

    function toggleExpanded (index: number): void {
        setExpandedIndexes((prev) => {
            const exists = prev.includes(index);

            if (exists === true) {
                return prev.filter((item) => {
                    return (item !== index);
                });
            }

            return [...prev, index];
        });
    }

    return (
        <div className="page-container">
            <h1>結果画面</h1>

            <section className="card">
                <h2>結果サマリ</h2>

                <ul className="simple-list">
                    <li>ユーザー: {latestResult.userName}</li>
                    <li>コース: {latestResult.courseLabel}</li>
                    <li>出題数: {latestResult.totalQuestions}</li>
                    <li>正答数: {latestResult.correctCount}</li>
                    <li>正答率: {latestResult.accuracyRate}%</li>
                    <li>平均回答時間: {latestResult.averageAnswerMs} ms</li>
                    <li>総得点: {latestResult.totalScore}</li>
                    <li>1問平均点: {latestResult.averageQuestionScore}</li>
                    <li>出題数ボーナス係数: ×{latestResult.questionCountBonusFactor}</li>
                    <li>ランキング用スコア: {latestResult.rankingScore}</li>
                    <li>
                        ランキング反映:
                        {latestResult.rankingEligible === true
                            ? ' 対象'
                            : ` 対象外（${latestResult.rankingIneligibleReason ?? '理由なし'}）`}
                    </li>
                    <li>日時: {latestResult.playedAt}</li>
                </ul>
            </section>

            <section className="card">
                <h2>問題別結果</h2>

                <div className="result-card-list">
                    {latestResult.answers.map((answer, index) => {
                        const expanded = expandedIndexes.includes(index);

                        return (
                            <article key={answer.questionId} className="result-item-card">
                                <div className="result-item-main">
                                    <div className="result-item-header">
                                        <div className="result-item-title">
                                            <span className="result-item-no">#{index + 1}</span>
                                            <span className={`result-judge-badge ${
                                                answer.isTimeout === true
                                                    ? 'judge-timeout'
                                                    : (answer.isCorrect === true ? 'judge-correct' : 'judge-wrong')
                                            }`}>
                                                {answer.isTimeout === true
                                                    ? '時間切れ'
                                                    : (answer.isCorrect === true ? '正解' : '不正解')}
                                            </span>
                                        </div>

                                        <button
                                            type="button"
                                            className="expand-button"
                                            onClick={() => {
                                                toggleExpanded(index);
                                            }}
                                            aria-expanded={expanded}
                                            aria-label={expanded ? '詳細を閉じる' : '詳細を開く'}
                                        >
                                            {expanded === true ? '−' : '+'}
                                        </button>
                                    </div>

                                    <div className="result-main-row">
                                        <div className="result-main-label">問題</div>
                                        <div className="result-main-value">{answer.questionText}</div>
                                    </div>

                                    <div className="result-main-row">
                                        <div className="result-main-label">回答</div>
                                        <div className="result-main-value">{answer.userAnswer}</div>
                                    </div>

                                    <div className="result-main-row">
                                        <div className="result-main-label">正解</div>
                                        <div className="result-main-value strong-answer">{answer.correctAnswerText}</div>
                                    </div>

                                    <div className="result-main-row compact-grid">
                                        <div>
                                            <div className="result-main-label">時間</div>
                                            <div className="result-main-value">{answer.elapsedMs} ms</div>
                                        </div>

                                        <div>
                                            <div className="result-main-label">得点</div>
                                            <div className="result-main-value">{answer.score}</div>
                                        </div>
                                    </div>
                                </div>

                                {expanded === true && (
                                    <div className="result-item-detail">
                                        <div className="result-detail-row">
                                            <span className="result-detail-label">コース</span>
                                            <span className="result-detail-value">{getCourseLabel(answer.course)}</span>
                                        </div>

                                        <div className="result-detail-row">
                                            <span className="result-detail-label">難易度点</span>
                                            <span className="result-detail-value">{answer.scoreDetail.difficultyScore}</span>
                                        </div>

                                        <div className="result-detail-row">
                                            <span className="result-detail-label">期待時間</span>
                                            <span className="result-detail-value">{answer.scoreDetail.expectedTimeMs} ms</span>
                                        </div>

                                        <div className="result-detail-row">
                                            <span className="result-detail-label">速度係数</span>
                                            <span className="result-detail-value">{answer.scoreDetail.speedFactor.toFixed(2)}</span>
                                        </div>

                                        <div className="result-detail-row">
                                            <span className="result-detail-label">制限係数</span>
                                            <span className="result-detail-value">{answer.scoreDetail.timeLimitFactor.toFixed(2)}</span>
                                        </div>
                                    </div>
                                )}
                            </article>
                        );
                    })}
                </div>
            </section>

            <section className="card">
                <div className="button-row">
                    <button
                        type="button"
                        onClick={() => {
                            handleRetry();
                        }}
                    >
                        リトライ
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            navigate('/ranking');
                        }}
                    >
                        ランキングへ
                    </button>

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