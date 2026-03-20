import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import type {
    AdventureBattleLogEntry,
    AdventureEnemyState,
    AnswerKind,
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
    buildAdventureChallengeBadge,
    buildAdventureEnemySequence,
    buildAdventureQuestionPool,
    buildAdventureResult,
    calculateEffectiveAdventureAttack,
    calculateRecommendedBattlePower,
    calculateTotalAttack,
    computeProblemLevel,
    getAdventureDungeonById,
    getAdventureLevelBalance,
    getPartyMemberLabel,
} from '../utils/adventureUtils';

type AdventurePhase = 'select' | 'countdown' | 'active' | 'feedback';
type ActiveInputModeType = 'keyboard' | 'tile';
type FeedbackKindType = 'correct' | 'wrong' | 'timeout' | null;
type AnswerFieldType = 'main' | 'remainder';

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
    const [mainInputValue, setMainInputValue] = useState<string>('');
    const [remainderInputValue, setRemainderInputValue] = useState<string>('');
    const [activeAnswerField, setActiveAnswerField] = useState<AnswerFieldType>('main');
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

    const mainInputRef = useRef<HTMLInputElement | null>(null);
    const remainderInputRef = useRef<HTMLInputElement | null>(null);
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

    const problemLevel = useMemo(() => {
        return computeProblemLevel(quizSettings);
    }, [quizSettings]);

    const challengeBadge = useMemo(() => {
        return buildAdventureChallengeBadge(quizSettings);
    }, [quizSettings]);

    const levelBalance = useMemo(() => {
        return getAdventureLevelBalance(problemLevel);
    }, [problemLevel]);

    const effectiveBattlePower = useMemo(() => {
        return calculateEffectiveAdventureAttack(totalAttack, problemLevel);
    }, [totalAttack, problemLevel]);

    const recommendedBattlePower = useMemo(() => {
        return calculateRecommendedBattlePower(selectedDungeonId, problemLevel);
    }, [selectedDungeonId, problemLevel]);

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
    const usesRemainderInputs = (currentQuestion?.answerKind === 'quotientRemainder');
    const decimalKeyEnabled = (
        (usesRemainderInputs === false) &&
        (
            (quizSettings.allowDecimal === true) ||
            (quizSettings.allowRealDivision === true)
        )
    );
    const minusKeyEnabled = (
        (quizSettings.allowNegative === true) ||
        ((currentQuestion?.expectedNumber ?? 0) < 0)
    );
    const questionCountText = `${battleLog.length + 1}問目`;
    const canSubmitCurrentAnswer = hasSubmittableMainInput(mainInputValue);

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
            setActiveAnswerField('main');
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
            mainInputRef.current?.blur();
            remainderInputRef.current?.blur();
            return;
        }

        const timerId = window.setTimeout(() => {
            focusAnswerField(activeAnswerField, mainInputRef, remainderInputRef, usesRemainderInputs);
        }, 0);

        return () => {
            window.clearTimeout(timerId);
        };
    }, [phase, questionIndex, activeInputMode, activeAnswerField, usesRemainderInputs]);

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
            problemLevel,
            challengeBadgeLabel: challengeBadge.label,
            partyAttackRate: levelBalance.partyAttackRate,
            enemyHpRate: levelBalance.enemyHpRate,
            totalAttack,
            effectiveBattlePower,
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
        adventureProgress,
        adventureTheme,
        battleLog,
        challengeBadge.label,
        defeatedEnemySlots,
        effectiveBattlePower,
        levelBalance.enemyHpRate,
        levelBalance.partyAttackRate,
        navigate,
        problemLevel,
        secretAppeared,
        selectedDungeonId,
        selectedUserId,
        sessionStartedAt,
        setAdventureProgress,
        totalAttack,
        totalPausedMs,
        setLatestAdventureResult,
        users,
    ]);

    function resetAnswerInputs (): void {
        setMainInputValue('');
        setRemainderInputValue('');
        setActiveAnswerField('main');
    }

    function startAdventure (overrideDungeonId?: string): void {
        if (nextTimeoutRef.current != null) {
            window.clearTimeout(nextTimeoutRef.current);
            nextTimeoutRef.current = null;
        }

        const targetDungeonId = overrideDungeonId ?? selectedDungeonId;

        setSelectedDungeonId(targetDungeonId);
        setQuestionPool(buildAdventureQuestionPool(quizSettings));
        setQuestionIndex(0);
        resetAnswerInputs();
        setBattleLog([]);
        setEnemies(buildAdventureEnemySequence(adventureTheme, targetDungeonId, problemLevel));
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
        resetAnswerInputs();
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

    function handleSubmit (event: FormEvent<HTMLFormElement>): void {
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
            (phase !== 'active')
        ) {
            return;
        }

        const now = Date.now();
        const effectiveElapsedMs = (
            questionStartedAt == null
                ? 0
                : Math.max(0, (now - questionStartedAt))
        );
        const submittedAnswerText = buildSubmittedAnswerText(
            currentQuestion.answerKind,
            mainInputValue,
            remainderInputValue
        );
        const compareResult = (
            mode === 'timeout'
                ? { isCorrect: false, normalizedInput: '(時間切れ)' }
                : compareAnswer(currentQuestion, submittedAnswerText)
        );
        const isCorrect = (
            (mode !== 'timeout') &&
            (compareResult.isCorrect === true)
        );
        const damage = (isCorrect === true ? effectiveBattlePower : 0);
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
                const effectiveSessionElapsedMs = getEffectiveSessionElapsedMs(
                    sessionStartedAt,
                    totalPausedMs,
                    feedbackStartedAtRef.current,
                    now
                );
                const clearedWithinSecretLimit = (
                    effectiveSessionElapsedMs <= (ADVENTURE_CONSTANTS.secretBossTimeLimitSec * 1000)
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
        resetAnswerInputs();
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

    function handleInputKeyDown (
        event: KeyboardEvent<HTMLInputElement>,
        field: AnswerFieldType
    ): void {
        if (isComposingRef.current === true) {
            return;
        }

        if (event.key !== 'Enter') {
            return;
        }

        event.preventDefault();

        if ((phase === 'active') && (canSubmitCurrentAnswer === true)) {
            if ((usesRemainderInputs === true) && (field === 'main')) {
                setActiveAnswerField('remainder');
                window.setTimeout(() => {
                    remainderInputRef.current?.focus();
                    remainderInputRef.current?.select();
                }, 0);
                return;
            }

            settleCurrentQuestion('submit');
        }
    }

    function switchToKeyboardMode (): void {
        if (phase !== 'active') {
            return;
        }

        setActiveInputMode('keyboard');

        window.setTimeout(() => {
            focusAnswerField(activeAnswerField, mainInputRef, remainderInputRef, usesRemainderInputs);
        }, 0);
    }

    function switchToTileMode (): void {
        if (phase !== 'active') {
            return;
        }

        setActiveInputMode('tile');
        mainInputRef.current?.blur();
        remainderInputRef.current?.blur();
    }

    function appendInputValue (text: string): void {
        if (phase !== 'active') {
            return;
        }

        switchToTileMode();

        if ((activeAnswerField === 'remainder') && (usesRemainderInputs === true)) {
            setRemainderInputValue((prev) => {
                return (prev + text);
            });
            return;
        }

        setMainInputValue((prev) => {
            return (prev + text);
        });
    }

    function backspaceInputValue (): void {
        if (phase !== 'active') {
            return;
        }

        switchToTileMode();

        if ((activeAnswerField === 'remainder') && (usesRemainderInputs === true)) {
            setRemainderInputValue((prev) => {
                return prev.slice(0, -1);
            });
            return;
        }

        setMainInputValue((prev) => {
            return prev.slice(0, -1);
        });
    }

    function clearInputValue (): void {
        if (phase !== 'active') {
            return;
        }

        switchToTileMode();

        if ((activeAnswerField === 'remainder') && (usesRemainderInputs === true)) {
            setRemainderInputValue('');
            return;
        }

        setMainInputValue('');
    }

    function handleTileSubmit (): void {
        if ((phase !== 'active') || (canSubmitCurrentAnswer === false)) {
            return;
        }

        settleCurrentQuestion('submit');
    }

    function handleRemainderToggle (): void {
        if ((phase !== 'active') || (usesRemainderInputs === false)) {
            return;
        }

        switchToTileMode();
        setActiveAnswerField((prev) => {
            return (prev === 'main' ? 'remainder' : 'main');
        });
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
                        学習設定を土台にしつつ、{ADVENTURE_CONSTANTS.totalTimeSec}秒 でダンジョンを攻略します。
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
                            const dungeonRecommendedPower = calculateRecommendedBattlePower(dungeon.id, problemLevel);

                            return (
                                <button
                                    key={dungeon.id}
                                    type="button"
                                    className={`dungeon-card-button ${selected === true ? 'is-selected' : ''}`}
                                    onClick={() => {
                                        handleDungeonSelect(dungeon.id);
                                    }}
                                >
                                    <div className="dungeon-card-title">{dungeon.name}</div>
                                    <div className="dungeon-card-sub">今回の推奨戦力 {dungeonRecommendedPower}</div>
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
                            <div className="adventure-overview-label">問題レベル</div>
                            <div className="adventure-overview-value">Lv{problemLevel}</div>
                        </div>

                        <div className="adventure-overview-item">
                            <div className="adventure-overview-label">挑戦バッジ</div>
                            <div className="adventure-overview-value adventure-badge-value">{challengeBadge.label}</div>
                        </div>

                        <div className="adventure-overview-item">
                            <div className="adventure-overview-label">基本戦力</div>
                            <div className="adventure-overview-value">{totalAttack}</div>
                        </div>

                        <div className="adventure-overview-item">
                            <div className="adventure-overview-label">今回の有効戦力</div>
                            <div className="adventure-overview-value">{effectiveBattlePower}</div>
                        </div>
                    </div>

                    <div className="adventure-balance-note top-gap">
                        <div>問題レベルが上がるほど、難しい術式の共鳴で味方の一撃も強化されます。</div>
                        <div>味方倍率 ×{levelBalance.partyAttackRate.toFixed(2)} / 敵HP倍率 ×{levelBalance.enemyHpRate.toFixed(2)}</div>
                        <div>シークレット条件: {ADVENTURE_CONSTANTS.secretBossTimeLimitSec}秒以内にボス撃破</div>
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
                                <div className="sub-text">{questionCountText} ・ 問題レベル Lv{problemLevel} ・ {challengeBadge.label}</div>
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

                        <div className="status-row adventure-status-line">
                            <div><strong>基本戦力:</strong> {totalAttack}</div>
                            <div><strong>今回の有効戦力:</strong> {effectiveBattlePower}</div>
                            <div><strong>推奨戦力:</strong> {recommendedBattlePower}</div>
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
                            {usesRemainderInputs === true ? (
                                <div className="answer-split-grid">
                                    <label className="answer-field-card">
                                        <span className="answer-field-label">商</span>
                                        <input
                                            ref={mainInputRef}
                                            className={`input-control answer-split-input ${activeAnswerField === 'main' ? 'is-active' : ''}`}
                                            type="text"
                                            value={mainInputValue}
                                            disabled={phase !== 'active'}
                                            placeholder="商を入力"
                                            inputMode="numeric"
                                            enterKeyHint="next"
                                            autoComplete="off"
                                            autoCapitalize="off"
                                            spellCheck={false}
                                            lang="en"
                                            pattern="[0-9\-]*"
                                            onFocus={() => {
                                                setActiveInputMode('keyboard');
                                                setActiveAnswerField('main');
                                            }}
                                            onCompositionStart={() => {
                                                isComposingRef.current = true;
                                            }}
                                            onCompositionEnd={() => {
                                                isComposingRef.current = false;
                                            }}
                                            onKeyDown={(event) => {
                                                handleInputKeyDown(event, 'main');
                                            }}
                                            onChange={(event) => {
                                                setMainInputValue(event.target.value);
                                            }}
                                        />
                                    </label>

                                    <label className="answer-field-card">
                                        <span className="answer-field-label">余り</span>
                                        <input
                                            ref={remainderInputRef}
                                            className={`input-control answer-split-input ${activeAnswerField === 'remainder' ? 'is-active' : ''}`}
                                            type="text"
                                            value={remainderInputValue}
                                            disabled={phase !== 'active'}
                                            placeholder="0"
                                            inputMode="numeric"
                                            enterKeyHint="done"
                                            autoComplete="off"
                                            autoCapitalize="off"
                                            spellCheck={false}
                                            lang="en"
                                            pattern="[0-9]*"
                                            onFocus={() => {
                                                setActiveInputMode('keyboard');
                                                setActiveAnswerField('remainder');
                                            }}
                                            onCompositionStart={() => {
                                                isComposingRef.current = true;
                                            }}
                                            onCompositionEnd={() => {
                                                isComposingRef.current = false;
                                            }}
                                            onKeyDown={(event) => {
                                                handleInputKeyDown(event, 'remainder');
                                            }}
                                            onChange={(event) => {
                                                setRemainderInputValue(event.target.value);
                                            }}
                                        />
                                    </label>
                                </div>
                            ) : (
                                <label>
                                    回答入力
                                    <input
                                        ref={mainInputRef}
                                        className="input-control"
                                        type="text"
                                        value={mainInputValue}
                                        disabled={phase !== 'active'}
                                        placeholder="ここに答えを入力"
                                        inputMode={
                                            currentQuestion?.course === 'div' &&
                                            currentQuestion.inputHint?.includes('小数') === true
                                                ? 'decimal'
                                                : 'numeric'
                                        }
                                        enterKeyHint="done"
                                        autoComplete="off"
                                        autoCapitalize="off"
                                        spellCheck={false}
                                        lang="en"
                                        pattern="[0-9\-\.]*"
                                        onFocus={() => {
                                            setActiveInputMode('keyboard');
                                            setActiveAnswerField('main');
                                        }}
                                        onCompositionStart={() => {
                                            isComposingRef.current = true;
                                        }}
                                        onCompositionEnd={() => {
                                            isComposingRef.current = false;
                                        }}
                                        onKeyDown={(event) => {
                                            handleInputKeyDown(event, 'main');
                                        }}
                                        onChange={(event) => {
                                            setMainInputValue(event.target.value);
                                        }}
                                    />
                                </label>
                            )}

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
                            <button type="button" className="keypad-button keypad-button-sub" disabled={(phase !== 'active') || (minusKeyEnabled === false) || (activeAnswerField === 'remainder')} onClick={() => { appendInputValue('-'); }}>-</button>

                            <button type="button" className="keypad-button keypad-button-wide" disabled={phase !== 'active'} onClick={() => { appendInputValue('0'); }}>0</button>
                            <button type="button" className="keypad-button keypad-button-sub" disabled={(phase !== 'active') || (decimalKeyEnabled === false) || (activeAnswerField === 'remainder')} onClick={() => { appendInputValue('.'); }}>.</button>
                            <button type="button" className="keypad-button keypad-button-sub" disabled={(phase !== 'active') || (usesRemainderInputs === false)} onClick={() => { handleRemainderToggle(); }}>{activeAnswerField === 'main' ? 'あまり' : '商へ'}</button>
                            <button type="button" className="keypad-button keypad-button-primary" disabled={(phase !== 'active') || (canSubmitCurrentAnswer === false)} onClick={() => { handleTileSubmit(); }}>攻撃</button>
                        </div>
                    </section>
                </>
            )}

            {phase === 'select' && (
                <section className="card">
                    <h2>今回の土台</h2>
                    <ul className="simple-list">
                        <li>問題レベルは各項目の最大桁数の平均値から算出</li>
                        <li>冒険モードだけ割り算は重み付き抽選 + 上限比率つき</li>
                        <li>演算種別数でバッジ階級、拡張条件数で + を付与</li>
                        <li>高レベルほど敵も強いが、解けた計算の共鳴で味方の一撃も大きくなる</li>
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

function focusAnswerField (
    activeField: AnswerFieldType,
    mainInputRef: RefObject<HTMLInputElement | null>,
    remainderInputRef: RefObject<HTMLInputElement | null>,
    usesRemainderInputs: boolean
): void {
    if ((usesRemainderInputs === true) && (activeField === 'remainder')) {
        remainderInputRef.current?.focus();
        remainderInputRef.current?.select();
        return;
    }

    mainInputRef.current?.focus();
    mainInputRef.current?.select();
}

function hasSubmittableMainInput (
    value: string
): boolean {
    const trimmed = value.trim();

    if (trimmed.length <= 0) {
        return false;
    }

    return !['-', '.', '-.'].includes(trimmed);
}

function buildSubmittedAnswerText (
    answerKind: AnswerKind,
    mainInputValue: string,
    remainderInputValue: string
): string {
    if (answerKind !== 'quotientRemainder') {
        return mainInputValue;
    }

    const safeRemainder = (
        remainderInputValue.trim().length > 0
            ? remainderInputValue.trim()
            : '0'
    );

    return `${mainInputValue.trim()} ${safeRemainder}`;
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
