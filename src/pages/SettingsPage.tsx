import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MAX_TERMS } from '../constants/appConstants';
import { useAppContext } from '../context/AppContext';
import type { InputMethodType, QuizSettings } from '../types/appTypes';

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
        const nextSettings = commitAllInputs();
        const started = startQuiz(nextSettings);

        if (started === false) {
            window.alert('コースを1つ以上選択してください。');
            return;
        }

        navigate('/quiz');
    }

    function commitAllInputs (): QuizSettings {
        const nextSettings = buildCommittedSettings(quizSettings);

        setQuizSettings(nextSettings);
        syncLocalInputs(nextSettings);

        return nextSettings;
    }

    function buildCommittedSettings (base: QuizSettings): QuizSettings {
        const nextMaxTerms = clampNumber(
            maxTermsInput,
            2,
            MAX_TERMS,
            base.maxTerms
        );

        const nextQuestionCount = clampNumber(
            questionCountInput,
            1,
            100,
            base.questionCount
        );

        const nextTimeLimitSec = clampNumber(
            timeLimitSecInput,
            1,
            300,
            base.timeLimitSec
        );

        const nextTermDigits = Array.from({ length: base.termMaxDigits.length }, (_, index) => {
            return clampNumber(
                termDigitInputs[index] ?? '',
                1,
                9,
                base.termMaxDigits[index] ?? 2
            );
        });

        return {
            ...base,
            maxTerms: nextMaxTerms,
            questionCount: nextQuestionCount,
            timeLimitSec: nextTimeLimitSec,
            termMaxDigits: nextTermDigits,
        };
    }

    function syncLocalInputs (nextSettings: QuizSettings): void {
        setMaxTermsInput(String(nextSettings.maxTerms));
        setQuestionCountInput(String(nextSettings.questionCount));
        setTimeLimitSecInput(String(nextSettings.timeLimitSec));
        setTermDigitInputs(nextSettings.termMaxDigits.map((value) => {
            return String(value);
        }));
    }

    function isDigitsOnly (value: string): boolean {
        return (/^\d*$/.test(value) === true);
    }

    function updateInputMethod (inputMethod: InputMethodType): void {
        setQuizSettings((prev) => {
            return {
                ...prev,
                inputMethod,
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
                                commitAllInputs();
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
                                commitAllInputs();
                            }}
                        />
                    </label>
                </div>
            </section>

            <section className="card">
                <h2>n項目めの最大桁数</h2>

                <div className="form-grid">
                    {Array.from({ length: quizSettings.maxTerms }).map((_, index) => {
                        return (
                            <label key={index}>
                                {index + 1}項目め 最大桁数
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
                                        commitAllInputs();
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

                <div className="time-limit-row">
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
                        時間制限
                    </label>

                    <div className="time-limit-input-group">
                        <input
                            className="input-control compact-input"
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
                                commitAllInputs();
                            }}
                        />
                        <span className="unit-label">秒</span>
                    </div>
                </div>
            </section>

            <section className="card">
                <h2>入力方式</h2>

                <div className="segmented-row">
                    <button
                        type="button"
                        className={`segmented-button ${quizSettings.inputMethod === 'auto' ? 'is-selected' : ''}`}
                        onClick={() => {
                            updateInputMethod('auto');
                        }}
                    >
                        自動
                    </button>

                    <button
                        type="button"
                        className={`segmented-button ${quizSettings.inputMethod === 'keyboard' ? 'is-selected' : ''}`}
                        onClick={() => {
                            updateInputMethod('keyboard');
                        }}
                    >
                        キーボード優先
                    </button>

                    <button
                        type="button"
                        className={`segmented-button ${quizSettings.inputMethod === 'tile' ? 'is-selected' : ''}`}
                        onClick={() => {
                            updateInputMethod('tile');
                        }}
                    >
                        数字タイル優先
                    </button>
                </div>

                <p className="sub-text">
                    自動: PC はキーボード寄り、スマホは数字タイル寄りで開始します。
                </p>
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
                </div>
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

function clampNumber (
    raw: string,
    minValue: number,
    maxValue: number,
    fallback: number
): number {
    const parsed = Number(raw);
    const nextValue = (
        Number.isFinite(parsed) === true
            ? parsed
            : fallback
    );

    return Math.max(minValue, Math.min(maxValue, nextValue));
}