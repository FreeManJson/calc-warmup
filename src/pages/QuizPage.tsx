import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FEEDBACK_DELAY_MS } from '../constants/appConstants';
import { QuestionStackBoard } from '../components/QuestionStackBoard';
import { TileAnswerPanel } from '../components/TileAnswerPanel';
import { useAppContext } from '../context/AppContext';
import type { AnswerResult } from '../types/appTypes';
import {
    compareAnswer,
    getCourseLabel,
} from '../utils/quizUtils';
import {
    buildQuizResult,
    evaluateQuestionScore,
} from '../utils/scoreUtils';
import {
    buildTileUserInput,
    validateTileAnswer,
    type FeedbackKindType,
    type TileTargetType,
} from '../utils/answerInputUtils';

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
    const [pendingFeedbackAnswers, setPendingFeedbackAnswers] = useState<AnswerResult[] | null>(null);

    const questionSectionRef = useRef<HTMLElement | null>(null);

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

    const stackExpressions = useMemo(() => {
        if (currentQuiz == null) {
            return [];
        }

        return currentQuiz.questions.slice(currentIndex, (currentIndex + 3)).map((question) => {
            return question.expression;
        });
    }, [currentQuiz, currentIndex]);

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
        setPendingFeedbackAnswers(null);
        setRemainingMsDisplay(
            currentQuiz.settingsSnapshot.timeLimitEnabled === true
                ? (currentQuiz.settingsSnapshot.timeLimitSec * 1000)
                : null
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
        setPendingFeedbackAnswers(null);
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
            const validation = validateTileAnswer(
                currentQuestion.answerKind,
                answerValue,
                quotientValue
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

        const userInput = buildTileUserInput(
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
        setValidationMessage('');
        clearCurrentInputStates();

        if (isCorrect === true) {
            setFeedbackClassName('');
            setFeedbackText('');
            setFeedbackKind(null);
            setFeedbackSymbol('');
            setFeedbackEquationLeft('');
            setFeedbackEquationAnswer('');
            setFeedbackSubText('');
            setPendingFeedbackAnswers(null);
            goToNextQuestionOrFinish(nextAnswers);
            return;
        }

        setPhase('feedback');
        setPendingFeedbackAnswers(nextAnswers);

        if (mode === 'timeout') {
            setFeedbackClassName('feedback-timeout');
            setFeedbackText('時間切れ');
            setFeedbackKind('timeout');
            setFeedbackSymbol('!');
            setFeedbackEquationLeft(feedbackEquation.leftText);
            setFeedbackEquationAnswer(feedbackEquation.answerText);
            setFeedbackSubText('時間内に解答できませんでした');
        } else {
            setFeedbackClassName('feedback-wrong');
            setFeedbackText('不正解');
            setFeedbackKind('wrong');
            setFeedbackSymbol('×');
            setFeedbackEquationLeft(feedbackEquation.leftText);
            setFeedbackEquationAnswer(feedbackEquation.answerText);
            setFeedbackSubText(`あなたの回答: ${answerRecord.userAnswer}`);
        }
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
        setTileTarget((currentQuestion?.answerKind === 'quotientRemainder') ? 'quotient' : 'answer');
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

        clearQuiz();
        navigate('/');
    }

    function appendTileValue (text: string): void {
        if ((phase !== 'active') || (paused === true)) {
            return;
        }

        setValidationMessage('');

        if (currentQuestion?.answerKind === 'quotientRemainder') {
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

        setValidationMessage('');

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

    function clearInputValue (): void {
        if ((phase !== 'active') || (paused === true)) {
            return;
        }

        clearCurrentInputStates();
        setValidationMessage('');
    }

    function appendMinus (): void {
        if ((phase !== 'active') || (paused === true)) {
            return;
        }

        setValidationMessage('');

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
        if ((phase !== 'active') || (paused === true) || (currentQuestion?.answerKind !== 'number')) {
            return;
        }

        setValidationMessage('');

        if (answerValue.includes('.') === false) {
            setAnswerValue((prev) => {
                return `${prev}.`;
            });
        }
    }


    const handleDismissFeedback = useCallback((): void => {
        if (pendingFeedbackAnswers == null) {
            return;
        }

        goToNextQuestionOrFinish(pendingFeedbackAnswers);
    }, [pendingFeedbackAnswers, goToNextQuestionOrFinish]);

    useEffect(() => {
        if ((phase !== 'feedback') || (feedbackKind == null)) {
            return;
        }

        const delayMs = (feedbackKind === 'timeout')
            ? FEEDBACK_DELAY_MS.timeout
            : FEEDBACK_DELAY_MS.wrong;

        const timerId = window.setTimeout(() => {
            handleDismissFeedback();
        }, delayMs);

        return () => {
            window.clearTimeout(timerId);
        };
    }, [phase, feedbackKind, handleDismissFeedback]);

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
                    <h1>学習モード</h1>
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
                <section className="card drill-play-card study-play-card" ref={questionSectionRef}>
                    <div className="drill-status-bar bottom-gap">
                        <div className="drill-status-chip">
                            <span className="drill-status-label">経過</span>
                            <strong>{formatSecondsFromMs(elapsedMs)} 秒</strong>
                        </div>

                        <div className="drill-status-chip">
                            <span className="drill-status-label">進行</span>
                            <strong>{questionNo} / {totalQuestions}問</strong>
                        </div>

                        {remainingMsDisplay != null && (
                            <div className="drill-status-chip drill-status-chip-time">
                                <span className="drill-status-label">残り</span>
                                <strong>{formatSecondsFromMs(remainingMsDisplay)} 秒</strong>
                            </div>
                        )}
                    </div>

                    <QuestionStackBoard
                        variant="study"
                        expressions={stackExpressions}
                        animationKind={feedbackKind}
                    />

                    <p className="sub-text top-gap">左端がいま解く問題です。{currentQuestion.inputHint != null ? ` ${currentQuestion.inputHint}` : ''}</p>

                    <div className="top-gap">
                        <TileAnswerPanel
                            answerKind={currentQuestion.answerKind}
                            answerValue={answerValue}
                            quotientValue={quotientValue}
                            remainderValue={remainderValue}
                            activeTarget={tileTarget}
                            disabled={(phase !== 'active') || (paused === true)}
                            allowMinus={minusKeyEnabled}
                            allowDecimal={decimalKeyEnabled}
                            submitLabel="解答"
                            validationMessage={validationMessage}
                            onSetTarget={setTileTarget}
                            onAppendTileValue={appendTileValue}
                            onBackspace={backspaceInputValue}
                            onClear={clearInputValue}
                            onAppendMinus={appendMinus}
                            onAppendDecimal={appendDecimal}
                            onSubmit={() => {
                                handleSettleCurrentQuestion('submit');
                            }}
                        />
                    </div>

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
