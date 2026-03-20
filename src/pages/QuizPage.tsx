import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent, RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { FEEDBACK_DELAY_MS } from '../constants/appConstants';
import { useAppContext } from '../context/AppContext';
import type { AnswerKind, AnswerResult, InputMethodType } from '../types/appTypes';
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
type AnswerFieldType = 'main' | 'remainder';

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
    const [mainInputValue, setMainInputValue] = useState<string>('');
    const [remainderInputValue, setRemainderInputValue] = useState<string>('');
    const [activeAnswerField, setActiveAnswerField] = useState<AnswerFieldType>('main');
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
    const [activeInputMode, setActiveInputMode] = useState<ActiveInputModeType>(() => {
        return resolveInitialInteractiveInputMode('auto');
    });

    const nextTimeoutRef = useRef<number | null>(null);
    const mainInputRef = useRef<HTMLInputElement | null>(null);
    const remainderInputRef = useRef<HTMLInputElement | null>(null);
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
    const usesRemainderInputs = (currentQuestion?.answerKind === 'quotientRemainder');
    const decimalKeyEnabled = (
        (usesRemainderInputs === false) &&
        (
            (currentQuiz?.settingsSnapshot.allowDecimal === true) ||
            (currentQuiz?.settingsSnapshot.allowRealDivision === true)
        )
    );
    const minusKeyEnabled = (
        (currentQuiz?.settingsSnapshot.allowNegative === true) ||
        ((currentQuestion?.expectedNumber ?? 0) < 0)
    );
    const canSubmitCurrentAnswer = hasSubmittableMainInput(mainInputValue);

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
        resetAnswerInputs();
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
        if (phase !== 'countdown') {
            return;
        }

        if (countdownValue <= 0) {
            setPhase('active');
            setQuestionStartedAt(Date.now());
            setPausedAt(null);
            setPausedMs(0);
            setNowTick(Date.now());
            setActiveAnswerField('main');

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
        if ((phase !== 'active') || (pausedAt != null)) {
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
    }, [phase, currentIndex, pausedAt, activeInputMode, activeAnswerField, usesRemainderInputs]);

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
        resetAnswerInputs();

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

    const handleSettleCurrentQuestion = useCallback((
        mode: 'submit' | 'timeout'
    ) => {
        if (
            (currentQuiz == null) ||
            (currentQuestion == null) ||
            (phase !== 'active')
        ) {
            return;
        }

        const effectiveElapsedMs = (
            questionStartedAt == null
                ? 0
                : Math.max(0, ((Date.now()) - questionStartedAt - pausedMs))
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
                    : (
                        compareResult.normalizedInput.trim().length > 0
                            ? compareResult.normalizedInput
                            : '(未入力)'
                    )
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
        resetAnswerInputs();

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
        mainInputValue,
        remainderInputValue,
        answers,
        goToNextQuestionOrFinish,
    ]);

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
        handleSettleCurrentQuestion,
    ]);

    function resetAnswerInputs (): void {
        setMainInputValue('');
        setRemainderInputValue('');
        setActiveAnswerField('main');
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

    function handleSubmit (event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();
        handleSettleCurrentQuestion('submit');
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

        if ((phase === 'active') && (paused === false)) {
            if ((usesRemainderInputs === true) && (field === 'main')) {
                setActiveAnswerField('remainder');
                window.setTimeout(() => {
                    remainderInputRef.current?.focus();
                    remainderInputRef.current?.select();
                }, 0);
                return;
            }

            if (canSubmitCurrentAnswer === true) {
                handleSettleCurrentQuestion('submit');
            }
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

    function switchToKeyboardMode (): void {
        if ((phase !== 'active') || (paused === true)) {
            return;
        }

        setActiveInputMode('keyboard');

        window.setTimeout(() => {
            focusAnswerField(activeAnswerField, mainInputRef, remainderInputRef, usesRemainderInputs);
        }, 0);
    }

    function switchToTileMode (): void {
        setActiveInputMode('tile');
        mainInputRef.current?.blur();
        remainderInputRef.current?.blur();
    }

    function appendInputValue (text: string): void {
        if ((phase !== 'active') || (paused === true)) {
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
        if ((phase !== 'active') || (paused === true)) {
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
        if ((phase !== 'active') || (paused === true)) {
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
        if ((phase !== 'active') || (paused === true)) {
            return;
        }

        if (canSubmitCurrentAnswer === false) {
            return;
        }

        handleSettleCurrentQuestion('submit');
    }

    function handleRemainderToggle (): void {
        if ((phase !== 'active') || (paused === true) || (usesRemainderInputs === false)) {
            return;
        }

        switchToTileMode();
        setActiveAnswerField((prev) => {
            return (prev === 'main' ? 'remainder' : 'main');
        });
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
                <section className="card">
                    <h2>カウントダウン</h2>
                    <div className="big-display">{countdownValue}</div>
                </section>
            )}

            {phase !== 'countdown' && (
                <>
                    <section className="card">
                        <div className="status-row">
                            <div>
                                <strong>経過時間:</strong> {formatFixedSeconds(elapsedMs)} 秒
                            </div>

                            {remainingMsDisplay != null && (
                                <div className="timer-badge">
                                    残り: {formatFixedSeconds(remainingMsDisplay)} 秒
                                </div>
                            )}
                        </div>

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
                        <div className="question-box">{currentQuestion.expression}</div>

                        {currentQuestion.inputHint != null && (
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
                                            disabled={(phase !== 'active') || (paused === true)}
                                            placeholder="商を入力"
                                            inputMode="numeric"
                                            enterKeyHint={usesRemainderInputs === true ? 'next' : 'done'}
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
                                            disabled={(phase !== 'active') || (paused === true)}
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
                                    disabled={(phase !== 'active') || (paused === true) || (canSubmitCurrentAnswer === false)}
                                >
                                    回答する
                                </button>
                            </div>
                        </form>
                    </section>

                    <section className="card">
                        <h2>数字タイル入力</h2>

                        <div className="keypad-grid">
                            <button type="button" className="keypad-button" disabled={(phase !== 'active') || (paused === true)} onClick={() => { appendInputValue('7'); }}>7</button>
                            <button type="button" className="keypad-button" disabled={(phase !== 'active') || (paused === true)} onClick={() => { appendInputValue('8'); }}>8</button>
                            <button type="button" className="keypad-button" disabled={(phase !== 'active') || (paused === true)} onClick={() => { appendInputValue('9'); }}>9</button>
                            <button type="button" className="keypad-button keypad-button-sub" disabled={(phase !== 'active') || (paused === true)} onClick={() => { backspaceInputValue(); }}>←</button>

                            <button type="button" className="keypad-button" disabled={(phase !== 'active') || (paused === true)} onClick={() => { appendInputValue('4'); }}>4</button>
                            <button type="button" className="keypad-button" disabled={(phase !== 'active') || (paused === true)} onClick={() => { appendInputValue('5'); }}>5</button>
                            <button type="button" className="keypad-button" disabled={(phase !== 'active') || (paused === true)} onClick={() => { appendInputValue('6'); }}>6</button>
                            <button type="button" className="keypad-button keypad-button-sub" disabled={(phase !== 'active') || (paused === true)} onClick={() => { clearInputValue(); }}>C</button>

                            <button type="button" className="keypad-button" disabled={(phase !== 'active') || (paused === true)} onClick={() => { appendInputValue('1'); }}>1</button>
                            <button type="button" className="keypad-button" disabled={(phase !== 'active') || (paused === true)} onClick={() => { appendInputValue('2'); }}>2</button>
                            <button type="button" className="keypad-button" disabled={(phase !== 'active') || (paused === true)} onClick={() => { appendInputValue('3'); }}>3</button>
                            <button type="button" className="keypad-button keypad-button-sub" disabled={(phase !== 'active') || (paused === true) || (minusKeyEnabled === false) || (activeAnswerField === 'remainder')} onClick={() => { appendInputValue('-'); }}>-</button>

                            <button type="button" className="keypad-button keypad-button-wide" disabled={(phase !== 'active') || (paused === true)} onClick={() => { appendInputValue('0'); }}>0</button>
                            <button type="button" className="keypad-button keypad-button-sub" disabled={(phase !== 'active') || (paused === true) || (decimalKeyEnabled === false) || (activeAnswerField === 'remainder')} onClick={() => { appendInputValue('.'); }}>.</button>
                            <button type="button" className="keypad-button keypad-button-sub" disabled={(phase !== 'active') || (paused === true)} onClick={() => { handleRemainderToggle(); }}>{activeAnswerField === 'main' ? 'あまり' : '商へ'}</button>
                            <button type="button" className="keypad-button keypad-button-primary" disabled={(phase !== 'active') || (paused === true) || (canSubmitCurrentAnswer === false)} onClick={() => { handleTileSubmit(); }}>回答</button>
                        </div>
                    </section>
                </>
            )}

            {paused === true && (
                <section className="card paused-box">
                    <h2>一時停止中</h2>
                    <p>再開ボタンで問題に戻れます。</p>
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

function formatFixedSeconds (ms: number): string {
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
