import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FEEDBACK_DISPLAY_MS } from '../constants/appConstants';
import { useAppContext } from '../context/AppContext';
import type { AnswerResult } from '../types/appTypes';
import {
    buildQuizResult,
    calculateQuestionScore,
    compareAnswer,
    getCourseLabel,
} from '../utils/quizUtils';

type PhaseType = 'countdown' | 'active' | 'feedback';

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

    const nextTimeoutRef = useRef<number | null>(null);

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
            score: calculateQuestionScore(
                currentQuestion,
                isCorrect,
                effectiveElapsedMs,
                currentQuiz.settingsSnapshot
            ),
        };

        const nextAnswers = [...answers, answerRecord];

        setAnswers(nextAnswers);
        setPhase('feedback');
        setInputValue('');

        if (mode === 'timeout') {
            setFeedbackClassName('feedback-timeout');
            setFeedbackText(`時間切れ！ 正解: ${currentQuestion.correctText}`);
        } else if (isCorrect === true) {
            setFeedbackClassName('feedback-correct');
            setFeedbackText(`正解！ ${answerRecord.score}点`);
        } else {
            setFeedbackClassName('feedback-wrong');
            setFeedbackText(`不正解。正解: ${currentQuestion.correctText}`);
        }

        if (nextTimeoutRef.current != null) {
            window.clearTimeout(nextTimeoutRef.current);
        }

        nextTimeoutRef.current = window.setTimeout(() => {
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
                    nextAnswers
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
        }, FEEDBACK_DISPLAY_MS);
    }, [
        currentQuiz,
        currentQuestion,
        phase,
        questionStartedAt,
        pausedMs,
        inputValue,
        answers,
        currentIndex,
        users,
        finishQuiz,
        navigate,
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

        clearQuiz();
        navigate('/');
    }

    function handleSubmit (event: React.FormEvent<HTMLFormElement>): void {
        event.preventDefault();
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
    const paused = (pausedAt != null);

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

                        <h2>問題</h2>
                        <div className="question-box">{currentQuestion.expression}</div>

                        {currentQuestion.inputHint != null && (
                            <p className="sub-text">{currentQuestion.inputHint}</p>
                        )}

                        <form onSubmit={handleSubmit}>
                            <label>
                                回答入力
                                <input
                                    className="input-control"
                                    type="text"
                                    value={inputValue}
                                    disabled={(phase !== 'active') || (paused === true)}
                                    placeholder="ここに答えを入力"
                                    onChange={(event) => {
                                        setInputValue(event.target.value);
                                    }}
                                />
                            </label>

                            <div className="button-row top-gap">
                                <button
                                    type="submit"
                                    disabled={(phase !== 'active') || (paused === true)}
                                >
                                    回答する
                                </button>
                            </div>
                        </form>
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