import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FEEDBACK_DELAY_MS } from '../constants/appConstants';
import { QuestionStackBoard } from '../components/QuestionStackBoard';
import { TileAnswerPanel } from '../components/TileAnswerPanel';
import { useAppContext } from '../context/AppContext';
import type { AdventureFeedbackState } from '../types/adventureTypes';
import { getCurrentAdventureEnemy, resolveAdventureAnswer, tickAdventureSession } from '../utils/adventureUtils';
import { compareAnswer } from '../utils/quizUtils';
import {
    buildTileUserInput,
    validateTileAnswer,
    type TileTargetType,
} from '../utils/answerInputUtils';

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
    const [tileTarget, setTileTarget] = useState<TileTargetType>('answer');
    const [feedback, setFeedback] = useState<AdventureFeedbackState | null>(null);
    const [pendingResult, setPendingResult] = useState<ReturnType<typeof resolveAdventureAnswer>['result']>(null);
    const [validationMessage, setValidationMessage] = useState<string>('');
    const tickTimestampRef = useRef<number | null>(null);

    const currentQuestion = currentAdventure?.currentQuestion ?? null;
    const currentEnemy = useMemo(() => {
        if (currentAdventure == null) {
            return null;
        }

        return getCurrentAdventureEnemy(currentAdventure.enemyStates);
    }, [currentAdventure]);

    const minusKeyEnabled = ((currentAdventure?.settingsSnapshot.allowNegative === true) || ((currentQuestion?.expectedNumber ?? 0) < 0));
    const decimalKeyEnabled = ((currentAdventure?.settingsSnapshot.allowDecimal === true) || (currentAdventure?.settingsSnapshot.allowRealDivision === true));

    const stackExpressions = useMemo(() => {
        if (currentAdventure == null) {
            return [];
        }

        const expressions: string[] = [];

        if (currentAdventure.currentQuestion != null) {
            expressions.push(currentAdventure.currentQuestion.expression);
        }

        (currentAdventure.upcomingQuestions ?? []).slice(0, 2).forEach((question) => {
            expressions.push(question.expression);
        });

        return expressions;
    }, [currentAdventure]);

    useEffect(() => {
        if (currentAdventure == null) {
            navigate('/adventure');
            return;
        }

        setTileTarget(
            currentAdventure.currentQuestion?.answerKind === 'quotientRemainder'
                ? 'quotient'
                : 'answer'
        );
    }, [currentAdventure?.id, navigate]);

    useEffect(() => {
        if (currentQuestion == null) {
            return;
        }

        setValidationMessage('');
        setTileTarget(currentQuestion.answerKind === 'quotientRemainder' ? 'quotient' : 'answer');
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
                    clearInputs();
                    return resolved.nextSession;
                }

                return nextAdventure;
            });
        }, 100);

        return () => {
            window.clearInterval(timerId);
        };
    }, [currentAdventure, feedback, setCurrentAdventure]);

    const handleDismissFeedback = useCallback((): void => {
        if (feedback == null) {
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
    }, [feedback, pendingResult, finishAdventure, navigate]);

    useEffect(() => {
        if (feedback == null) {
            return;
        }

        const delayMs = (feedback.kind === 'timeout')
            ? FEEDBACK_DELAY_MS.timeout
            : FEEDBACK_DELAY_MS.wrong;

        const timerId = window.setTimeout(() => {
            handleDismissFeedback();
        }, delayMs);

        return () => {
            window.clearTimeout(timerId);
        };
    }, [feedback, handleDismissFeedback]);

    if (currentAdventure == null) {
        return null;
    }

    function handleSubmitAnswer (): void {
        if ((feedback != null) || (currentQuestion == null) || (currentAdventure == null)) {
            return;
        }

        const validation = validateTileAnswer(
            currentQuestion.answerKind,
            answerValue,
            quotientValue
        );

        if (validation.ok === false) {
            setValidationMessage(validation.message);
            return;
        }

        const composedInput = buildTileUserInput(
            currentQuestion.answerKind,
            answerValue,
            quotientValue,
            remainderValue
        );
        const compared = compareAnswer(currentQuestion, composedInput);
        const resolved = resolveAdventureAnswer(currentAdventure, {
            isCorrect: compared.isCorrect,
            isTimeout: false,
            userAnswer: compared.normalizedInput,
        });

        setCurrentAdventure(resolved.nextSession);
        clearInputs();

        if (compared.isCorrect === true) {
            if (resolved.result != null) {
                finishAdventure(resolved.result);
                navigate('/adventure/result');
            }

            return;
        }

        setFeedback(resolved.feedback);
        setPendingResult(resolved.result);
    }

    function handleRetreat (): void {
        const confirmed = window.confirm('現在のプレイを破棄してコース選択へ戻ります。よろしいですか？');

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
        setValidationMessage('');
        setTileTarget(currentQuestion?.answerKind === 'quotientRemainder' ? 'quotient' : 'answer');
    }

    function appendTileValue (value: string): void {
        if ((feedback != null) || (currentQuestion == null)) {
            return;
        }

        setValidationMessage('');

        if (currentQuestion.answerKind === 'quotientRemainder') {
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
        if (currentQuestion?.answerKind !== 'number') {
            return;
        }

        if (answerValue.includes('.') === false) {
            setAnswerValue((prev) => {
                return `${prev}.`;
            });
        }
    }

    return (
        <div className="page-container">
            <section className="card hero-start-card drill-play-card adventure-play-card">
                <div className="hero-title-row">
                    <div>
                        <h1>{currentAdventure.dungeonName}</h1>
                        <p className="sub-text hero-subtext">
                            左端のブロックが今の問題です。まちがえたら同じブロックに再挑戦し、正解すると壊して次へ進みます。
                        </p>
                    </div>

                    <span className="timer-badge adventure-timer-badge">
                        残り {Math.max(0, (currentAdventure.remainingMs / 1000)).toFixed(1)} 秒
                    </span>
                </div>

                <div className="drill-status-bar top-gap bottom-gap">
                    <div className="drill-status-chip drill-status-chip-time">
                        <span className="drill-status-label">残り時間</span>
                        <strong>{Math.max(0, (currentAdventure.remainingMs / 1000)).toFixed(1)} 秒</strong>
                    </div>
                    <div className="drill-status-chip">
                        <span className="drill-status-label">突破問題数</span>
                        <strong>{currentAdventure.correctCount}問</strong>
                    </div>
                    <div className="drill-status-chip">
                        <span className="drill-status-label">現在の障害</span>
                        <strong>{currentEnemy?.enemyName ?? '制覇判定中'}</strong>
                    </div>
                </div>

                <QuestionStackBoard
                    variant="adventure"
                    expressions={stackExpressions}
                    animationKind={feedback?.kind ?? null}
                />

                {currentQuestion?.inputHint != null && (
                    <p className="sub-text top-gap">{currentQuestion.inputHint}</p>
                )}

                <div className="top-gap">
                    <TileAnswerPanel
                        answerKind={currentQuestion?.answerKind ?? 'number'}
                        answerValue={answerValue}
                        quotientValue={quotientValue}
                        remainderValue={remainderValue}
                        activeTarget={tileTarget}
                        disabled={(feedback != null) || (currentQuestion == null)}
                        allowMinus={minusKeyEnabled}
                        allowDecimal={(currentQuestion?.answerKind === 'number') && (decimalKeyEnabled === true)}
                        submitLabel="解答"
                        validationMessage={validationMessage}
                        onSetTarget={setTileTarget}
                        onAppendTileValue={appendTileValue}
                        onBackspace={backspaceTileValue}
                        onClear={clearInputs}
                        onAppendMinus={appendMinus}
                        onAppendDecimal={appendDecimal}
                        onSubmit={handleSubmitAnswer}
                    />
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
                        このプレイを中断
                    </button>
                </div>
            </section>

            {feedback != null && (
                <div className={`feedback-overlay ${buildFeedbackClassName(feedback.kind)}`}>
                    <div className="feedback-overlay-panel">
                        <div className="feedback-symbol">{feedback.kind === 'timeout' ? '⌛' : '×'}</div>
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

function buildFeedbackClassName (kind: AdventureFeedbackState['kind']): string {
    if (kind === 'timeout') {
        return 'feedback-timeout';
    }

    return 'feedback-wrong';
}
