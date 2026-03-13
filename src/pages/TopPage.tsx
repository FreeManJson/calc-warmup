import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import type { CourseType, InputMethodType } from '../types/appTypes';
import { getCourseLabelText } from '../utils/quizUtils';

export function TopPage () {
    const navigate = useNavigate();
    const {
        users,
        selectedUserId,
        setSelectedUserId,
        quizSettings,
        setQuizSettings,
        startQuiz,
        addUser,
        deleteUser,
    } = useAppContext();

    function toggleCourse (course: CourseType): void {
        setQuizSettings((prev) => {
            const exists = prev.selectedCourses.includes(course);

            if ((exists === true) && (prev.selectedCourses.length === 1)) {
                return prev;
            }

            if (exists === true) {
                return {
                    ...prev,
                    selectedCourses: prev.selectedCourses.filter((item) => {
                        return (item !== course);
                    }),
                };
            }

            return {
                ...prev,
                selectedCourses: [...prev.selectedCourses, course],
            };
        });
    }

    function handleStart (): void {
        const started = startQuiz();

        if (started === false) {
            window.alert('コースを1つ以上選択してください。');
            return;
        }

        navigate('/quiz');
    }

    function handleAddUser (): void {
        const inputName = window.prompt('追加するユーザー名を入力してください。');

        if (inputName == null) {
            return;
        }

        const result = addUser(inputName);

        if (result.ok === false) {
            window.alert(result.message ?? 'ユーザー追加に失敗しました。');
        }
    }

    function handleDeleteUser (): void {
        const currentUser = users.find((user) => {
            return (user.id === selectedUserId);
        });

        if (currentUser == null) {
            return;
        }

        const confirmed = window.confirm(
            `ユーザー「${currentUser.name}」を削除します。よろしいですか？`
        );

        if (confirmed === false) {
            return;
        }

        const result = deleteUser(currentUser.id);

        if (result.ok === false) {
            window.alert(result.message ?? 'ユーザー削除に失敗しました。');
        }
    }

    const visibleTermDigits = quizSettings.termMaxDigits.slice(0, quizSettings.maxTerms);

    return (
        <div className="page-container">
            <h1>計算ウォーミングアップ</h1>

            <section className="card">
                <h2>ユーザー選択</h2>

                <select
                    className="input-control"
                    value={selectedUserId}
                    onChange={(event) => {
                        setSelectedUserId(event.target.value);
                    }}
                >
                    {users.map((user) => {
                        return (
                            <option key={user.id} value={user.id}>
                                {user.name}
                            </option>
                        );
                    })}
                </select>

                <div className="button-row top-gap">
                    <button
                        type="button"
                        onClick={() => {
                            handleAddUser();
                        }}
                    >
                        ユーザー追加
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            handleDeleteUser();
                        }}
                        disabled={users.length <= 1}
                    >
                        選択中ユーザー削除
                    </button>
                </div>

                <p className="sub-text">
                    ユーザーごとに前回設定を保持します。
                </p>
            </section>

            <section className="card">
                <h2>コース選択</h2>

                <div className="check-group">
                    <label>
                        <input
                            type="checkbox"
                            checked={quizSettings.selectedCourses.includes('add')}
                            disabled={
                                (quizSettings.selectedCourses.length === 1) &&
                                (quizSettings.selectedCourses.includes('add'))
                            }
                            onChange={() => {
                                toggleCourse('add');
                            }}
                        />
                        足し算
                    </label>

                    <label>
                        <input
                            type="checkbox"
                            checked={quizSettings.selectedCourses.includes('sub')}
                            disabled={
                                (quizSettings.selectedCourses.length === 1) &&
                                (quizSettings.selectedCourses.includes('sub'))
                            }
                            onChange={() => {
                                toggleCourse('sub');
                            }}
                        />
                        引き算
                    </label>

                    <label>
                        <input
                            type="checkbox"
                            checked={quizSettings.selectedCourses.includes('mul')}
                            disabled={
                                (quizSettings.selectedCourses.length === 1) &&
                                (quizSettings.selectedCourses.includes('mul'))
                            }
                            onChange={() => {
                                toggleCourse('mul');
                            }}
                        />
                        掛け算
                    </label>

                    <label>
                        <input
                            type="checkbox"
                            checked={quizSettings.selectedCourses.includes('div')}
                            disabled={
                                (quizSettings.selectedCourses.length === 1) &&
                                (quizSettings.selectedCourses.includes('div'))
                            }
                            onChange={() => {
                                toggleCourse('div');
                            }}
                        />
                        割り算
                    </label>
                </div>

                <p className="sub-text">
                    コースは最低1つ選択された状態を保持します。
                </p>
            </section>

            <section className="card">
                <h2>現在の設定</h2>

                <ul className="simple-list">
                    <li>コース: {getCourseLabelText(quizSettings.selectedCourses)}</li>
                    <li>最大項目数: {quizSettings.maxTerms}</li>
                    <li>
                        各項目の最大桁数:
                        {' '}
                        {visibleTermDigits.map((digits, index) => {
                            return `${index + 1}項目目 ${digits}桁`;
                        }).join(' / ')}
                    </li>
                    <li>出題数: {quizSettings.questionCount}問</li>
                    <li>
                        時間制限:
                        {quizSettings.timeLimitEnabled === true
                            ? ` あり（${quizSettings.timeLimitSec}秒）`
                            : ' なし'}
                    </li>
                    <li>入力方式: {getInputMethodLabel(quizSettings.inputMethod)}</li>
                    <li>プリセット: {quizSettings.presetName}</li>
                </ul>
            </section>

            <section className="card">
                <h2>メニュー</h2>

                <div className="button-row">
                    <button
                        type="button"
                        onClick={() => {
                            handleStart();
                        }}
                    >
                        開始
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            navigate('/settings');
                        }}
                    >
                        オプション設定
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            navigate('/ranking');
                        }}
                    >
                        ランキング
                    </button>
                </div>
            </section>
        </div>
    );
}

function getInputMethodLabel (inputMethod: InputMethodType): string {
    switch (inputMethod) {
        case 'keyboard':
            return 'キーボード優先';

        case 'tile':
            return '数字タイル優先';

        case 'auto':
        default:
            return '自動';
    }
}