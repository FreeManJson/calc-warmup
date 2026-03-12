import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import type { CourseType } from '../types/appTypes';
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
    } = useAppContext();

    function toggleCourse (course: CourseType): void {
        setQuizSettings((prev) => {
            const exists = prev.selectedCourses.includes(course);

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
                            onChange={() => {
                                toggleCourse('div');
                            }}
                        />
                        割り算
                    </label>
                </div>
            </section>

            <section className="card">
                <h2>現在の設定</h2>

                <ul className="simple-list">
                    <li>コース: {getCourseLabelText(quizSettings.selectedCourses)}</li>
                    <li>最大項目数: {quizSettings.maxTerms}</li>
                    <li>桁数: 1項目目 {quizSettings.firstTermMaxDigits}桁 / 2項目目 {quizSettings.secondTermMaxDigits}桁</li>
                    <li>出題数: {quizSettings.questionCount}問</li>
                    <li>
                        時間制限:
                        {quizSettings.timeLimitEnabled === true
                            ? ` あり（${quizSettings.timeLimitSec}秒）`
                            : ' なし'}
                    </li>
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