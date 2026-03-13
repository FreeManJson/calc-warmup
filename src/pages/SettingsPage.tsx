import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MAX_TERMS } from '../constants/appConstants';
import { createFilledTermDigits } from '../constants/defaultSettings';
import { useAppContext } from '../context/AppContext';

export function SettingsPage () {
    const navigate = useNavigate();
    const { quizSettings, setQuizSettings, startQuiz } = useAppContext();

    const [maxTermsInput, setMaxTermsInput] = useState<string>(String(quizSettings.maxTerms));
    const [questionCountInput, setQuestionCountInput] = useState<string>(String(quizSettings.questionCount));
    const [timeLimitSecInput, setTimeLimitSecInput] = useState<string>(String(quizSettings.timeLimitSec));
    const [termDigitInputs, setTermDigitInputs] = useState<string[]>(
        quizSettings.termMaxDigits.map((value) => {
            return String(value);
        })
    );

    useEffect(() => {
        setMaxTermsInput(String(quizSettings.maxTerms));
        setQuestionCountInput(String(quizSettings.questionCount));
        setTimeLimitSecInput(String(quizSettings.timeLimitSec));
        setTermDigitInputs(quizSettings.termMaxDigits.map((value) => {
            return String(value);
        }));
    }, [quizSettings]);

    function handleStartWithCurrentSettings (): void {
        commitAllInputs();

        const started = startQuiz();

        if (started === false) {
            window.alert('コースを1つ以上選択してください。');
            return;
        }

        navigate('/quiz');
    }

    function commitAllInputs (): void {
        commitMaxTerms();
        commitQuestionCount();
        commitTimeLimitSec();

        for (let lpIndex = 0; lpIndex < MAX_TERMS; lpIndex += 1) {
            commitTermDigit(lpIndex);
        }
    }

    function commitMaxTerms (): void {
        const parsed = Number(maxTermsInput);
        const nextValue = (
            Number.isFinite(parsed) === true
                ? parsed
                : quizSettings.maxTerms
        );
        const clamped = Math.max(2, Math.min(MAX_TERMS, nextValue));

        setQuizSettings((prev) => {
            return {
                ...prev,
                maxTerms: clamped,
            };
        });

        setMaxTermsInput(String(clamped));
    }

    function commitQuestionCount (): void {
        const parsed = Number(questionCountInput);
        const nextValue = (
            Number.isFinite(parsed) === true
                ? parsed
                : quizSettings.questionCount
        );
        const clamped = Math.max(1, Math.min(100, nextValue));

        setQuizSettings((prev) => {
            return {
                ...prev,
                questionCount: clamped,
            };
        });

        setQuestionCountInput(String(clamped));
    }

    function commitTimeLimitSec (): void {
        const parsed = Number(timeLimitSecInput);
        const nextValue = (
            Number.isFinite(parsed) === true
                ? parsed
                : quizSettings.timeLimitSec
        );
        const clamped = Math.max(1, Math.min(300, nextValue));

        setQuizSettings((prev) => {
            return {
                ...prev,
                timeLimitSec: clamped,
            };
        });

        setTimeLimitSecInput(String(clamped));
    }

    function commitTermDigit (index: number): void {
        const raw = termDigitInputs[index] ?? '';
        const parsed = Number(raw);
        const currentValue = (quizSettings.termMaxDigits[index] ?? 2);
        const nextValue = (
            Number.isFinite(parsed) === true
                ? parsed
                : currentValue
        );
        const clamped = Math.max(1, Math.min(9, nextValue));

        setQuizSettings((prev) => {
            const nextDigits = [...prev.termMaxDigits];
            nextDigits[index] = clamped;

            return {
                ...prev,
                termMaxDigits: nextDigits,
            };
        });

        setTermDigitInputs((prevInputs) => {
            const nextInputs = [...prevInputs];
            nextInputs[index] = String(clamped);
            return nextInputs;
        });
    }

    function isDigitsOnly (value: string): boolean {
        return (/^\d*$/.test(value) === true);
    }

    function applyPreset (
        presetName: string,
        maxTerms: number,
        questionCount: number,
        timeLimitEnabled: boolean,
        timeLimitSec: number,
        allowNegative: boolean,
        allowDecimal: boolean,
        allowRemainder: boolean,
        allowRealDivision: boolean,
        presetDigits: number[]
    ): void {
        const normalizedDigits = createFilledTermDigits(2).map((_, index) => {
            return presetDigits[index] ?? 2;
        });

        setQuizSettings((prev) => {
            return {
                ...prev,
                presetName,
                maxTerms,
                termMaxDigits: normalizedDigits,
                questionCount,
                timeLimitEnabled,
                timeLimitSec,
                allowNegative,
                allowDecimal,
                allowRemainder,
                allowRealDivision,
            };
        });
    }

    return (
        <div className="page-container">
            <h1>オプション設定</h1>

            <section className="card">
                <h2>基本設定</h2>

                <div className="form-grid">
                    <label>
                        最大項目数
                        <input
                            className="input-control"
                            type="text"
                            inputMode="numeric"
                            value={maxTermsInput}
                            onChange={(event) => {
                                const raw = event.target.value;

                                if (isDigitsOnly(raw) === false) {
                                    return;
                                }

                                setMaxTermsInput(raw);
                            }}
                            onBlur={() => {
                                commitMaxTerms();
                            }}
                        />
                    </label>

                    <label>
                        出題数
                        <input
                            className="input-control"
                            type="text"
                            inputMode="numeric"
                            value={questionCountInput}
                            onChange={(event) => {
                                const raw = event.target.value;

                                if (isDigitsOnly(raw) === false) {
                                    return;
                                }

                                setQuestionCountInput(raw);
                            }}
                            onBlur={() => {
                                commitQuestionCount();
                            }}
                        />
                    </label>
                </div>
            </section>

            <section className="card">
                <h2>n項目目の最大桁数</h2>

                <div className="form-grid">
                    {Array.from({ length: quizSettings.maxTerms }).map((_, index) => {
                        return (
                            <label key={index}>
                                {index + 1}項目目 最大桁数
                                <input
                                    className="input-control"
                                    type="text"
                                    inputMode="numeric"
                                    value={termDigitInputs[index] ?? ''}
                                    onChange={(event) => {
                                        const raw = event.target.value;

                                        if (isDigitsOnly(raw) === false) {
                                            return;
                                        }

                                        setTermDigitInputs((prevInputs) => {
                                            const nextInputs = [...prevInputs];
                                            nextInputs[index] = raw;
                                            return nextInputs;
                                        });
                                    }}
                                    onBlur={() => {
                                        commitTermDigit(index);
                                    }}
                                />
                            </label>
                        );
                    })}
                </div>

                <p className="sub-text">
                    最大項目数を増やすと、入力欄も連動して増えます。
                </p>
            </section>

            <section className="card">
                <h2>時間設定</h2>

                <label className="single-check">
                    <input
                        type="checkbox"
                        checked={quizSettings.timeLimitEnabled}
                        onChange={(event) => {
                            setQuizSettings((prev) => {
                                return {
                                    ...prev,
                                    timeLimitEnabled: event.target.checked,
                                };
                            });
                        }}
                    />
                    時間制限あり
                </label>

                <label>
                    時間制限（秒）
                    <input
                        className="input-control"
                        type="text"
                        inputMode="numeric"
                        disabled={quizSettings.timeLimitEnabled === false}
                        value={timeLimitSecInput}
                        onChange={(event) => {
                            const raw = event.target.value;

                            if (isDigitsOnly(raw) === false) {
                                return;
                            }

                            setTimeLimitSecInput(raw);
                        }}
                        onBlur={() => {
                            commitTimeLimitSec();
                        }}
                    />
                </label>
            </section>

            <section className="card">
                <h2>追加オプション</h2>

                <div className="check-group">
                    <label>
                        <input
                            type="checkbox"
                            checked={quizSettings.allowNegative}
                            onChange={(event) => {
                                setQuizSettings((prev) => {
                                    return {
                                        ...prev,
                                        allowNegative: event.target.checked,
                                    };
                                });
                            }}
                        />
                        マイナス計算を許可
                    </label>

                    <label>
                        <input
                            type="checkbox"
                            checked={quizSettings.allowDecimal}
                            onChange={(event) => {
                                setQuizSettings((prev) => {
                                    return {
                                        ...prev,
                                        allowDecimal: event.target.checked,
                                    };
                                });
                            }}
                        />
                        小数を許可
                    </label>

                    <label>
                        <input
                            type="checkbox"
                            checked={quizSettings.allowRemainder}
                            onChange={(event) => {
                                setQuizSettings((prev) => {
                                    return {
                                        ...prev,
                                        allowRemainder: event.target.checked,
                                        allowRealDivision: (
                                            event.target.checked === true
                                                ? false
                                                : prev.allowRealDivision
                                        ),
                                    };
                                });
                            }}
                        />
                        割り算の余りを許可
                    </label>

                    <label>
                        <input
                            type="checkbox"
                            checked={quizSettings.allowRealDivision}
                            onChange={(event) => {
                                setQuizSettings((prev) => {
                                    return {
                                        ...prev,
                                        allowRealDivision: event.target.checked,
                                        allowRemainder: (
                                            event.target.checked === true
                                                ? false
                                                : prev.allowRemainder
                                        ),
                                    };
                                });
                            }}
                        />
                        実数の割り算を許可
                    </label>

                    <label>
                        <input
                            type="checkbox"
                            checked={quizSettings.handwritingMemoEnabled}
                            onChange={(event) => {
                                setQuizSettings((prev) => {
                                    return {
                                        ...prev,
                                        handwritingMemoEnabled: event.target.checked,
                                    };
                                });
                            }}
                        />
                        手書きメモ欄を有効化（今はダミー表示）
                    </label>
                </div>
            </section>

            <section className="card">
                <h2>プリセット</h2>

                <div className="button-row">
                    <button
                        type="button"
                        onClick={() => {
                            applyPreset(
                                '小学生4年生レベル',
                                2,
                                10,
                                false,
                                10,
                                false,
                                false,
                                false,
                                false,
                                [3, 3]
                            );
                        }}
                    >
                        小4
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            applyPreset(
                                '中学生1年生レベル',
                                3,
                                12,
                                true,
                                12,
                                true,
                                false,
                                false,
                                false,
                                [3, 3, 2]
                            );
                        }}
                    >
                        中1
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            applyPreset(
                                '高校基礎',
                                4,
                                15,
                                true,
                                10,
                                true,
                                true,
                                false,
                                false,
                                [4, 4, 3, 2]
                            );
                        }}
                    >
                        高校基礎
                    </button>
                </div>

                <p className="sub-text">
                    現在のプリセット: {quizSettings.presetName}
                </p>
            </section>

            <section className="card">
                <div className="button-row">
                    <button
                        type="button"
                        onClick={() => {
                            commitAllInputs();
                            navigate('/');
                        }}
                    >
                        TOPへ戻る
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            handleStartWithCurrentSettings();
                        }}
                    >
                        この設定で開始
                    </button>
                </div>
            </section>
        </div>
    );
}