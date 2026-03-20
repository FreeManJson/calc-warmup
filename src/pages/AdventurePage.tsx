import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import type {
    AdventureBattleLogEntry,
    AdventureEnemyState,
    EnemySlotType,
    GeneratedQuestion,
    InputMethodType,
} from '../types/appTypes';
import {
    compareAnswer,
} from '../utils/quizUtils';
import {
    ADVENTURE_CONSTANTS,
    applyAdventureRewards,
    buildAdventureEnemySequence,
    buildAdventureQuestionPool,
    buildAdventureResult,
    calculateTotalAttack,
    getAdventureDungeonById,
    getPartyMemberLabel,
    getRecommendedAttackForDungeon,
} from '../utils/adventureUtils';

type AdventurePhase = 'select' | 'countdown' | 'active' | 'feedback';
type ActiveInputModeType = 'keyboard' | 'tile';
type FeedbackKindType = 'correct' | 'wrong' | 'timeout' | null;

export function AdventurePage () {
    const navigate = useNavigate();
    const {
        users,
        selectedUserId,
        quizSettings,
        adventureTheme,
        adventureProgress,
        setAdventureProgress,
        setLatestAdventureResult,
    } = useAppContext();

    const [selectedDungeonId, setSelectedDungeonId] = useState<string>(() => {
        return adventureTheme.dungeons[0]?.id ?? '';
    });
    const [phase, setPhase] = useState<AdventurePhase>('select');
    const [countdownValue, setCountdownValue] = useState<number>(3);
    const [questionPool, setQuestionPool] = useState<GeneratedQuestion[]>([]);
    const [questionIndex, setQuestionIndex] = useState<number>(0);
    const [inputValue, setInputValue] = useState<string>('');
    const [battleLog, setBattleLog] = useState<AdventureBattleLogEntry[]>([]);
    const [enemies, setEnemies] = useState<AdventureEnemyState[]>([]);
    const [currentEnemyIndex, setCurrentEnemyIndex] = useState<number>(0);
    const [defeatedEnemySlots, setDefeatedEnemySlots] = useState<EnemySlotType[]>([]);
    const [secretAppeared, setSecretAppeared] = useState<boolean>(false);
    const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
    const [questionStartedAt, setQuestionStartedAt] = useState<number | null>(null);
    const [totalPausedMs, setTotalPausedMs] = useState<number>(0);
    const [nowTick, setNowTick] = useState<number>(Date.now());
    const [activeInputMode, setActiveInputMode] = useState<ActiveInputModeType>(() => {
        return resolveInitialInteractiveInputMode('auto');
    });
    const [feedbackClassName, setFeedbackClassName] = useState<string>('');
    const [feedbackText, setFeedbackText] = useState<string>('');
    const [feedbackKind, setFeedbackKind] = useState<FeedbackKindType>(null);
    const [feedbackSymbol, setFeedbackSymbol] = useState<string>('');
    const [feedbackSubText, setFeedbackSubText] = useState<string>('');
    const [feedbackEquationLeft, setFeedbackEquationLeft] = useState<string>('');
    const [feedbackEquationAnswer, setFeedbackEquationAnswer] = useState<string>('');

    const answerInputRef = useRef<HTMLInputElement | null>(null);
    const nextTimeoutRef = useRef<number | null>(null);
    const isComposingRef = useRef<boolean>(false);
    const feedbackStartedAtRef = useRef<number | null>(null);

    const selectedDungeon = useMemo(() => {
        return getAdventureDungeonById(adventureTheme, selectedDungeonId);
    }, [adventureTheme, selectedDungeonId]);

    const selectedDungeonProgress = useMemo(() => {
        return adventureProgress.dungeonProgressById[selectedDungeonId] ?? {
            materialCount: 0,
            craftedWeaponMemberKeys: [],
            treasureUnlocked: false,
            clearCount: 0,
            bossKillCount: 0,
            secretKillCount: 0,
        };
    }, [adventureProgress.dungeonProgressById, selectedDungeonId]);

    const totalAttack = useMemo(() => {
        return calculateTotalAttack(adventureProgress, adventureTheme);
    }, [adventureProgress, adventureTheme]);

    const currentQuestion = useMemo(() => {
        return questionPool[questionIndex] ?? null;
    }, [questionPool, questionIndex]);

    const currentEnemy = useMemo(() => {
        return enemies[currentEnemyIndex] ?? null;
    }, [enemies, currentEnemyIndex]);

    const sessionElapsedMs = useMemo(() => {
        return getEffectiveSessionElapsedMs(
            sessionStartedAt,
            totalPausedMs,
            feedbackStartedAtRef.current,
            nowTick
        );
    }, [sessionStartedAt, totalPausedMs, nowTick]);

    const currentQuestionElapsedMs = useMemo(() => {
        if (questionStartedAt == null) {
            return 0;
        }

        return Math.max(0, (nowTick - questionStartedAt));
    }, [questionStartedAt, nowTick]);

    const remainingMs = Math.max(0, ((ADVENTURE_CONSTANTS.totalTimeSec * 1000) - sessionElapsedMs));

    const decimalKeyEnabled = (
        (quizSettings.allowDecimal === true) ||
        (quizSettings.allowRealDivision === true)
    );

    const minusKeyEnabled = (
        (quizSettings.allowNegative === true) ||
        ((currentQuestion?.expectedNumber ?? 0) < 0)
    );

    const spaceKeyEnabled = (
        currentQuestion?.answerKind === 'quotientRemainder'
    );

    const questionCountText = (
        battleLog.length > 0
            ? `${battleLog.length + 1}問目`
            : '1問目'
    );

    const canSubmitCurrentAnswer = (inputValue.trim().length > 0);

    useEffect(() => {
        return () => {
            if (nextTimeoutRef.current != null) {
                window.clearTimeout(nextTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (phase !== 'countdown') {
            return;
        }

        if (countdownValue <= 0) {
            const now = Date.now();
            setPhase('active');
            setSessionStartedAt(now);
            setQuestionStartedAt(now);
            setTotalPausedMs(0);
            feedbackStartedAtRef.current = null;
            setNowTick(now);
            return;
        }

        const timerId = window.setTimeout(() => {
            setCountdownValue((prev) => {
                return (prev - 1);
            });
        }, 1000);

        return () => {
            window.clearTimeout(timerId);
        };
    }, [phase, countdownValue]);

    useEffect(() => {
        if (phase !== 'active') {
            return;
        }

        const intervalId = window.setInterval(() => {
            const now = Date.now();
            const effectiveElapsedMs = getEffectiveSessionElapsedMs(
                sessionStartedAt,
                totalPausedMs,
                feedbackStartedAtRef.current,
                now
            );

            setNowTick(now);

            if (effectiveElapsedMs >= (ADVENTURE_CONSTANTS.totalTimeSec * 1000)) {
                window.clearInterval(intervalId);
                finishAdventure({
                    finalBattleLog: battleLog,
                    finalDefeatedEnemySlots: defeatedEnemySlots,
                    finalSecretAppeared: secretAppeared,
                });
            }
        }, 100);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [
        phase,
        sessionStartedAt,
        totalPausedMs,
        battleLog,
        defeatedEnemySlots,
        secretAppeared,
    ]);

    useEffect(() => {
        if (phase !== 'active') {
            return;
        }

        if (activeInputMode !== 'keyboard') {
            answerInputRef.current?.blur();
            return;
        }

        const timerId = window.setTimeout(() => {
            answerInputRef.current?.focus();
            answerInputRef.current?.select();
        }, 0);

        return () => {
            window.clearTimeout(timerId);
        };
    }, [phase, questionIndex, activeInputMode]);

    const finishAdventure = useCallback((options?: {
        finalBattleLog?: AdventureBattleLogEntry[];
        finalDefeatedEnemySlots?: EnemySlotType[];
        finalSecretAppeared?: boolean;
    }) => {
        if (nextTimeoutRef.current != null) {
            window.clearTimeout(nextTimeoutRef.current);
            nextTimeoutRef.current = null;
        }

        const finalBattleLog = options?.finalBattleLog ?? battleLog;
        const finalDefeatedEnemySlots = options?.finalDefeatedEnemySlots ?? defeatedEnemySlots;
        const finalSecretAppeared = options?.finalSecretAppeared ?? secretAppeared;
        const missCount = finalBattleLog.filter((entry) => {
            return (entry.isCorrect === false);
        }).length;
        const userName = users.find((user) => {
            return (user.id === selectedUserId);
        })?.name ?? 'ゲスト';
        const rewardResolution = applyAdventureRewards(
            adventureProgress,
            adventureTheme,
            selectedDungeonId,
            finalDefeatedEnemySlots,
            missCount
        );

        setAdventureProgress(rewardResolution.nextProgress);

        const result = buildAdventureResult({
            userName,
            theme: adventureTheme,
            dungeonId: selectedDungeonId,
            totalTimeSec: ADVENTURE_CONSTANTS.totalTimeSec,
            elapsedMs: Math.min(
                getEffectiveSessionElapsedMs(
                    sessionStartedAt,
                    totalPausedMs,
                    feedbackStartedAtRef.current,
                    Date.now()
                ),
                (ADVENTURE_CONSTANTS.totalTimeSec * 1000)
            ),
            totalAttack,
            totalAttackAfterRun: rewardResolution.totalAttackAfterRun,
            battleLog: finalBattleLog,
            defeatedEnemySlots: finalDefeatedEnemySlots,
            secretAppeared: finalSecretAppeared,
            materialsEarned: rewardResolution.materialsEarned,
            newlyCraftedWeaponNames: rewardResolution.newlyCraftedWeaponNames,
            treasureUnlockedThisRun: rewardResolution.treasureUnlockedThisRun,
            trophiesUnlocked: rewardResolution.trophiesUnlocked,
        });

        setLatestAdventureResult(result);
        navigate('/adventure-result');
    }, [
        battleLog,
        defeatedEnemySlots,
        secretAppeared,
        users,
        selectedUserId,
        adventureProgress,
        adventureTheme,
        selectedDungeonId,
        setAdventureProgress,
        sessionStartedAt,
        totalAttack,
        totalPausedMs,
        setLatestAdventureResult,
        navigate,
    ]);

    function startAdventure (overrideDungeonId?: string): void {
        if (nextTimeoutRef.current != null) {
            window.clearTimeout(nextTimeoutRef.current);
            nextTimeoutRef.current = null;
        }

        const targetDungeonId = overrideDungeonId ?? selectedDungeonId;

        setSelectedDungeonId(targetDungeonId);
        setQuestionPool(buildAdventureQuestionPool(quizSettings));
        setQuestionIndex(0);
        setInputValue('');
        setBattleLog([]);
        setEnemies(buildAdventureEnemySequence(adventureTheme, targetDungeonId));
        setCurrentEnemyIndex(0);
        setDefeatedEnemySlots([]);
        setSecretAppeared(false);
        setSessionStartedAt(null);
        setQuestionStartedAt(null);
        setTotalPausedMs(0);
        feedbackStartedAtRef.current = null;
        setNowTick(Date.now());
        setActiveInputMode(resolveInitialInteractiveInputMode(quizSettings.inputMethod));
        clearFeedbackState();
        setCountdownValue(3);
        setPhase('countdown');
    }

    function clearFeedbackState (): void {
        setFeedbackClassName('');
        setFeedbackText('');
        setFeedbackKind(null);
        setFeedbackSymbol('');
        setFeedbackSubText('');
        setFeedbackEquationLeft('');
        setFeedbackEquationAnswer('');
    }

    function proceedToNextQuestion (nextQuestionPool?: GeneratedQuestion[]): void {
        const poolSource = nextQuestionPool ?? questionPool;
        let resolvedPool = poolSource;
        let nextQuestionIndex = (questionIndex + 1);

        if (nextQuestionIndex >= resolvedPool.length) {
            resolvedPool = [...resolvedPool, ...buildAdventureQuestionPool(quizSettings)];
            nextQuestionIndex = (questionIndex + 1);
            setQuestionPool(resolvedPool);
        }

        const now = Date.now();

        if (feedbackStartedAtRef.current != null) {
            setTotalPausedMs((prev) => {
                return (prev + Math.max(0, (now - feedbackStartedAtRef.current!)));
            });
            feedbackStartedAtRef.current = null;
        }

        setQuestionIndex(nextQuestionIndex);
        setInputValue('');
        setPhase('active');
        clearFeedbackState();
        setQuestionStartedAt(now);
        setNowTick(now);
    }

    function handleStartAnotherRun (): void {
        const confirmed = window.confirm('同じ設定のまま冒険モードをやり直しますか？');

        if (confirmed === false) {
            return;
        }

        setPhase('select');
        clearFeedbackState();
    }

    function handleBackToTop (): void {
        const confirmed = window.confirm('TOPへ戻ります。現在の挑戦は終了します。');

        if (confirmed === false) {
            return;
        }

        if (nextTimeoutRef.current != null) {
            window.clearTimeout(nextTimeoutRef.current);
            nextTimeoutRef.current = null;
        }

        navigate('/');
    }

    function handleSubmit (event: React.FormEvent<HTMLFormElement>): void {
        event.preventDefault();

        if (canSubmitCurrentAnswer === false) {
            return;
        }

        settleCurrentQuestion('submit');
    }

    function settleCurrentQuestion (mode: 'submit' | 'timeout'): void {
        if (
            (currentQuestion == null) ||
            (currentEnemy == null) ||
            ((phase !== 'active') && (phase !== 'feedback'))
        ) {
            return;
        }

        const now = Date.now();
        const effectiveElapsedMs = (
            questionStartedAt == null
                ? 0
                : Math.max(0, (now - questionStartedAt))
        );
        const compareResult = (
            mode === 'timeout'
                ? { isCorrect: false, normalizedInput: '(時間切れ)' }
                : compareAnswer(currentQuestion, inputValue)
        );
        const isCorrect = (
            (mode !== 'timeout') &&
            (compareResult.isCorrect === true)
        );
        const damage = (isCorrect === true ? totalAttack : 0);
        const nextEnemies = enemies.map((enemy, index) => {
            if (index !== currentEnemyIndex) {
                return enemy;
            }

            const nextHp = Math.max(0, (enemy.currentHp - damage));
            return {
                ...enemy,
                currentHp: nextHp,
                defeated: (nextHp <= 0),
            };
        });
        const updatedEnemy = nextEnemies[currentEnemyIndex];
        const enemyDefeated = (updatedEnemy.currentHp <= 0);

        let nextDefeatedEnemySlots = defeatedEnemySlots;

        if ((enemyDefeated === true) && (defeatedEnemySlots.includes(currentEnemy.slot) === false)) {
            nextDefeatedEnemySlots = [...defeatedEnemySlots, currentEnemy.slot];
            setDefeatedEnemySlots(nextDefeatedEnemySlots);
        }

        setEnemies(nextEnemies);

        let nextEnemyIndex = currentEnemyIndex;
        let nextSecretAppeared = secretAppeared;
        let shouldFinish = false;

        if (enemyDefeated === true) {
            if (currentEnemy.slot === 'boss') {
                const clearedWithinSecretLimit = (
                    sessionStartedAt != null &&
                    ((now - sessionStartedAt) <= (ADVENTURE_CONSTANTS.secretBossTimeLimitSec * 1000))
                );

                if (clearedWithinSecretLimit === true) {
                    nextEnemyIndex = Math.min((currentEnemyIndex + 1), (nextEnemies.length - 1));
                    nextSecretAppeared = true;
                    setSecretAppeared(true);
                    setCurrentEnemyIndex(nextEnemyIndex);
                } else {
                    shouldFinish = true;
                }
            } else if (currentEnemy.slot === 'secret') {
                shouldFinish = true;
            } else {
                nextEnemyIndex = Math.min((currentEnemyIndex + 1), (nextEnemies.length - 1));
                setCurrentEnemyIndex(nextEnemyIndex);
            }
        }

        const nextBattleLog = [
            ...battleLog,
            {
                questionId: currentQuestion.id,
                questionText: currentQuestion.expression,
                userAnswer: (
                    mode === 'timeout'
                        ? '(時間切れ)'
                        : (
                            compareResult.normalizedInput.trim().length > 0
                                ? compareResult.normalizedInput
                                : '(未入力)'
                        )
                ),
                correctAnswerText: currentQuestion.correctText,
                elapsedMs: effectiveElapsedMs,
                isCorrect,
                isTimeout: (mode === 'timeout'),
                damage,
                enemySlot: currentEnemy.slot,
                enemyName: currentEnemy.name,
                enemyRemainingHp: updatedEnemy.currentHp,
                enemyDefeated,
            },
        ];

        setBattleLog(nextBattleLog);
        setInputValue('');
        setPhase('feedback');
        feedbackStartedAtRef.current = now;
        setNowTick(now);

        const feedbackEquation = buildFeedbackEquation(
            currentQuestion.expression,
            currentQuestion.correctText
        );

        if (mode === 'timeout') {
            setFeedbackClassName('feedback-timeout');
            setFeedbackText('時間切れ');
            setFeedbackKind('timeout');
            setFeedbackSymbol('!');
            setFeedbackSubText('今回は 0 ダメージ');
        } else if (isCorrect === true) {
            setFeedbackClassName('feedback-correct');
            setFeedbackText('ヒット！');
            setFeedbackKind('correct');
            setFeedbackSymbol('⚔');
            setFeedbackSubText(`${currentEnemy.name} に ${damage} ダメージ`);
        } else {
            setFeedbackClassName('feedback-wrong');
            setFeedbackText('ミス');
            setFeedbackKind('wrong');
            setFeedbackSymbol('×');
            setFeedbackSubText('0 ダメージ');
        }

        setFeedbackEquationLeft(feedbackEquation.leftText);
        setFeedbackEquationAnswer(feedbackEquation.answerText);

        if (nextTimeoutRef.current != null) {
            window.clearTimeout(nextTimeoutRef.current);
        }

        const delayMs = (
            mode === 'timeout'
                ? ADVENTURE_CONSTANTS.feedbackDelayMs.timeout
                : (isCorrect === true ? ADVENTURE_CONSTANTS.feedbackDelayMs.correct : ADVENTURE_CONSTANTS.feedbackDelayMs.wrong)
        );

        nextTimeoutRef.current = window.setTimeout(() => {
            if (shouldFinish === true) {
                finishAdventure({
                    finalBattleLog: nextBattleLog,
                    finalDefeatedEnemySlots: nextDefeatedEnemySlots,
                    finalSecretAppeared: nextSecretAppeared,
                });
                return;
            }

            proceedToNextQuestion();
        }, delayMs);
    }

    function handleInputKeyDown (event: React.KeyboardEvent<HTMLInputElement>): void {
        if (isComposingRef.current === true) {
            return;
        }

        if (event.key !== 'Enter') {
            return;
        }

        event.preventDefault();

        if ((phase === 'active') && (canSubmitCurrentAnswer === true)) {
            settleCurrentQuestion('submit');
        }
    }

    function switchToKeyboardMode (): void {
        if (phase !== 'active') {
            return;
        }

        setActiveInputMode('keyboard');

        window.setTimeout(() => {
            answerInputRef.current?.focus();
            answerInputRef.current?.select();
        }, 0);
    }

    function switchToTileMode (): void {
        if (phase !== 'active') {
            return;
        }

        setActiveInputMode('tile');
        answerInputRef.current?.blur();
    }

    function appendInputValue (text: string): void {
        if (phase !== 'active') {
            return;
        }

        switchToTileMode();
        setInputValue((prev) => {
            return (prev + text);
        });
    }

    function backspaceInputValue (): void {
        if (phase !== 'active') {
            return;
        }

        switchToTileMode();
        setInputValue((prev) => {
            return prev.slice(0, -1);
        });
    }

    function clearInputValue (): void {
        if (phase !== 'active') {
            return;
        }

        switchToTileMode();
        setInputValue('');
    }

    function handleTileSubmit (): void {
        if ((phase !== 'active') || (canSubmitCurrentAnswer === false)) {
            return;
        }

        settleCurrentQuestion('submit');
    }

    function handleDungeonSelect (dungeonId: string): void {
        if (phase !== 'select') {
            return;
        }

        setSelectedDungeonId(dungeonId);

        const dungeon = getAdventureDungeonById(adventureTheme, dungeonId);
        const confirmed = window.confirm(`${dungeon.name} に挑戦しますか？`);

        if (confirmed === true) {
            startAdventure(dungeonId);
        }
    }

    return (
        <div className="page-container">
            <header className="quiz-header">
                <div>
                    <h1>{adventureTheme.adventureModeLabel}</h1>
                    <p className="sub-text">
                        通常モードの計算設定を土台にしつつ、{ADVENTURE_CONSTANTS.totalTimeSec}秒 でダンジョンを攻略します。
                    </p>
                </div>

                <div className="button-row">
                    <button
                        type="button"
                        onClick={() => {
                            handleBackToTop();
                        }}
                    >
                        TOPへ戻る
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            handleStartAnotherRun();
                        }}
                        disabled={(phase === 'countdown') || (phase === 'active') || (phase === 'feedback')}
                    >
                        再挑戦準備
                    </button>
                </div>
            </header>

            {phase === 'select' && (
                <section className="card">
                    <h2>ダンジョン選択</h2>

                    <div className="dungeon-grid">
                        {adventureTheme.dungeons.map((dungeon) => {
                            const dungeonProgress = adventureProgress.dungeonProgressById[dungeon.id];
                            const selected = (dungeon.id === selectedDungeonId);
                            const recommendedAttack = getRecommendedAttackForDungeon(dungeon.id);

                            return (
                                <button
                                    key={dungeon.id}
                                    type="button"
                                    className={`dungeon-card-button ${selected === true ? 'is-selected' : ''}`}
                                    disabled={(phase === 'countdown') || (phase === 'active') || (phase === 'feedback')}
                                    onClick={() => {
                                        handleDungeonSelect(dungeon.id);
                                    }}
                                >
                                    <div className="dungeon-card-title">{dungeon.name}</div>
                                    <div className="dungeon-card-sub">推奨攻撃力 {recommendedAttack}</div>
                                    <div className="dungeon-card-sub">素材 {dungeonProgress?.materialCount ?? 0} 個</div>
                                    <div className="dungeon-card-sub">武器 {dungeonProgress?.craftedWeaponMemberKeys.length ?? 0} / {adventureTheme.partyMembers.length}</div>
                                </button>
                            );
                        })}
                    </div>

                    <p className="sub-text top-gap">
                        ダンジョンカードを押すと、そのまま挑戦確認が表示されます。
                    </p>
                </section>
            )}

            {phase === 'select' && (
                <section className="card adventure-status-card">
                    <h2>挑戦情報</h2>

                    <div className="adventure-overview-grid">
                        <div className="adventure-overview-item">
                            <div className="adventure-overview-label">総攻撃力</div>
                            <div className="adventure-overview-value">{totalAttack}</div>
                        </div>

                        <div className="adventure-overview-item">
                            <div className="adventure-overview-label">所持素材</div>
                            <div className="adventure-overview-value">{selectedDungeonProgress.materialCount}</div>
                        </div>

                        <div className="adventure-overview-item">
                            <div className="adventure-overview-label">武器錬成</div>
                            <div className="adventure-overview-value">{selectedDungeonProgress.craftedWeaponMemberKeys.length} / {adventureTheme.partyMembers.length}</div>
                        </div>

                        <div className="adventure-overview-item">
                            <div className="adventure-overview-label">秘匿条件</div>
                            <div className="adventure-overview-value">{ADVENTURE_CONSTANTS.secretBossTimeLimitSec}秒以内にボス撃破</div>
                        </div>
                    </div>

                    <div className="party-chip-row top-gap">
                        {adventureTheme.partyMembers.map((member) => {
                            const crafted = selectedDungeonProgress.craftedWeaponMemberKeys.includes(member.key);
                            const weaponName = crafted === true
                                ? selectedDungeon.weaponNames[member.key]
                                : member.baseWeaponName;

                            return (
                                <div key={member.key} className={`party-chip ${crafted === true ? 'is-crafted' : ''}`}>
                                    <div className="party-chip-title">{getPartyMemberLabel(adventureTheme, member.key)}</div>
                                    <div className="party-chip-sub">{weaponName}</div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {phase === 'countdown' && (
                <section className="card">
                    <h2>カウントダウン</h2>
                    <p className="sub-text">{selectedDungeon.name} に出発します。</p>
                    <div className="big-display">{countdownValue}</div>
                </section>
            )}

            {((phase === 'active') || (phase === 'feedback')) && (
                <>
                    <section className="card">
                        <div className="status-row">
                            <div>
                                <strong>{selectedDungeon.name}</strong>
                                <div className="sub-text">{questionCountText}</div>
                            </div>

                            <div className="timer-badge">
                                残り: {formatAdventureSeconds(remainingMs)} 秒
                            </div>
                        </div>

                        <div className="status-row adventure-status-line">
                            <div><strong>現在の敵:</strong> {currentEnemy?.name ?? '---'}</div>
                            <div><strong>経過:</strong> {formatAdventureSeconds(sessionElapsedMs)} 秒</div>
                            <div><strong>今回の問題時間:</strong> {formatAdventureSeconds(currentQuestionElapsedMs)} 秒</div>
                        </div>

                        {currentEnemy != null && (
                            <div className="enemy-hp-block">
                                <div className="enemy-hp-label">
                                    HP {currentEnemy.currentHp} / {currentEnemy.maxHp}
                                </div>
                                <div className="enemy-hp-bar">
                                    <div
                                        className="enemy-hp-bar-fill"
                                        style={{ width: `${Math.max(0, (currentEnemy.currentHp / currentEnemy.maxHp) * 100)}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="defeated-chip-row">
                            {renderEnemyChip(selectedDungeon.enemyNames.mobA, defeatedEnemySlots.includes('mobA'))}
                            {renderEnemyChip(selectedDungeon.enemyNames.mobB, defeatedEnemySlots.includes('mobB'))}
                            {renderEnemyChip(selectedDungeon.enemyNames.mobC, defeatedEnemySlots.includes('mobC'))}
                            {renderEnemyChip(selectedDungeon.enemyNames.boss, defeatedEnemySlots.includes('boss'))}
                            {renderEnemyChip(
                                selectedDungeon.enemyNames.secret,
                                defeatedEnemySlots.includes('secret'),
                                (secretAppeared === false) && (defeatedEnemySlots.includes('secret') === false)
                            )}
                        </div>
                    </section>

                    <section className="card">
                        <div className="mode-row">
                            <div className="mode-badge">
                                現在の入力方式: {activeInputMode === 'keyboard' ? 'キーボード' : '数字タイル'}
                            </div>

                            <div className="segmented-row">
                                <button
                                    type="button"
                                    className={`segmented-button ${activeInputMode === 'keyboard' ? 'is-selected' : ''}`}
                                    onClick={() => {
                                        switchToKeyboardMode();
                                    }}
                                >
                                    キーボード入力
                                </button>

                                <button
                                    type="button"
                                    className={`segmented-button ${activeInputMode === 'tile' ? 'is-selected' : ''}`}
                                    onClick={() => {
                                        switchToTileMode();
                                    }}
                                >
                                    数字タイル入力
                                </button>
                            </div>
                        </div>

                        <h2>問題</h2>
                        <div className="question-box">{currentQuestion?.expression ?? '問題準備中...'}</div>

                        {currentQuestion?.inputHint != null && (
                            <p className="sub-text">{currentQuestion.inputHint}</p>
                        )}

                        <form onSubmit={handleSubmit}>
                            <label>
                                回答入力
                                <input
                                    ref={answerInputRef}
                                    className="input-control"
                                    type="text"
                                    value={inputValue}
                                    disabled={phase !== 'active'}
                                    placeholder="ここに答えを入力"
                                    inputMode={
                                        currentQuestion?.answerKind === 'quotientRemainder'
                                            ? 'text'
                                            : (
                                                currentQuestion?.course === 'div' &&
                                                currentQuestion.inputHint?.includes('小数') === true
                                                    ? 'decimal'
                                                    : 'numeric'
                                            )
                                    }
                                    enterKeyHint="done"
                                    autoComplete="off"
                                    autoCapitalize="off"
                                    spellCheck={false}
                                    lang="en"
                                    pattern={
                                        currentQuestion?.answerKind === 'quotientRemainder'
                                            ? '[0-9\- ]*'
                                            : '[0-9\-\.]*'
                                    }
                                    onFocus={() => {
                                        setActiveInputMode('keyboard');
                                    }}
                                    onCompositionStart={() => {
                                        isComposingRef.current = true;
                                    }}
                                    onCompositionEnd={() => {
                                        isComposingRef.current = false;
                                    }}
                                    onKeyDown={handleInputKeyDown}
                                    onChange={(event) => {
                                        setInputValue(event.target.value);
                                    }}
                                />
                            </label>

                            <div className="button-row top-gap">
                                <button
                                    type="submit"
                                    className="primary-button"
                                    disabled={(phase !== 'active') || (canSubmitCurrentAnswer === false)}
                                >
                                    攻撃する
                                </button>
                            </div>
                        </form>
                    </section>

                    <section className="card">
                        <h2>数字タイル入力</h2>

                        <div className="keypad-grid">
                            <button type="button" className="keypad-button" disabled={phase !== 'active'} onClick={() => { appendInputValue('7'); }}>7</button>
                            <button type="button" className="keypad-button" disabled={phase !== 'active'} onClick={() => { appendInputValue('8'); }}>8</button>
                            <button type="button" className="keypad-button" disabled={phase !== 'active'} onClick={() => { appendInputValue('9'); }}>9</button>
                            <button type="button" className="keypad-button keypad-button-sub" disabled={phase !== 'active'} onClick={() => { backspaceInputValue(); }}>←</button>

                            <button type="button" className="keypad-button" disabled={phase !== 'active'} onClick={() => { appendInputValue('4'); }}>4</button>
                            <button type="button" className="keypad-button" disabled={phase !== 'active'} onClick={() => { appendInputValue('5'); }}>5</button>
                            <button type="button" className="keypad-button" disabled={phase !== 'active'} onClick={() => { appendInputValue('6'); }}>6</button>
                            <button type="button" className="keypad-button keypad-button-sub" disabled={phase !== 'active'} onClick={() => { clearInputValue(); }}>C</button>

                            <button type="button" className="keypad-button" disabled={phase !== 'active'} onClick={() => { appendInputValue('1'); }}>1</button>
                            <button type="button" className="keypad-button" disabled={phase !== 'active'} onClick={() => { appendInputValue('2'); }}>2</button>
                            <button type="button" className="keypad-button" disabled={phase !== 'active'} onClick={() => { appendInputValue('3'); }}>3</button>
                            <button type="button" className="keypad-button keypad-button-sub" disabled={(phase !== 'active') || (minusKeyEnabled === false)} onClick={() => { appendInputValue('-'); }}>-</button>

                            <button type="button" className="keypad-button keypad-button-wide" disabled={phase !== 'active'} onClick={() => { appendInputValue('0'); }}>0</button>
                            <button type="button" className="keypad-button keypad-button-sub" disabled={(phase !== 'active') || (decimalKeyEnabled === false)} onClick={() => { appendInputValue('.'); }}>.</button>
                            <button type="button" className="keypad-button keypad-button-sub" disabled={(phase !== 'active') || (spaceKeyEnabled === false)} onClick={() => { appendInputValue(' '); }}>空白</button>
                            <button type="button" className="keypad-button keypad-button-primary" disabled={(phase !== 'active') || (canSubmitCurrentAnswer === false)} onClick={() => { handleTileSubmit(); }}>攻撃</button>
                        </div>
                    </section>
                </>
            )}

            {phase === 'select' && (
                <section className="card">
                    <h2>v1 で先に入れた内容</h2>
                    <ul className="simple-list">
                        <li>ダンジョン選択式の 60秒 チャレンジ</li>
                        <li>4人パーティの総攻撃力制</li>
                        <li>ザコA → ザコB → ザコC → ボス → 条件付きシークレット</li>
                        <li>素材獲得 → 自動錬成 → 宝解放の基本ループ</li>
                        <li>theme 定義ファイルで名称・素材・武器名・敵名を外出し</li>
                    </ul>
                </section>
            )}

            {feedbackKind != null && (
                <div className={`feedback-overlay ${feedbackClassName}`}>
                    <div className="feedback-overlay-panel">
                        <div className="feedback-symbol">{feedbackSymbol}</div>
                        <div className="feedback-title">{feedbackText}</div>

                        {(feedbackEquationLeft.length > 0) && (
                            <div className="feedback-equation">
                                <span className="feedback-equation-left">{feedbackEquationLeft}</span>
                                <span className="feedback-equation-answer">{feedbackEquationAnswer}</span>
                            </div>
                        )}

                        {feedbackSubText.length > 0 && (
                            <div className="feedback-detail">{feedbackSubText}</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function renderEnemyChip (
    label: string,
    defeated: boolean,
    hidden: boolean = false
) {
    return (
        <div className={`enemy-chip ${defeated === true ? 'is-defeated' : ''} ${hidden === true ? 'is-hidden' : ''}`}>
            {hidden === true ? '???' : label}
        </div>
    );
}

function resolveInitialInteractiveInputMode (
    inputMethod: InputMethodType
): ActiveInputModeType {
    if (inputMethod === 'keyboard') {
        return 'keyboard';
    }

    if (inputMethod === 'tile') {
        return 'tile';
    }

    return (
        isProbablyMobileInputEnvironment() === true
            ? 'tile'
            : 'keyboard'
    );
}

function isProbablyMobileInputEnvironment (): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches === true;
    const hasTouch = ('ontouchstart' in window);

    return (coarsePointer || hasTouch);
}

function getEffectiveSessionElapsedMs (
    sessionStartedAt: number | null,
    totalPausedMs: number,
    feedbackStartedAt: number | null,
    now: number
): number {
    if (sessionStartedAt == null) {
        return 0;
    }

    const currentFeedbackPausedMs = (
        feedbackStartedAt == null
            ? 0
            : Math.max(0, (now - feedbackStartedAt))
    );

    return Math.max(0, (now - sessionStartedAt - totalPausedMs - currentFeedbackPausedMs));
}

function formatAdventureSeconds (ms: number): string {
    return Math.max(0, (ms / 1000)).toFixed(1);
}

function buildFeedbackEquation (
    expression: string,
    correctText: string
): { leftText: string; answerText: string } {
    const normalizedLeft = expression.replace(/\s*=\s*\?\s*$/, ' = ');
    return {
        leftText: normalizedLeft,
        answerText: correctText,
    };
}
