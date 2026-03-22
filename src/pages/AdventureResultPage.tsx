import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { defaultFantasyTheme } from '../themes/defaultFantasyTheme';
import { useAppContext } from '../context/AppContext';
import { getBadgeLabel, getStageLabel } from '../utils/adventureUtils';
import { getCourseLabelText } from '../utils/quizUtils';

export function AdventureResultPage () {
    const navigate = useNavigate();
    const {
        latestAdventureResult,
        startAdventure,
    } = useAppContext();

    const badgeText = useMemo(() => {
        if (latestAdventureResult == null) {
            return '';
        }

        return getBadgeLabel(latestAdventureResult.settingsSnapshot, defaultFantasyTheme);
    }, [latestAdventureResult]);

    if (latestAdventureResult == null) {
        return (
            <div className="page-container">
                <section className="card">
                    <h1>冒険結果</h1>
                    <p>表示できる冒険結果がありません。</p>
                    <div className="button-row top-gap">
                        <button
                            type="button"
                            onClick={() => {
                                navigate('/adventure');
                            }}
                        >
                            ダンジョン選択へ戻る
                        </button>
                    </div>
                </section>
            </div>
        );
    }

    function handleRetry (): void {
        if (latestAdventureResult == null) {
            return;
        }

        const started = startAdventure(
            latestAdventureResult.dungeonId,
            latestAdventureResult.settingsSnapshot
        );

        if (started === false) {
            window.alert('同条件での再出発に失敗しました。');
            return;
        }

        navigate('/adventure/play');
    }

    return (
        <div className="page-container">
            <section className={`card achievement-card ${latestAdventureResult.cleared === true ? 'achievement-card-highlight' : 'achievement-card-muted'}`}>
                <div className="achievement-row">
                    <div>
                        <h1 className="achievement-title">
                            {latestAdventureResult.cleared === true ? '冒険成功！' : '時間切れで撤退'}
                        </h1>
                        <p className="achievement-text">
                            {latestAdventureResult.userName} / {latestAdventureResult.dungeonName}
                        </p>
                    </div>

                    <span className="mode-badge">{latestAdventureResult.secretAppeared === true ? 'シークレット到達' : '通常クリア'}</span>
                </div>
            </section>

            <section className="card">
                <h2>結果サマリ</h2>

                <div className="form-grid">
                    <ul className="simple-list compact-list">
                        <li>演算: {getCourseLabelText(latestAdventureResult.settingsSnapshot.selectedCourses)}</li>
                        <li>バッジ: {badgeText}</li>
                        <li>問題Lv: {latestAdventureResult.preview.questionLevel}</li>
                        <li>所要時間: {(latestAdventureResult.totalElapsedMs / 1000).toFixed(1)}秒</li>
                    </ul>

                    <ul className="simple-list compact-list">
                        <li>回答数: {latestAdventureResult.answeredCount}</li>
                        <li>正解: {latestAdventureResult.correctCount}</li>
                        <li>ミス: {latestAdventureResult.missCount}</li>
                        <li>時間切れ: {latestAdventureResult.timeoutCount}</li>
                    </ul>

                    <ul className="simple-list compact-list">
                        <li>累計ダメージ: {latestAdventureResult.totalDamage}</li>
                        <li>撃破段階: {latestAdventureResult.defeatedStages.map((stageKey) => { return getStageLabel(stageKey); }).join(' / ') || 'なし'}</li>
                        <li>素材獲得: {latestAdventureResult.materialEarned}個</li>
                        <li>宝獲得: {latestAdventureResult.treasureEarned === true ? 'あり' : 'なし'}</li>
                    </ul>
                </div>
            </section>

            <section className="card">
                <h2>戦闘ログ</h2>

                <div className="result-card-list">
                    {latestAdventureResult.battleLog.slice().reverse().map((entry, index) => {
                        return (
                            <article key={`${entry.questionId}-${index}`} className="result-item-card">
                                <div className="result-item-main">
                                    <div className="result-item-header">
                                        <div className="result-item-title">
                                            <span className="result-item-no">#{latestAdventureResult.battleLog.length - index}</span>
                                            <span className={`result-judge-badge ${entry.isCorrect === true ? 'judge-correct' : (entry.isTimeout === true ? 'judge-timeout' : 'judge-wrong')}`}>
                                                {entry.isCorrect === true ? 'ヒット' : (entry.isTimeout === true ? '時間切れ' : 'ミス')}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="result-main-row">
                                        <div className="result-main-label">問題</div>
                                        <div className="result-main-value">{entry.expression}</div>
                                    </div>

                                    <div className="result-main-row">
                                        <div className="result-main-label">回答</div>
                                        <div className="result-main-value">{entry.userAnswer.length > 0 ? entry.userAnswer : '未入力'}</div>
                                    </div>

                                    <div className="result-main-row">
                                        <div className="result-main-label">結果</div>
                                        <div className="result-main-value">
                                            正解 {entry.correctAnswerText} / ダメージ {entry.damage}
                                            {entry.defeatedStages.length > 0 && (
                                                <>
                                                    {' '}
                                                    / 撃破 {entry.defeatedStages.map((stageKey) => { return getStageLabel(stageKey); }).join(' / ')}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            </section>

            <section className="card">
                <div className="button-row">
                    <button
                        type="button"
                        className="primary-button"
                        onClick={() => {
                            handleRetry();
                        }}
                    >
                        同条件でもう一度出発
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            navigate('/adventure');
                        }}
                    >
                        ダンジョン選択へ戻る
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
