import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ADVENTURE_FEEDBACK_DELAY_MS } from '../constants/adventureConstants';
import { useAppContext } from '../context/AppContext';
import type { AdventureFeedbackState, AdventureStageKey } from '../types/adventureTypes';
import type { InputMethodType } from '../types/appTypes';
import { getCurrentAdventureEnemy, getStageLabel, resolveAdventureAnswer, tickAdventureSession } from '../utils/adventureUtils';
import { compareAnswer } from '../utils/quizUtils';

export function AdventureRunPage () {
    const navigate = useNavigate();
    const {
        currentAdventure,
        setCurrentAdventure,
        finishAdventure,
    } = useAppContext();

    const [answerValue, setAnswerValue] = useState<string>('');
    const [quotientValue, setQuotientValue] = useState<string>('');
    const [remainderValue, setRemainderValue] = useState<string>('');
    const [feedback, setFeedback] = useState<AdventureFeedbackState | null>(null);
    const [feedbackToken, setFeedbackToken] = useState<number>(0);
    const [pendingResult, setPendingResult] = useState<ReturnType<typeof resolveAdventureAnswer>['result']>(null);
    const [activeInputMode, setActiveInputMode] = useState<'keyboard' | 'tile'>(() => {
        return 'keyboard';
    });
    const [tileTarget, setTileTarget] = useState<'quotient' | 'remainder'>('quotient');
    const tickTimestampRef = useRef<number | null>(null);
    const answerInputRef = useRef<HTMLInputElement | null>(null);

    const currentQuestion = currentAdventure?.currentQuestion ?? null;
    const currentEnemy = useMemo(() => {
        if (currentAdventure == null) {
            return null;
        }

        return getCurrentAdventureEnemy(currentAdventure.enemyStates);
    }, [currentAdventure]);

    useEffect(() => {
        if (currentAdventure == null) {
            navigate('/adventure');
            return;
        }

        setActiveInputMode(resolveInitialInteractiveInputMode(currentAdventure.settingsSnapshot.inputMethod));
    }, [currentAdventure?.id, navigate]);

    useEffect(() => {
        if ((currentAdventure == null) || (feedback != null)) {
            tickTimestampRef.current = null;
            return;
        }

        if ((currentAdventure.cleared === true) || (currentAdventure.failed === true)) {
            tickTimestampRef.current = null;
            return;
        }

        const timerId = window.setInterval(() => {
            const now = Date.now();
            const lastTick = tickTimestampRef.current ?? now;
            const deltaMs = now - lastTick;
            tickTimestampRef.current = now;

            setCurrentAdventure((prevAdventure) => {
                if (prevAdventure == null) {
                    return prevAdventure;
                }

                const nextAdventure = tickAdventureSession(prevAdventure, deltaMs);

                if (nextAdventure.remainingMs <= 0) {
                    const resolved = resolveAdventureAnswer(nextAdventure, {
                        isCorrect: false,
                        isTimeout: true,
                        userAnswer: '',
                    });

                    setFeedback(resolved.feedback);
                    setPendingResult(resolved.result);
                    setFeedbackToken((prevToken) => {
                        return (prevToken + 1);
                    });
                    return resolved.nextSession;
                }

                return nextAdventure;
            });
        }, 100);

        return () => {
            window.clearInterval(timerId);
        };
    }, [currentAdventure, feedback, setCurrentAdventure]);

    useEffect(() => {
        if (feedback == null) {
            return;
        }

        const delayMs = ADVENTURE_FEEDBACK_DELAY_MS[feedback.kind];
        const currentToken = feedbackToken;
        const timerId = window.setTimeout(() => {
            if (currentToken !== feedbackToken) {
                return;
            }

            if (pendingResult != null) {
                finishAdventure(pendingResult);
                setPendingResult(null);
                setFeedback(null);
                navigate('/adventure/result');
                return;
            }

            setFeedback(null);
            tickTimestampRef.current = Date.now();
        }, delayMs);

        return () => {
            window.clearTimeout(timerId);
        };
    }, [feedback, feedbackToken, finishAdventure, navigate, pendingResult]);

    useEffect(() => {
        if (activeInputMode !== 'keyboard') {
            answerInputRef.current?.blur();
            return;
        }

        if ((feedback == null) && (currentQuestion?.answerKind === 'number')) {
            answerInputRef.current?.focus();
        }
    }, [currentQuestion, feedback, activeInputMode]);

    if (currentAdventure == null) {
        return null;
    }

    function handleSubmitAnswer (): void {
        if (feedback != null) {
            return;
        }

        const composedInput = buildUserInput(currentQuestion.answerKind, answerValue, quotientValue, remainderValue);
        const trimmedInput = composedInput.trim();

        if (trimmedInput.length <= 0) {
            return;
        }

        const compared = compareAnswer(currentQuestion, composedInput);
        const resolved = resolveAdventureAnswer(currentAdventure, {
            isCorrect: compared.isCorrect,
            isTimeout: false,
            userAnswer: compared.normalizedInput,
        });

        setCurrentAdventure(resolved.nextSession);
        setFeedback(resolved.feedback);
        setPendingResult(resolved.result);
        setFeedbackToken((prevToken) => {
            return (prevToken + 1);
        });
        clearInputs();
    }

    function handleRetreat (): void {
        const confirmed = window.confirm('現在の冒険を破棄してダンジョン選択へ戻ります。よろしいですか？');

        if (confirmed === false) {
            return;
        }

        setCurrentAdventure(null);
        navigate('/adventure');
    }

    function clearInputs (): void {
        setAnswerValue('');
        setQuotientValue('');
        setRemainderValue('');
        setTileTarget('quotient');
    }

    function appendTileValue (value: string): void {
        if (feedback != null) {
            return;
        }

        if (currentQuestion?.answerKind === 'quotientRemainder') {
            if (tileTarget === 'remainder') {
                setRemainderValue((prev) => {
                    return `${prev}${value}`;
                });
                return;
            }

            setQuotientValue((prev) => {
                return `${prev}${value}`;
            });
            return;
        }

        setAnswerValue((prev) => {
            return `${prev}${value}`;
        });
    }

    function backspaceTileValue (): void {
        if (currentQuestion?.answerKind === 'quotientRemainder') {
            if (tileTarget === 'remainder') {
                setRemainderValue((prev) => {
                    return prev.slice(0, -1);
                });
                return;
            }

            setQuotientValue((prev) => {
                return prev.slice(0, -1);
            });
            return;
        }

        setAnswerValue((prev) => {
            return prev.slice(0, -1);
        });
    }

    function appendMinus (): void {
        if (currentQuestion?.answerKind === 'quotientRemainder') {
            if (tileTarget === 'remainder') {
                if (remainderValue.length <= 0) {
                    setRemainderValue('-');
                }
                return;
            }

            if (quotientValue.length <= 0) {
                setQuotientValue('-');
            }
            return;
        }

        if (answerValue.length <= 0) {
            setAnswerValue('-');
        }
    }

    function appendDecimal (): void {
        if (currentQuestion.answerKind !== 'number') {
            return;
        }

        if (answerValue.includes('.') === false) {
            setAnswerValue((prev) => {
                return `${prev}.`;
            });
        }
    }

    const stageEntries = Object.values(currentAdventure.enemyStates).filter((enemyState) => {
        return (enemyState.stageKey !== 'secret') || (enemyState.unlocked === true) || (currentAdventure.defeatedStages.includes('boss') === true);
    });

    return (
        <div className="page-container">
            <section className="card hero-start-card">
                <div className="hero-title-row">
                    <div>
                        <h1>{currentAdventure.dungeonName}</h1>
                        <p className="sub-text hero-subtext">
                            正解で固定ダメージ、不正解と時間切れは 0 ダメージです。フィードバック中はタイマーを停止します。
                        </p>
                    </div>

                    <span className="timer-badge adventure-timer-badge">
                        残り {Math.max(0, (currentAdventure.remainingMs / 1000)).toFixed(1)} 秒
                    </span>
                </div>

                <div className="summary-chip-row top-gap">
                    <span className="mode-badge">現在敵 {currentEnemy?.enemyName ?? '制覇判定中'}</span>
                    <span className="mode-badge">HP {currentEnemy != null ? `${currentEnemy.remainingHp} / ${currentEnemy.maxHp}` : '-- / --'}</span>
                    <span className="mode-badge">固定攻撃力 {currentAdventure.preview.attackPower}</span>
                    <span className="mode-badge">回答数 {currentAdventure.questionIndex}</span>
                </div>

                <div className="button-row top-gap">
                    <button
                        type="button"
                        onClick={() => {
                            navigate('/adventure');
                        }}
                    >
                        ハブへ戻る
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            handleRetreat();
                        }}
                    >
                        この冒険を破棄
                    </button>
                </div>
            </section>

            <section className="card">
                <h2>進行状況</h2>

                <div className="adventure-stage-track top-gap">
                    {stageEntries.map((enemyState) => {
                        const stageStateClassName = buildStageStateClassName(
                            enemyState.stageKey,
                            currentEnemy?.stageKey ?? null,
                            enemyState.defeated
                        );

                        return (
                            <article key={enemyState.stageKey} className={`adventure-stage-chip ${stageStateClassName}`}>
                                <div className="adventure-stage-chip-label">{getStageLabel(enemyState.stageKey as AdventureStageKey)}</div>
                                <div className="adventure-stage-chip-name">{enemyState.enemyName}</div>
                                <div className="sub-text">HP {enemyState.remainingHp} / {enemyState.maxHp}</div>
                            </article>
                        );
                    })}
                </div>
            </section>

            <section className="card">
                <h2>問題</h2>

                {currentQuestion != null && (
                    <>
                        <div className="question-box">{currentQuestion.expression}</div>

                        {currentQuestion.answerKind === 'number' && (
                    <label>
                        回答入力
                        <input
                            ref={answerInputRef}
                            className="input-control"
                            type="text"
                            value={answerValue}
                            disabled={feedback != null}
                            placeholder="ここに答えを入力"
                            inputMode="decimal"
                            onFocus={() => {
                                setActiveInputMode('keyboard');
                            }}
                            onChange={(event) => {
                                setAnswerValue(event.target.value);
                            }}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    handleSubmitAnswer();
                                }
                            }}
                        />
                    </label>
                )}

                        {currentQuestion.answerKind === 'quotientRemainder' && (
                    <div className="form-grid">
                        <label>
                            商
                            <input
                                className="input-control"
                                type="text"
                                value={quotientValue}
                                disabled={feedback != null}
                                placeholder="商"
                                inputMode="numeric"
                                onFocus={() => {
                                    setActiveInputMode('keyboard');
                                }}
                                onChange={(event) => {
                                    setQuotientValue(event.target.value);
                                }}
                            />
                        </label>

                        <label>
                            余り
                            <input
                                className="input-control"
                                type="text"
                                value={remainderValue}
                                disabled={feedback != null}
                                placeholder="余り"
                                inputMode="numeric"
                                onFocus={() => {
                                    setActiveInputMode('keyboard');
                                }}
                                onChange={(event) => {
                                    setRemainderValue(event.target.value);
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        handleSubmitAnswer();
                                    }
                                }}
                            />
                        </label>
                    </div>
                )}

                        <div className="button-row top-gap">
                            <button
                                type="button"
                                className="primary-button"
                                onClick={() => {
                                    handleSubmitAnswer();
                                }}
                                disabled={feedback != null}
                            >
                                攻撃する
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setActiveInputMode(activeInputMode === 'keyboard' ? 'tile' : 'keyboard');
                                }}
                            >
                                {activeInputMode === 'keyboard' ? '数字タイルを表示' : 'キーボード入力に戻す'}
                            </button>
                        </div>
                    </>
                )}

                {currentQuestion == null && (
                    <div className="sub-text">冒険結果を集計中です...</div>
                )}
            </section>

            {(activeInputMode === 'tile') && (currentQuestion != null) && (
                <section className="card">
                    <h2>数字タイル入力</h2>

                    {currentQuestion.answerKind === 'quotientRemainder' && (
                        <div className="button-row bottom-gap">
                            <button type="button" className={`segmented-button ${tileTarget === 'quotient' ? 'is-selected' : ''}`} onClick={() => { setTileTarget('quotient'); }}>商へ入力</button>
                            <button type="button" className={`segmented-button ${tileTarget === 'remainder' ? 'is-selected' : ''}`} onClick={() => { setTileTarget('remainder'); }}>余りへ入力</button>
                        </div>
                    )}

                    <div className="keypad-grid">
                        <button type="button" className="keypad-button" disabled={feedback != null} onClick={() => { appendTileValue('7'); }}>7</button>
                        <button type="button" className="keypad-button" disabled={feedback != null} onClick={() => { appendTileValue('8'); }}>8</button>
                        <button type="button" className="keypad-button" disabled={feedback != null} onClick={() => { appendTileValue('9'); }}>9</button>
                        <button type="button" className="keypad-button keypad-button-sub" disabled={feedback != null} onClick={() => { backspaceTileValue(); }}>←</button>

                        <button type="button" className="keypad-button" disabled={feedback != null} onClick={() => { appendTileValue('4'); }}>4</button>
                        <button type="button" className="keypad-button" disabled={feedback != null} onClick={() => { appendTileValue('5'); }}>5</button>
                        <button type="button" className="keypad-button" disabled={feedback != null} onClick={() => { appendTileValue('6'); }}>6</button>
                        <button type="button" className="keypad-button keypad-button-sub" disabled={feedback != null} onClick={() => { clearInputs(); }}>C</button>

                        <button type="button" className="keypad-button" disabled={feedback != null} onClick={() => { appendTileValue('1'); }}>1</button>
                        <button type="button" className="keypad-button" disabled={feedback != null} onClick={() => { appendTileValue('2'); }}>2</button>
                        <button type="button" className="keypad-button" disabled={feedback != null} onClick={() => { appendTileValue('3'); }}>3</button>
                        <button type="button" className="keypad-button keypad-button-sub" disabled={feedback != null} onClick={() => { appendMinus(); }}>-</button>

                        <button type="button" className="keypad-button keypad-button-wide" disabled={feedback != null} onClick={() => { appendTileValue('0'); }}>0</button>
                        <button type="button" className="keypad-button keypad-button-sub" disabled={(feedback != null) || (currentQuestion.answerKind !== 'number')} onClick={() => { appendDecimal(); }}>.</button>
                        <button type="button" className="keypad-button keypad-button-primary" disabled={feedback != null} onClick={() => { handleSubmitAnswer(); }}>攻撃</button>
                    </div>
                </section>
            )}

            {feedback != null && (
                <div className={`feedback-overlay ${buildFeedbackClassName(feedback.kind)}`}>
                    <div className="feedback-overlay-panel">
                        <div className="feedback-symbol">{feedback.kind === 'correct' ? '○' : (feedback.kind === 'timeout' ? '⌛' : '×')}</div>
                        <div className="feedback-title">{feedback.title}</div>
                        <div className="feedback-equation">
                            <span className="feedback-equation-left">{feedback.expression.replace(/\s*=\s*\?\s*$/, ' = ')}</span>
                            <span className="feedback-equation-answer">{feedback.correctAnswerText}</span>
                        </div>
                        <div className="feedback-detail">{feedback.subText}</div>
                    </div>
                </div>
            )}
        </div>
    );
}

function buildUserInput (
    answerKind: 'number' | 'quotientRemainder',
    answerValue: string,
    quotientValue: string,
    remainderValue: string
): string {
    if (answerKind === 'quotientRemainder') {
        return `${quotientValue} ${remainderValue}`.trim();
    }

    return answerValue;
}

function resolveInitialInteractiveInputMode (
    inputMethod: InputMethodType
): 'keyboard' | 'tile' {
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

function buildStageStateClassName (
    stageKey: AdventureStageKey,
    currentStageKey: AdventureStageKey | null,
    defeated: boolean
): string {
    if (defeated === true) {
        return 'is-cleared';
    }

    if (stageKey === currentStageKey) {
        return 'is-current';
    }

    return 'is-waiting';
}

function buildFeedbackClassName (kind: 'correct' | 'wrong' | 'timeout'): string {
    if (kind === 'correct') {
        return 'feedback-correct';
    }

    if (kind === 'timeout') {
        return 'feedback-timeout';
    }

    return 'feedback-wrong';
}
