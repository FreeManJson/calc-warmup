import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ADVENTURE_FEEDBACK_DELAY_MS } from '../constants/adventureConstants';
import { useAppContext } from '../context/AppContext';
import type { AdventureFeedbackState, AdventureStageKey } from '../types/adventureTypes';
import type { InputMethodType } from '../types/appTypes';
import {
    getCurrentAdventureEnemy,
    getStageLabel,
    resolveAdventureAnswer,
    tickAdventureSession,
} from '../utils/adventureUtils';
import { compareAnswer } from '../utils/quizUtils';

type TileTargetType = 'answer' | 'quotient' | 'remainder';

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
    const [tileTarget, setTileTarget] = useState<TileTargetType>('answer');
    const [validationMessage, setValidationMessage] = useState<string>('');
    const tickTimestampRef = useRef<number | null>(null);
    const answerInputRef = useRef<HTMLInputElement | null>(null);
    const quotientInputRef = useRef<HTMLInputElement | null>(null);
    const remainderInputRef = useRef<HTMLInputElement | null>(null);
    const questionCardRef = useRef<HTMLElement | null>(null);

    const currentQuestion = currentAdventure?.currentQuestion ?? null;
    const currentEnemy = useMemo(() => {
        if (currentAdventure == null) {
            return null;
        }

        return getCurrentAdventureEnemy(currentAdventure.enemyStates);
    }, [currentAdventure]);

    const isQuotientRemainder = (currentQuestion?.answerKind === 'quotientRemainder');
    const decimalKeyEnabled = (currentQuestion?.answerKind === 'number');

    useEffect(() => {
        if (currentAdventure == null) {
            navigate('/adventure');
            return;
        }

        setActiveInputMode(resolveInitialInteractiveInputMode(currentAdventure.settingsSnapshot.inputMethod));
    }, [currentAdventure?.id, navigate]);

    useEffect(() => {
        if (currentQuestion == null) {
            return;
        }

        if (currentQuestion.answerKind === 'quotientRemainder') {
            setTileTarget('quotient');
            return;
        }

        setTileTarget('answer');
    }, [currentQuestion?.id, currentQuestion?.answerKind]);

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
        if ((feedback != null) || (currentQuestion == null)) {
            return;
        }

        const timerId = window.setTimeout(() => {
            questionCardRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            });
        }, 0);

        return () => {
            window.clearTimeout(timerId);
        };
    }, [currentQuestion?.id, feedback]);

    useEffect(() => {
        if ((feedback != null) || (activeInputMode !== 'keyboard')) {
            blurAllInputs();
            return;
        }

        const timerId = window.setTimeout(() => {
            if (isQuotientRemainder === true) {
                if (tileTarget === 'remainder') {
                    remainderInputRef.current?.focus();
                    remainderInputRef.current?.select();
                    return;
                }

                quotientInputRef.current?.focus();
                quotientInputRef.current?.select();
                return;
            }

            answerInputRef.current?.focus();
            answerInputRef.current?.select();
        }, 0);

        return () => {
            window.clearTimeout(timerId);
        };
    }, [feedback, activeInputMode, isQuotientRemainder, tileTarget, currentQuestion?.id]);

    if (currentAdventure == null) {
        return null;
    }

    function clearInputs (): void {
        setAnswerValue('');
        setQuotientValue('');
        setRemainderValue('');
    }

    function blurAllInputs (): void {
        answerInputRef.current?.blur();
        quotientInputRef.current?.blur();
        remainderInputRef.current?.blur();
    }

    function handleSubmitAnswer (): void {
        if ((feedback != null) || (currentQuestion == null)) {
            return;
        }

        const validation = validateAdventureInput(
            currentQuestion.answerKind,
            answerValue,
            quotientValue,
            remainderValue
        );

        if (validation.ok === false) {
            setValidationMessage(validation.message);
            return;
        }

        const composedInput = buildUserInput(currentQuestion.answerKind, answerValue, quotientValue, remainderValue);
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
        setValidationMessage('');
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

    function switchToKeyboardMode (target?: TileTargetType): void {
        if (feedback != null) {
            return;
        }

        if (target != null) {
            setTileTarget(target);
        }

        setActiveInputMode('keyboard');
    }

    function switchToTileMode (target?: TileTargetType): void {
        if (feedback != null) {
            return;
        }

        if (target != null) {
            setTileTarget(target);
        }

        setActiveInputMode('tile');
        blurAllInputs();
    }

    function appendTileValue (value: string): void {
        if (feedback != null) {
            return;
        }

        switchToTileMode();
        setValidationMessage('');

        if (isQuotientRemainder === true) {
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
        if (feedback != null) {
            return;
        }

        switchToTileMode();
        setValidationMessage('');

        if (isQuotientRemainder === true) {
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
        if (feedback != null) {
            return;
        }

        switchToTileMode();
        setValidationMessage('');

        if (isQuotientRemainder === true) {
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
        if ((feedback != null) || (isQuotientRemainder === true)) {
            return;
        }

        switchToTileMode();
        setValidationMessage('');

        if (answerValue.includes('.') === false) {
            setAnswerValue((prev) => {
                return `${prev}.`;
            });
        }
    }

    function handleClearInputs (): void {
        if (feedback != null) {
            return;
        }

        clearInputs();
        setValidationMessage('');
        switchToTileMode();
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
                        冒険を中断
                    </button>
                </div>
            </section>

            <section className="card">
                <h2>進行状況</h2>

                <div className="adventure-stage-track top-gap">
                    {stageEntries.map((enemyState) => {
                        return (
                            <div
                                key={enemyState.stageKey}
                                className={`adventure-stage-chip ${buildStageStateClassName(
                                    enemyState.stageKey,
                                    currentEnemy?.stageKey ?? null,
                                    enemyState.defeated
                                )}`}
                            >
                                <div className="adventure-stage-chip-label">{getStageLabel(enemyState.stageKey)}</div>
                                <div className="adventure-stage-chip-name">{enemyState.enemyName}</div>
                                <div className="sub-text">
                                    {enemyState.defeated === true
                                        ? '撃破済み'
                                        : `${enemyState.remainingHp} / ${enemyState.maxHp} HP`}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>

            <section className="card" ref={questionCardRef}>
                <div className="inline-input-mode-row">
                    <strong>入力方式</strong>
                    <div className="segmented-row">
                        <button
                            type="button"
                            className={`segmented-button ${activeInputMode === 'keyboard' ? 'is-selected' : ''}`}
                            onClick={() => {
                                switchToKeyboardMode();
                            }}
                        >
                            キーボード
                        </button>
                        <button
                            type="button"
                            className={`segmented-button ${activeInputMode === 'tile' ? 'is-selected' : ''}`}
                            onClick={() => {
                                switchToTileMode();
                            }}
                        >
                            数字タイル
                        </button>
                    </div>
                </div>

                {currentQuestion != null && (
                    <>
                        <h2 className="top-gap">問題</h2>
                        <div className="question-box">{currentQuestion.expression}</div>

                        {currentQuestion.inputHint != null && (
                            <p className="sub-text">{currentQuestion.inputHint}</p>
                        )}

                        <div className="answer-layout top-gap">
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
                                            setTileTarget('answer');
                                            setActiveInputMode('keyboard');
                                        }}
                                        onChange={(event) => {
                                            setAnswerValue(event.target.value);
                                            setValidationMessage('');
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
                                <div className="dual-answer-grid">
                                    <label>
                                        商
                                        <input
                                            ref={quotientInputRef}
                                            className="input-control"
                                            type="text"
                                            value={quotientValue}
                                            disabled={feedback != null}
                                            placeholder="商"
                                            inputMode="numeric"
                                            onFocus={() => {
                                                setTileTarget('quotient');
                                                setActiveInputMode('keyboard');
                                            }}
                                            onChange={(event) => {
                                                setQuotientValue(event.target.value);
                                                setValidationMessage('');
                                            }}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter') {
                                                    event.preventDefault();
                                                    setTileTarget('remainder');
                                                    remainderInputRef.current?.focus();
                                                    remainderInputRef.current?.select();
                                                }
                                            }}
                                        />
                                    </label>

                                    <label>
                                        余り
                                        <input
                                            ref={remainderInputRef}
                                            className="input-control"
                                            type="text"
                                            value={remainderValue}
                                            disabled={feedback != null}
                                            placeholder="余り"
                                            inputMode="numeric"
                                            onFocus={() => {
                                                setTileTarget('remainder');
                                                setActiveInputMode('keyboard');
                                            }}
                                            onChange={(event) => {
                                                setRemainderValue(event.target.value);
                                                setValidationMessage('');
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

                            {(validationMessage.length > 0) && (
                                <div className="input-error-text">{validationMessage}</div>
                            )}

                            {(activeInputMode === 'keyboard') && (
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
                                </div>
                            )}
                        </div>

                        {(activeInputMode === 'tile') && (
                            <div className="top-gap">
                                {isQuotientRemainder === true && (
                                    <div className="tile-target-row bottom-gap">
                                        <span className="sub-text">入力先</span>
                                        <div className="segmented-row">
                                            <button type="button" className={`segmented-button ${tileTarget === 'quotient' ? 'is-selected' : ''}`} onClick={() => { switchToTileMode('quotient'); }}>商</button>
                                            <button type="button" className={`segmented-button ${tileTarget === 'remainder' ? 'is-selected' : ''}`} onClick={() => { switchToTileMode('remainder'); }}>余り</button>
                                        </div>
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
                                    <button type="button" className="keypad-button keypad-button-sub" disabled={feedback != null} onClick={() => { handleClearInputs(); }}>C</button>

                                    <button type="button" className="keypad-button" disabled={feedback != null} onClick={() => { appendTileValue('1'); }}>1</button>
                                    <button type="button" className="keypad-button" disabled={feedback != null} onClick={() => { appendTileValue('2'); }}>2</button>
                                    <button type="button" className="keypad-button" disabled={feedback != null} onClick={() => { appendTileValue('3'); }}>3</button>
                                    <button type="button" className="keypad-button keypad-button-sub" disabled={feedback != null} onClick={() => { appendMinus(); }}>-</button>

                                    <button type="button" className="keypad-button keypad-button-wide" disabled={feedback != null} onClick={() => { appendTileValue('0'); }}>0</button>
                                    <button type="button" className="keypad-button keypad-button-sub" disabled={(feedback != null) || (decimalKeyEnabled === false) || (isQuotientRemainder === true)} onClick={() => { appendDecimal(); }}>.</button>
                                    <button type="button" className="keypad-button keypad-button-primary" disabled={feedback != null} onClick={() => { handleSubmitAnswer(); }}>攻撃</button>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {currentQuestion == null && (
                    <div className="sub-text">冒険結果を集計中です...</div>
                )}
            </section>

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

function validateAdventureInput (
    answerKind: 'number' | 'quotientRemainder',
    answerValue: string,
    quotientValue: string,
    remainderValue: string
): { ok: boolean; message: string } {
    if (answerKind === 'quotientRemainder') {
        if ((quotientValue.trim().length <= 0) && (remainderValue.trim().length <= 0)) {
            return {
                ok: false,
                message: '商と余りを入力してください。',
            };
        }

        if (quotientValue.trim().length <= 0) {
            return {
                ok: false,
                message: '商を入力してください。',
            };
        }

        if (remainderValue.trim().length <= 0) {
            return {
                ok: false,
                message: '余りを入力してください。',
            };
        }

        return {
            ok: true,
            message: '',
        };
    }

    if (answerValue.trim().length <= 0) {
        return {
            ok: false,
            message: '答えを入力してください。',
        };
    }

    return {
        ok: true,
        message: '',
    };
}

function buildUserInput (
    answerKind: 'number' | 'quotientRemainder',
    answerValue: string,
    quotientValue: string,
    remainderValue: string
): string {
    if (answerKind === 'quotientRemainder') {
        return `${quotientValue.trim()} ${remainderValue.trim()}`.trim();
    }

    return answerValue.trim();
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
