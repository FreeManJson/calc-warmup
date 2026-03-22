import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FEEDBACK_DELAY_MS } from '../constants/appConstants';
import { useAppContext } from '../context/AppContext';
import type { AnswerResult, InputMethodType } from '../types/appTypes';
import {
    compareAnswer,
    getCourseLabel,
} from '../utils/quizUtils';
import {
    buildQuizResult,
    evaluateQuestionScore,
} from '../utils/scoreUtils';

type PhaseType = 'countdown' | 'active' | 'feedback';
type ActiveInputModeType = 'keyboard' | 'tile';
type FeedbackKindType = 'correct' | 'wrong' | 'timeout' | null;
type TileTargetType = 'answer' | 'quotient' | 'remainder';

export function QuizPage () {
    const navigate = useNavigate();
    const {
        currentQuiz,
        finishQuiz,
        clearQuiz,
        startQuiz,
        users,
    } = useAppContext();

    const [phase, setPhase] = useState<PhaseType>('countdown');
    const [countdownValue, setCountdownValue] = useState<number>(3);
    const [currentIndex, setCurrentIndex] = useState<number>(0);
    const [answerValue, setAnswerValue] = useState<string>('');
    const [quotientValue, setQuotientValue] = useState<string>('');
    const [remainderValue, setRemainderValue] = useState<string>('');
    const [tileTarget, setTileTarget] = useState<TileTargetType>('answer');
    const [answers, setAnswers] = useState<AnswerResult[]>([]);
    const [questionStartedAt, setQuestionStartedAt] = useState<number | null>(null);
    const [pausedAt, setPausedAt] = useState<number | null>(null);
    const [pausedMs, setPausedMs] = useState<number>(0);
    const [nowTick, setNowTick] = useState<number>(Date.now());
    const [remainingMsDisplay, setRemainingMsDisplay] = useState<number | null>(null);
    const [feedbackClassName, setFeedbackClassName] = useState<string>('');
    const [feedbackText, setFeedbackText] = useState<string>('');
    const [feedbackKind, setFeedbackKind] = useState<FeedbackKindType>(null);
    const [feedbackSymbol, setFeedbackSymbol] = useState<string>('');
    const [feedbackEquationLeft, setFeedbackEquationLeft] = useState<string>('');
    const [feedbackEquationAnswer, setFeedbackEquationAnswer] = useState<string>('');
    const [feedbackSubText, setFeedbackSubText] = useState<string>('');
    const [validationMessage, setValidationMessage] = useState<string>('');
    const [activeInputMode, setActiveInputMode] = useState<ActiveInputModeType>(() => {
        return resolveInitialInteractiveInputMode('auto');
    });

    const nextTimeoutRef = useRef<number | null>(null);
    const answerInputRef = useRef<HTMLInputElement | null>(null);
    const quotientInputRef = useRef<HTMLInputElement | null>(null);
    const remainderInputRef = useRef<HTMLInputElement | null>(null);
    const questionSectionRef = useRef<HTMLElement | null>(null);
    const isComposingRef = useRef<boolean>(false);

    const currentQuestion = useMemo(() => {
        if (currentQuiz == null) {
            return null;
        }

        return currentQuiz.questions[currentIndex] ?? null;
    }, [currentQuiz, currentIndex]);

    const elapsedMs = useMemo(() => {
        if (questionStartedAt == null) {
            return 0;
        }

        const effectiveNow = (pausedAt ?? nowTick);
        return Math.max(0, (effectiveNow - questionStartedAt - pausedMs));
    }, [questionStartedAt, pausedAt, nowTick, pausedMs]);

    const paused = (pausedAt != null);
    const decimalKeyEnabled = (
        (currentQuiz?.settingsSnapshot.allowDecimal === true) ||
        (currentQuiz?.settingsSnapshot.allowRealDivision === true)
    );
    const minusKeyEnabled = (
        (currentQuiz?.settingsSnapshot.allowNegative === true) ||
        ((currentQuestion?.expectedNumber ?? 0) < 0)
    );
    const isQuotientRemainder = (currentQuestion?.answerKind === 'quotientRemainder');
    const activeKeyboardTarget = (
        isQuotientRemainder === true
            ? (tileTarget === 'remainder' ? 'remainder' : 'quotient')
            : 'answer'
    );

    useEffect(() => {
        return () => {
            if (nextTimeoutRef.current != null) {
                window.clearTimeout(nextTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (currentQuiz == null) {
            return;
        }

        setPhase('countdown');
        setCountdownValue(3);
        setCurrentIndex(0);
        clearCurrentInputStates();
        setAnswers([]);
        setQuestionStartedAt(null);
        setPausedAt(null);
        setPausedMs(0);
        setNowTick(Date.now());
        setFeedbackClassName('');
        setFeedbackText('');
        setFeedbackKind(null);
        setFeedbackSymbol('');
        setFeedbackEquationLeft('');
        setFeedbackEquationAnswer('');
        setFeedbackSubText('');
        setValidationMessage('');
        setRemainingMsDisplay(
            currentQuiz.settingsSnapshot.timeLimitEnabled === true
                ? (currentQuiz.settingsSnapshot.timeLimitSec * 1000)
                : null
        );
        setActiveInputMode(
            resolveInitialInteractiveInputMode(currentQuiz.settingsSnapshot.inputMethod)
        );
    }, [currentQuiz?.id]);

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
        if (phase !== 'countdown') {
            return;
        }

        if (countdownValue <= 0) {
            setPhase('active');
            setQuestionStartedAt(Date.now());
            setPausedAt(null);
            setPausedMs(0);
            setNowTick(Date.now());

            if (
                (currentQuiz != null) &&
                (currentQuiz.settingsSnapshot.timeLimitEnabled === true)
            ) {
                setRemainingMsDisplay(currentQuiz.settingsSnapshot.timeLimitSec * 1000);
            } else {
                setRemainingMsDisplay(null);
            }

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
    }, [phase, countdownValue, currentQuiz]);

    useEffect(() => {
        if ((phase !== 'active') || (paused === true)) {
            return;
        }

        if (activeInputMode !== 'keyboard') {
            blurAllInputs();
            return;
        }

        const timerId = window.setTimeout(() => {
            focusKeyboardTarget(activeKeyboardTarget);
        }, 0);

        return () => {
            window.clearTimeout(timerId);
        };
    }, [phase, paused, activeInputMode, currentIndex, activeKeyboardTarget]);

    useEffect(() => {
        if ((phase !== 'active') && (phase !== 'countdown')) {
            return;
        }

        const timerId = window.setTimeout(() => {
            questionSectionRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
            });
        }, 0);

        return () => {
            window.clearTimeout(timerId);
        };
    }, [phase, currentIndex]);

    useEffect(() => {
        if (
            (phase !== 'active') ||
            (currentQuiz == null) ||
            (questionStartedAt == null) ||
            (pausedAt != null)
        ) {
            return;
        }

        const intervalId = window.setInterval(() => {
            const now = Date.now();
            setNowTick(now);

            if (currentQuiz.settingsSnapshot.timeLimitEnabled === true) {
                const elapsed = Math.max(0, (now - questionStartedAt - pausedMs));
                const limitMs = (currentQuiz.settingsSnapshot.timeLimitSec * 1000);
                const remainingMs = Math.max(0, (limitMs - elapsed));

                setRemainingMsDisplay(remainingMs);

                if (elapsed >= limitMs) {
                    window.clearInterval(intervalId);
                    handleSettleCurrentQuestion('timeout');
                }
            } else {
                setRemainingMsDisplay(null);
            }
        }, 100);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [
        phase,
        currentQuiz,
        questionStartedAt,
        pausedAt,
        pausedMs,
    ]);

    const goToNextQuestionOrFinish = useCallback((nextAnswers: AnswerResult[]) => {
        if (currentQuiz == null) {
            return;
        }

        const isLastQuestion = ((currentIndex + 1) >= currentQuiz.questions.length);

        if (isLastQuestion === true) {
            const userName = (
                users.find((user) => {
                    return (user.id === currentQuiz.selectedUserId);
                })?.name ?? 'ゲスト'
            );

            const result = buildQuizResult(
                userName,
                currentQuiz.settingsSnapshot,
                nextAnswers,
                { completed: true }
            );

            finishQuiz(result);
            navigate('/result');
            return;
        }

        setCurrentIndex((prev) => {
            return (prev + 1);
        });
        setPhase('active');
        setQuestionStartedAt(Date.now());
        setPausedAt(null);
        setPausedMs(0);
        setNowTick(Date.now());
        setFeedbackClassName('');
        setFeedbackText('');
        setFeedbackKind(null);
        setFeedbackSymbol('');
        setFeedbackEquationLeft('');
        setFeedbackEquationAnswer('');
        setFeedbackSubText('');
        setValidationMessage('');
        clearCurrentInputStates();

        if (currentQuiz.settingsSnapshot.timeLimitEnabled === true) {
            setRemainingMsDisplay(currentQuiz.settingsSnapshot.timeLimitSec * 1000);
        } else {
            setRemainingMsDisplay(null);
        }
    }, [
        currentQuiz,
        currentIndex,
        users,
        finishQuiz,
        navigate,
    ]);

    const handleSettleCurrentQuestion = useCallback((mode: 'submit' | 'timeout') => {
        if (
            (currentQuiz == null) ||
            (currentQuestion == null) ||
            (phase !== 'active')
        ) {
            return;
        }

        if (mode === 'submit') {
            const validation = validateCurrentInput(
                currentQuestion.answerKind,
                answerValue,
                quotientValue,
                remainderValue
            );

            if (validation.ok === false) {
                setValidationMessage(validation.message);
                return;
            }
        }

        const effectiveElapsedMs = (
            questionStartedAt == null
                ? 0
                : Math.max(0, ((Date.now()) - questionStartedAt - pausedMs))
        );

        const userInput = buildUserInput(
            currentQuestion.answerKind,
            answerValue,
            quotientValue,
            remainderValue
        );

        const compareResult = (
            mode === 'timeout'
                ? { isCorrect: false, normalizedInput: '(時間切れ)' }
                : compareAnswer(currentQuestion, userInput)
        );

        const isCorrect = (
            (mode !== 'timeout') &&
            (compareResult.isCorrect === true)
        );

        const scoreDetail = evaluateQuestionScore(
            currentQuestion,
            effectiveElapsedMs,
            isCorrect,
            currentQuiz.settingsSnapshot
        );

        const answerRecord: AnswerResult = {
            questionId: currentQuestion.id,
            questionText: currentQuestion.expression,
            course: currentQuestion.course,
            userAnswer: (
                mode === 'timeout'
                    ? '(時間切れ)'
                    : compareResult.normalizedInput
            ),
            correctAnswerText: currentQuestion.correctText,
            isCorrect,
            isTimeout: (mode === 'timeout'),
            elapsedMs: effectiveElapsedMs,
            score: scoreDetail.questionScore,
            scoreDetail,
        };

        const nextAnswers = [...answers, answerRecord];
        const feedbackEquation = buildFeedbackEquation(
            currentQuestion.expression,
            currentQuestion.correctText
        );

        setAnswers(nextAnswers);
        setPhase('feedback');
        setValidationMessage('');
        clearCurrentInputStates();

        let delayMs: number = FEEDBACK_DELAY_MS.wrong;

        if (mode === 'timeout') {
            setFeedbackClassName('feedback-timeout');
            setFeedbackText('時間切れ');
            setFeedbackKind('timeout');
            setFeedbackSymbol('!');
            setFeedbackEquationLeft(feedbackEquation.leftText);
            setFeedbackEquationAnswer(feedbackEquation.answerText);
            setFeedbackSubText('時間内に解答できませんでした');
            delayMs = FEEDBACK_DELAY_MS.timeout;
        } else if (isCorrect === true) {
            setFeedbackClassName('feedback-correct');
            setFeedbackText('正解');
            setFeedbackKind('correct');
            setFeedbackSymbol('○');
            setFeedbackEquationLeft(feedbackEquation.leftText);
            setFeedbackEquationAnswer(feedbackEquation.answerText);
            setFeedbackSubText(`+${answerRecord.score}点`);
            delayMs = FEEDBACK_DELAY_MS.correct;
        } else {
            setFeedbackClassName('feedback-wrong');
            setFeedbackText('不正解');
            setFeedbackKind('wrong');
            setFeedbackSymbol('×');
            setFeedbackEquationLeft(feedbackEquation.leftText);
            setFeedbackEquationAnswer(feedbackEquation.answerText);
            setFeedbackSubText(`あなたの回答: ${answerRecord.userAnswer}`);
            delayMs = FEEDBACK_DELAY_MS.wrong;
        }

        if (nextTimeoutRef.current != null) {
            window.clearTimeout(nextTimeoutRef.current);
        }

        nextTimeoutRef.current = window.setTimeout(() => {
            goToNextQuestionOrFinish(nextAnswers);
        }, delayMs);
    }, [
        currentQuiz,
        currentQuestion,
        phase,
        questionStartedAt,
        pausedMs,
        answerValue,
        quotientValue,
        remainderValue,
        answers,
        goToNextQuestionOrFinish,
    ]);

    function clearCurrentInputStates (): void {
        setAnswerValue('');
        setQuotientValue('');
        setRemainderValue('');
    }

    function blurAllInputs (): void {
        answerInputRef.current?.blur();
        quotientInputRef.current?.blur();
        remainderInputRef.current?.blur();
    }

    function focusKeyboardTarget (target: TileTargetType): void {
        if (target === 'quotient') {
            quotientInputRef.current?.focus();
            quotientInputRef.current?.select();
            return;
        }

        if (target === 'remainder') {
            remainderInputRef.current?.focus();
            remainderInputRef.current?.select();
            return;
        }

        answerInputRef.current?.focus();
        answerInputRef.current?.select();
    }

    function handlePauseToggle (): void {
        if (phase !== 'active') {
            return;
        }

        if (pausedAt == null) {
            setPausedAt(Date.now());
            return;
        }

        const pausedDurationMs = (Date.now() - pausedAt);

        setPausedMs((prev) => {
            return (prev + pausedDurationMs);
        });
        setPausedAt(null);
        setNowTick(Date.now());
    }

    function handleRetry (): void {
        const confirmed = window.confirm('同じ設定で最初からやり直しますか？');

        if (confirmed === false) {
            return;
        }

        if (nextTimeoutRef.current != null) {
            window.clearTimeout(nextTimeoutRef.current);
            nextTimeoutRef.current = null;
        }

        const started = startQuiz();

        if (started === true) {
            setFeedbackText('');
            setFeedbackClassName('');
            setFeedbackKind(null);
            setFeedbackSymbol('');
            setFeedbackEquationLeft('');
            setFeedbackEquationAnswer('');
            setFeedbackSubText('');
            setValidationMessage('');
        }
    }

    function handleBackToTop (): void {
        const confirmed = window.confirm('TOPへ戻ります。現在のプレイは終了します。');

        if (confirmed === false) {
            return;
        }

        if (nextTimeoutRef.current != null) {
            window.clearTimeout(nextTimeoutRef.current);
            nextTimeoutRef.current = null;
        }

        clearQuiz();
        navigate('/');
    }

    function handleSubmit (event: React.FormEvent<HTMLFormElement>): void {
        event.preventDefault();
        handleSettleCurrentQuestion('submit');
    }

    function handleInputKeyDown (event: React.KeyboardEvent<HTMLInputElement>): void {
        if (isComposingRef.current === true) {
            return;
        }

        if (event.key !== 'Enter') {
            return;
        }

        event.preventDefault();

        if ((phase === 'active') && (paused === false)) {
            handleSettleCurrentQuestion('submit');
            return;
        }

        if (phase === 'feedback') {
            if (nextTimeoutRef.current != null) {
                window.clearTimeout(nextTimeoutRef.current);
                nextTimeoutRef.current = null;
            }

            goToNextQuestionOrFinish(answers);
        }
    }

    function handleQuotientKeyDown (event: React.KeyboardEvent<HTMLInputElement>): void {
        if (event.key !== 'Enter') {
            return;
        }

        event.preventDefault();

        if (isQuotientRemainder === true) {
            setTileTarget('remainder');
            remainderInputRef.current?.focus();
            remainderInputRef.current?.select();
        }
    }

    function switchToKeyboardMode (target?: TileTargetType): void {
        if ((phase !== 'active') || (paused === true)) {
            return;
        }

        if (target != null) {
            setTileTarget(target);
        }

        setActiveInputMode('keyboard');

        window.setTimeout(() => {
            focusKeyboardTarget(target ?? activeKeyboardTarget);
        }, 0);
    }

    function switchToTileMode (target?: TileTargetType): void {
        if ((phase !== 'active') || (paused === true)) {
            return;
        }

        if (target != null) {
            setTileTarget(target);
        }

        setActiveInputMode('tile');
        blurAllInputs();
    }

    function appendTileValue (text: string): void {
        if ((phase !== 'active') || (paused === true)) {
            return;
        }

        switchToTileMode();
        setValidationMessage('');

        if (isQuotientRemainder === true) {
            if (tileTarget === 'remainder') {
                setRemainderValue((prev) => {
                    return (prev + text);
                });
                return;
            }

            setQuotientValue((prev) => {
                return (prev + text);
            });
            return;
        }

        setAnswerValue((prev) => {
            return (prev + text);
        });
    }

    function backspaceInputValue (): void {
        if ((phase !== 'active') || (paused === true)) {
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

    function clearInputValue (): void {
        if ((phase !== 'active') || (paused === true)) {
            return;
        }

        switchToTileMode();
        clearCurrentInputStates();
        setValidationMessage('');
    }

    function appendMinus (): void {
        if ((phase !== 'active') || (paused === true)) {
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
        if ((phase !== 'active') || (paused === true) || (isQuotientRemainder === true)) {
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

    if ((currentQuiz == null) || (currentQuestion == null)) {
        return (
            <div className="page-container">
                <h1>出題画面</h1>

                <section className="card">
                    <p>開始前です。TOPからコースを選んで開始してください。</p>

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

    const questionNo = (currentIndex + 1);
    const totalQuestions = currentQuiz.questions.length;

    return (
        <div className="page-container">
            <header className="quiz-header">
                <div>
                    <h1>出題画面</h1>
                    <p className="sub-text">
                        {questionNo} / {totalQuestions}問目 ・ {getCourseLabel(currentQuestion.course)}
                    </p>
                </div>

                <div className="button-row">
                    <button
                        type="button"
                        onClick={() => {
                            handlePauseToggle();
                        }}
                    >
                        {paused === true ? '再開' : '一時停止'}
                    </button>

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
                            handleRetry();
                        }}
                    >
                        リトライ
                    </button>
                </div>
            </header>

            {phase === 'countdown' && (
                <section className="card" ref={questionSectionRef}>
                    <h2>カウントダウン</h2>
                    <div className="big-display">{countdownValue}</div>
                </section>
            )}

            {phase !== 'countdown' && (
                <section className="card" ref={questionSectionRef}>
                    <div className="status-row">
                        <div>
                            <strong>経過時間:</strong> {formatSecondsFromMs(elapsedMs)} 秒
                        </div>

                        {remainingMsDisplay != null && (
                            <div className="timer-badge">
                                残り: {formatSecondsFromMs(remainingMsDisplay)} 秒
                            </div>
                        )}
                    </div>

                    <div className="inline-input-mode-row top-gap">
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

                    <h2 className="top-gap">問題</h2>
                    <div className="question-box">{currentQuestion.expression}</div>

                    {currentQuestion.inputHint != null && (
                        <p className="sub-text">{currentQuestion.inputHint}</p>
                    )}

                    <form onSubmit={handleSubmit} className="answer-layout top-gap">
                        {currentQuestion.answerKind === 'number' && (
                            <label>
                                回答入力
                                <input
                                    ref={answerInputRef}
                                    className="input-control"
                                    type="text"
                                    value={answerValue}
                                    disabled={(phase !== 'active') || (paused === true)}
                                    placeholder="ここに答えを入力"
                                    inputMode={
                                        currentQuestion.course === 'div' &&
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
                                        setTileTarget('answer');
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
                                        setAnswerValue(event.target.value);
                                        setValidationMessage('');
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
                                        disabled={(phase !== 'active') || (paused === true)}
                                        placeholder="商"
                                        inputMode="numeric"
                                        autoComplete="off"
                                        onFocus={() => {
                                            setTileTarget('quotient');
                                            setActiveInputMode('keyboard');
                                        }}
                                        onKeyDown={handleQuotientKeyDown}
                                        onChange={(event) => {
                                            setQuotientValue(event.target.value);
                                            setValidationMessage('');
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
                                        disabled={(phase !== 'active') || (paused === true)}
                                        placeholder="余り"
                                        inputMode="numeric"
                                        autoComplete="off"
                                        onFocus={() => {
                                            setTileTarget('remainder');
                                            setActiveInputMode('keyboard');
                                        }}
                                        onKeyDown={handleInputKeyDown}
                                        onChange={(event) => {
                                            setRemainderValue(event.target.value);
                                            setValidationMessage('');
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
                                    type="submit"
                                    className="primary-button"
                                    disabled={(phase !== 'active') || (paused === true)}
                                >
                                    回答する
                                </button>
                            </div>
                        )}
                    </form>

                    {(activeInputMode === 'tile') && (
                        <div className="top-gap">
                            {isQuotientRemainder === true && (
                                <div className="tile-target-row bottom-gap">
                                    <span className="sub-text">入力先</span>
                                    <div className="segmented-row">
                                        <button
                                            type="button"
                                            className={`segmented-button ${tileTarget === 'quotient' ? 'is-selected' : ''}`}
                                            onClick={() => {
                                                switchToTileMode('quotient');
                                            }}
                                        >
                                            商
                                        </button>
                                        <button
                                            type="button"
                                            className={`segmented-button ${tileTarget === 'remainder' ? 'is-selected' : ''}`}
                                            onClick={() => {
                                                switchToTileMode('remainder');
                                            }}
                                        >
                                            余り
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="keypad-grid">
                                <button type="button" className="keypad-button" disabled={(phase !== 'active') || paused} onClick={() => { appendTileValue('7'); }}>7</button>
                                <button type="button" className="keypad-button" disabled={(phase !== 'active') || paused} onClick={() => { appendTileValue('8'); }}>8</button>
                                <button type="button" className="keypad-button" disabled={(phase !== 'active') || paused} onClick={() => { appendTileValue('9'); }}>9</button>
                                <button type="button" className="keypad-button keypad-button-sub" disabled={(phase !== 'active') || paused} onClick={() => { backspaceInputValue(); }}>←</button>

                                <button type="button" className="keypad-button" disabled={(phase !== 'active') || paused} onClick={() => { appendTileValue('4'); }}>4</button>
                                <button type="button" className="keypad-button" disabled={(phase !== 'active') || paused} onClick={() => { appendTileValue('5'); }}>5</button>
                                <button type="button" className="keypad-button" disabled={(phase !== 'active') || paused} onClick={() => { appendTileValue('6'); }}>6</button>
                                <button type="button" className="keypad-button keypad-button-sub" disabled={(phase !== 'active') || paused} onClick={() => { clearInputValue(); }}>C</button>

                                <button type="button" className="keypad-button" disabled={(phase !== 'active') || paused} onClick={() => { appendTileValue('1'); }}>1</button>
                                <button type="button" className="keypad-button" disabled={(phase !== 'active') || paused} onClick={() => { appendTileValue('2'); }}>2</button>
                                <button type="button" className="keypad-button" disabled={(phase !== 'active') || paused} onClick={() => { appendTileValue('3'); }}>3</button>
                                <button type="button" className="keypad-button keypad-button-sub" disabled={(phase !== 'active') || paused || (minusKeyEnabled === false)} onClick={() => { appendMinus(); }}>-</button>

                                <button type="button" className="keypad-button keypad-button-wide" disabled={(phase !== 'active') || paused} onClick={() => { appendTileValue('0'); }}>0</button>
                                <button type="button" className="keypad-button keypad-button-sub" disabled={(phase !== 'active') || paused || (decimalKeyEnabled === false) || (isQuotientRemainder === true)} onClick={() => { appendDecimal(); }}>.</button>
                                <button type="button" className="keypad-button keypad-button-primary" disabled={(phase !== 'active') || paused} onClick={() => { handleSettleCurrentQuestion('submit'); }}>回答</button>
                            </div>
                        </div>
                    )}

                    {paused === true && (
                        <section className="card paused-box top-gap">
                            <strong>一時停止中</strong>
                            <p className="sub-text">「再開」を押すと続きから再開します。</p>
                        </section>
                    )}
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

function validateCurrentInput (
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

function formatSecondsFromMs (ms: number): string {
    return Math.max(0, (ms / 1000)).toFixed(1);
}
