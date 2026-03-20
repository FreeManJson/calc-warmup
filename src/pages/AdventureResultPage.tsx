import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

export function AdventureResultPage () {
    const navigate = useNavigate();
    const { latestAdventureResult } = useAppContext();
    const [expandedIndexes, setExpandedIndexes] = useState<number[]>([]);

    if (latestAdventureResult == null) {
        return (
            <div className="page-container">
                <h1>冒険結果</h1>

                <section className="card">
                    <p>まだ冒険結果がありません。</p>

                    <div className="button-row">
                        <button
                            type="button"
                            onClick={() => {
                                navigate('/adventure');
                            }}
                        >
                            冒険モードへ
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

    function toggleExpanded (index: number): void {
        setExpandedIndexes((prev) => {
            if (prev.includes(index) === true) {
                return prev.filter((value) => {
                    return (value !== index);
                });
            }

            return [...prev, index];
        });
    }

    return (
        <div className="page-container">
            <h1>冒険結果</h1>

            <section className="card achievement-card achievement-card-highlight">
                <div className="achievement-title">{latestAdventureResult.dungeonName}</div>
                <div className="achievement-text">
                    到達段階: {latestAdventureResult.reachedStageLabel}
                    {' / '}
                    現在地: {latestAdventureResult.reachedEnemyName}
                </div>
            </section>

            <section className="card">
                <h2>挑戦サマリ</h2>

                <ul className="simple-list">
                    <li>ユーザー: {latestAdventureResult.userName}</li>
                    <li>挑戦ダンジョン: {latestAdventureResult.dungeonName}</li>
                    <li>問題レベル: Lv{latestAdventureResult.problemLevel}</li>
                    <li>挑戦バッジ: {latestAdventureResult.challengeBadgeLabel}</li>
                    <li>経過時間: {formatFixedSeconds(latestAdventureResult.elapsedMs)} 秒 / {latestAdventureResult.totalTimeSec} 秒</li>
                    <li>解答数: {latestAdventureResult.questionsAnswered}</li>
                    <li>正答数: {latestAdventureResult.correctCount}</li>
                    <li>ミス数: {latestAdventureResult.missCount}</li>
                    <li>正答率: {latestAdventureResult.accuracyRate}%</li>
                    <li>総ダメージ: {latestAdventureResult.totalDamage}</li>
                    <li>基本戦力: {latestAdventureResult.totalAttack}</li>
                    <li>今回の有効戦力: {latestAdventureResult.effectiveBattlePower}</li>
                    <li>挑戦後基本戦力: {latestAdventureResult.totalAttackAfterRun}</li>
                    <li>味方倍率: ×{latestAdventureResult.partyAttackRate.toFixed(2)}</li>
                    <li>敵HP倍率: ×{latestAdventureResult.enemyHpRate.toFixed(2)}</li>
                    <li>討伐敵数: {latestAdventureResult.defeatedEnemyNames.length}</li>
                    <li>ボス撃破: {latestAdventureResult.bossDefeated === true ? 'あり' : 'なし'}</li>
                    <li>シークレット出現: {latestAdventureResult.secretAppeared === true ? 'あり' : 'なし'}</li>
                    <li>シークレット撃破: {latestAdventureResult.secretDefeated === true ? 'あり' : 'なし'}</li>
                    <li>日時: {latestAdventureResult.playedAt}</li>
                </ul>
            </section>

            <section className="card">
                <h2>報酬</h2>

                <ul className="simple-list">
                    <li>獲得素材: {latestAdventureResult.materialsEarned} 個（{latestAdventureResult.materialName}）</li>
                    <li>
                        新規錬成:
                        {' '}
                        {latestAdventureResult.newlyCraftedWeaponNames.length > 0
                            ? latestAdventureResult.newlyCraftedWeaponNames.join(' / ')
                            : 'なし'}
                    </li>
                    <li>
                        宝解放:
                        {' '}
                        {latestAdventureResult.treasureUnlockedThisRun === true
                            ? `あり（${latestAdventureResult.treasureName}）`
                            : 'なし'}
                    </li>
                    <li>
                        新規トロフィー:
                        {' '}
                        {latestAdventureResult.trophiesUnlocked.length > 0
                            ? latestAdventureResult.trophiesUnlocked.join(' / ')
                            : 'なし'}
                    </li>
                </ul>
            </section>

            <section className="card">
                <h2>戦闘ログ</h2>

                <div className="result-card-list">
                    {latestAdventureResult.battleLog.map((entry, index) => {
                        const expanded = expandedIndexes.includes(index);

                        return (
                            <article key={entry.questionId} className="result-item-card">
                                <div className="result-item-main">
                                    <div className="result-item-header">
                                        <div className="result-item-title">
                                            <span className="result-item-no">#{index + 1}</span>
                                            <span className={`result-judge-badge ${entry.isCorrect === true ? 'judge-correct' : 'judge-wrong'}`}>
                                                {entry.isCorrect === true ? 'ヒット' : 'ミス'}
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
                                        <div className="result-main-label">敵</div>
                                        <div className="result-main-value">{entry.enemyName}</div>
                                    </div>

                                    <div className="result-main-row">
                                        <div className="result-main-label">問題</div>
                                        <div className="result-main-value">{entry.questionText}</div>
                                    </div>

                                    <div className="result-main-row">
                                        <div className="result-main-label">回答</div>
                                        <div className="result-main-value">{entry.userAnswer}</div>
                                    </div>

                                    <div className="result-main-row compact-grid">
                                        <div>
                                            <div className="result-main-label">ダメージ</div>
                                            <div className="result-main-value">{entry.damage}</div>
                                        </div>

                                        <div>
                                            <div className="result-main-label">残HP</div>
                                            <div className="result-main-value">{entry.enemyRemainingHp}</div>
                                        </div>
                                    </div>
                                </div>

                                {expanded === true && (
                                    <div className="result-item-detail">
                                        <div className="result-detail-row">
                                            <span className="result-detail-label">正解</span>
                                            <span className="result-detail-value">{entry.correctAnswerText}</span>
                                        </div>

                                        <div className="result-detail-row">
                                            <span className="result-detail-label">回答時間</span>
                                            <span className="result-detail-value">{formatFixedSeconds(entry.elapsedMs)} 秒</span>
                                        </div>

                                        <div className="result-detail-row">
                                            <span className="result-detail-label">撃破</span>
                                            <span className="result-detail-value">{entry.enemyDefeated === true ? 'あり' : 'なし'}</span>
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
                            navigate('/adventure');
                        }}
                    >
                        もう一度挑戦
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

function formatFixedSeconds (ms: number): string {
    return Math.max(0, (ms / 1000)).toFixed(1);
}
