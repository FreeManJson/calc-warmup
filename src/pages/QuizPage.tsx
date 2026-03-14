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
    const [inputValue, setInputValue] = useState<string>('');
    const [answers, setAnswers] = useState<AnswerResult[]>([]);
    const [questionStartedAt, setQuestionStartedAt] = useState<number | null>(null);
    const [pausedAt, setPausedAt] = useState<number | null>(null);
    const [pausedMs, setPausedMs] = useState<number>(0);
    const [nowTick, setNowTick] = useState<number>(Date.now());
    const [feedbackClassName, setFeedbackClassName] = useState<string>('');
    const [feedbackText, setFeedbackText] = useState<string>('');
    const [activeInputMode, setActiveInputMode] = useState<ActiveInputModeType>(() => {
        return resolveInitialInteractiveInputMode('auto');
    });

    const nextTimeoutRef = useRef<number | null>(null);
    const answerInputRef = useRef<HTMLInputElement | null>(null);
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

    const remainingMs = useMemo(() => {
        if (
            (currentQuiz == null) ||
            (currentQuiz.settingsSnapshot.timeLimitEnabled === false)
        ) {
            return null;
        }

        const limitMs = (currentQuiz.settingsSnapshot.timeLimitSec * 1000);
        return Math.max(0, (limitMs - elapsedMs));
    }, [currentQuiz, elapsedMs]);

    const paused = (pausedAt != null);

    const decimalKeyEnabled = (
        (currentQuiz?.settingsSnapshot.allowDecimal === true) ||
        (currentQuiz?.settingsSnapshot.allowRealDivision === true)
    );

    const spaceKeyEnabled = (
        currentQuestion?.answerKind === 'quotientRemainder'
    );

    const minusKeyEnabled = (
        (currentQuiz?.settingsSnapshot.allowNegative === true) ||
        ((currentQuestion?.expectedNumber ?? 0) < 0)
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
        setInputValue('');
        setAnswers([]);
        setQuestionStartedAt(null);
        setPausedAt(null);
        setPausedMs(0);
        setNowTick(Date.now());
        setFeedbackClassName('');
        setFeedbackText('');
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
        if ((phase !== 'active') || (pausedAt != null)) {
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
    }, [phase, currentIndex, pausedAt, activeInputMode]);

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

        const compareResult = (
            mode === 'timeout'
                ? { isCorrect: false, normalizedInput: '(時間切れ)' }
                : compareAnswer(currentQuestion, inputValue)
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

        setAnswers(nextAnswers);
        setPhase('feedback');
        setInputValue('');

        let delayMs: number = FEEDBACK_DELAY_MS.wrong;

        if (mode === 'timeout') {
            setFeedbackClassName('feedback-timeout');
            setFeedbackText(`時間切れ！ 正解: ${currentQuestion.correctText}`);
            delayMs = FEEDBACK_DELAY_MS.timeout;
        } else if (isCorrect === true) {
            setFeedbackClassName('feedback-correct');
            setFeedbackText(`正解！ ${answerRecord.score}点`);
            delayMs = FEEDBACK_DELAY_MS.correct;
        } else {
            setFeedbackClassName('feedback-wrong');
            setFeedbackText(`不正解。正解: ${currentQuestion.correctText}`);
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
        inputValue,
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

                if (elapsed >= limitMs) {
                    window.clearInterval(intervalId);
                    handleSettleCurrentQuestion('timeout');
                }
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

    function switchToKeyboardMode (): void {
        if ((phase !== 'active') || (paused === true)) {
            return;
        }

        setActiveInputMode('keyboard');

        window.setTimeout(() => {
            answerInputRef.current?.focus();
            answerInputRef.current?.select();
        }, 0);
    }

    function switchToTileMode (): void {
        setActiveInputMode('tile');
        answerInputRef.current?.blur();
    }

    function appendInputValue (text: string): void {
        if ((phase !== 'active') || (paused === true)) {
            return;
        }

        switchToTileMode();

        setInputValue((prev) => {
            return (prev + text);
        });
    }

    function backspaceInputValue (): void {
        if ((phase !== 'active') || (paused === true)) {
            return;
        }

        switchToTileMode();

        setInputValue((prev) => {
            return prev.slice(0, -1);
        });
    }

    function clearInputValue (): void {
        if ((phase !== 'active') || (paused === true)) {
            return;
        }

        switchToTileMode();
        setInputValue('');
    }

    function handleTileSubmit (): void {
        if ((phase !== 'active') || (paused === true)) {
            return;
        }

        handleSettleCurrentQuestion('submit');
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
                                <strong>経過時間:</strong> {Math.ceil(elapsedMs / 100) / 10} 秒
                            </div>

                            {remainingMs != null && (
                                <div className="timer-badge">
                                    残り: {Math.ceil(remainingMs / 100) / 10} 秒
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
                            <label>
                                回答入力
                                <input
                                    ref={answerInputRef}
                                    className="input-control"
                                    type="text"
                                    value={inputValue}
                                    disabled={(phase !== 'active') || (paused === true)}
                                    placeholder="ここに答えを入力"
                                    inputMode={
                                        currentQuestion.answerKind === 'quotientRemainder'
                                            ? 'text'
                                            : (
                                                currentQuestion.course === 'div' &&
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
                                        currentQuestion.answerKind === 'quotientRemainder'
                                            ? '[0-9\\- ]*'
                                            : '[0-9\\-\\.]*'
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
                                    disabled={(phase !== 'active') || (paused === true)}
                                >
                                    回答する
                                </button>
                            </div>
                        </form>
                    </section>

                    <section className="card">
                        <h2>数字タイル入力</h2>

                        <div className="keypad-grid">
                            <button type="button" className="keypad-button" disabled={(phase !== 'active') || paused} onClick={() => { appendInputValue('7'); }}>7</button>
                            <button type="button" className="keypad-button" disabled={(phase !== 'active') || paused} onClick={() => { appendInputValue('8'); }}>8</button>
                            <button type="button" className="keypad-button" disabled={(phase !== 'active') || paused} onClick={() => { appendInputValue('9'); }}>9</button>
                            <button type="button" className="keypad-button keypad-button-sub" disabled={(phase !== 'active') || paused} onClick={() => { backspaceInputValue(); }}>←</button>

                            <button type="button" className="keypad-button" disabled={(phase !== 'active') || paused} onClick={() => { appendInputValue('4'); }}>4</button>
                            <button type="button" className="keypad-button" disabled={(phase !== 'active') || paused} onClick={() => { appendInputValue('5'); }}>5</button>
                            <button type="button" className="keypad-button" disabled={(phase !== 'active') || paused} onClick={() => { appendInputValue('6'); }}>6</button>
                            <button type="button" className="keypad-button keypad-button-sub" disabled={(phase !== 'active') || paused} onClick={() => { clearInputValue(); }}>C</button>

                            <button type="button" className="keypad-button" disabled={(phase !== 'active') || paused} onClick={() => { appendInputValue('1'); }}>1</button>
                            <button type="button" className="keypad-button" disabled={(phase !== 'active') || paused} onClick={() => { appendInputValue('2'); }}>2</button>
                            <button type="button" className="keypad-button" disabled={(phase !== 'active') || paused} onClick={() => { appendInputValue('3'); }}>3</button>
                            <button type="button" className="keypad-button keypad-button-sub" disabled={(phase !== 'active') || paused || (minusKeyEnabled === false)} onClick={() => { appendInputValue('-'); }}>-</button>

                            <button type="button" className="keypad-button keypad-button-wide" disabled={(phase !== 'active') || paused} onClick={() => { appendInputValue('0'); }}>0</button>
                            <button type="button" className="keypad-button keypad-button-sub" disabled={(phase !== 'active') || paused || (decimalKeyEnabled === false)} onClick={() => { appendInputValue('.'); }}>.</button>
                            <button type="button" className="keypad-button keypad-button-sub" disabled={(phase !== 'active') || paused || (spaceKeyEnabled === false)} onClick={() => { appendInputValue(' '); }}>空白</button>
                            <button type="button" className="keypad-button keypad-button-primary" disabled={(phase !== 'active') || paused} onClick={() => { handleTileSubmit(); }}>回答</button>
                        </div>

                        <p className="sub-text">
                            数字タイルを押すと、スマホではキーボードを閉じる挙動になります。
                        </p>
                    </section>

                    {currentQuiz.settingsSnapshot.handwritingMemoEnabled === true && (
                        <section className="card">
                            <h2>メモ欄（ダミー）</h2>
                            <div className="memo-dummy">
                                将来的にここへ手書きメモを実装
                            </div>
                        </section>
                    )}

                    {feedbackText.length > 0 && (
                        <section className={`card feedback-box ${feedbackClassName}`}>
                            <strong>{feedbackText}</strong>
                        </section>
                    )}

                    {paused === true && (
                        <section className="card paused-box">
                            <strong>一時停止中</strong>
                            <p className="sub-text">「再開」を押すと続きから再開します。</p>
                        </section>
                    )}
                </>
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