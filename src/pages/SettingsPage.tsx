import { useNavigate } from 'react-router-dom';
import { MAX_TERMS } from '../constants/appConstants';
import { useAppContext } from '../context/AppContext';

export function SettingsPage () {
    const navigate = useNavigate();
    const { quizSettings, setQuizSettings, startQuiz } = useAppContext();

    function handleStartWithCurrentSettings (): void {
        const started = startQuiz();

        if (started === false) {
            window.alert('コースを1つ以上選択してください。');
            return;
        }

        navigate('/quiz');
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
                            type="number"
                            min={2}
                            max={MAX_TERMS}
                            value={quizSettings.maxTerms}
                            onChange={(event) => {
                                const nextValue = Number(event.target.value);

                                setQuizSettings((prev) => {
                                    return {
                                        ...prev,
                                        maxTerms: Math.max(2, Math.min(MAX_TERMS, nextValue)),
                                    };
                                });
                            }}
                        />
                    </label>

                    <label>
                        1項目目 最大桁数
                        <input
                            className="input-control"
                            type="number"
                            min={1}
                            max={9}
                            value={quizSettings.firstTermMaxDigits}
                            onChange={(event) => {
                                const nextValue = Number(event.target.value);

                                setQuizSettings((prev) => {
                                    return {
                                        ...prev,
                                        firstTermMaxDigits: Math.max(1, Math.min(9, nextValue)),
                                    };
                                });
                            }}
                        />
                    </label>

                    <label>
                        2項目目 最大桁数
                        <input
                            className="input-control"
                            type="number"
                            min={1}
                            max={9}
                            value={quizSettings.secondTermMaxDigits}
                            onChange={(event) => {
                                const nextValue = Number(event.target.value);

                                setQuizSettings((prev) => {
                                    return {
                                        ...prev,
                                        secondTermMaxDigits: Math.max(1, Math.min(9, nextValue)),
                                    };
                                });
                            }}
                        />
                    </label>

                    <label>
                        出題数
                        <input
                            className="input-control"
                            type="number"
                            min={1}
                            max={100}
                            value={quizSettings.questionCount}
                            onChange={(event) => {
                                const nextValue = Number(event.target.value);

                                setQuizSettings((prev) => {
                                    return {
                                        ...prev,
                                        questionCount: Math.max(1, Math.min(100, nextValue)),
                                    };
                                });
                            }}
                        />
                    </label>
                </div>
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
                        type="number"
                        min={1}
                        max={300}
                        disabled={quizSettings.timeLimitEnabled === false}
                        value={quizSettings.timeLimitSec}
                        onChange={(event) => {
                            const nextValue = Number(event.target.value);

                            setQuizSettings((prev) => {
                                return {
                                    ...prev,
                                    timeLimitSec: Math.max(1, Math.min(300, nextValue)),
                                };
                            });
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
                            setQuizSettings((prev) => {
                                return {
                                    ...prev,
                                    presetName: '小学生4年生レベル',
                                    maxTerms: 2,
                                    firstTermMaxDigits: 3,
                                    secondTermMaxDigits: 3,
                                    questionCount: 10,
                                    timeLimitEnabled: false,
                                    timeLimitSec: 10,
                                    allowNegative: false,
                                    allowDecimal: false,
                                    allowRemainder: false,
                                    allowRealDivision: false,
                                };
                            });
                        }}
                    >
                        小4
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setQuizSettings((prev) => {
                                return {
                                    ...prev,
                                    presetName: '中学生1年生レベル',
                                    maxTerms: 3,
                                    firstTermMaxDigits: 3,
                                    secondTermMaxDigits: 3,
                                    questionCount: 12,
                                    timeLimitEnabled: true,
                                    timeLimitSec: 12,
                                    allowNegative: true,
                                    allowDecimal: false,
                                    allowRemainder: false,
                                    allowRealDivision: false,
                                };
                            });
                        }}
                    >
                        中1
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setQuizSettings((prev) => {
                                return {
                                    ...prev,
                                    presetName: '高校基礎',
                                    maxTerms: 4,
                                    firstTermMaxDigits: 4,
                                    secondTermMaxDigits: 4,
                                    questionCount: 15,
                                    timeLimitEnabled: true,
                                    timeLimitSec: 10,
                                    allowNegative: true,
                                    allowDecimal: true,
                                    allowRemainder: false,
                                    allowRealDivision: false,
                                };
                            });
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