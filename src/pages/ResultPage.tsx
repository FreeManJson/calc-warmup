import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { getCourseLabel } from '../utils/quizUtils';

export function ResultPage () {
    const navigate = useNavigate();
    const { latestResult, startQuiz } = useAppContext();

    if (latestResult == null) {
        return (
            <div className="page-container">
                <h1>結果画面</h1>

                <section className="card">
                    <p>まだ結果がありません。</p>

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

    function handleRetry (): void {
        const started = startQuiz();

        if (started === false) {
            window.alert('開始できませんでした。TOPでコースを確認してください。');
            return;
        }

        navigate('/quiz');
    }

    return (
        <div className="page-container">
            <h1>結果画面</h1>

            <section className="card">
                <h2>結果サマリ</h2>

                <ul className="simple-list">
                    <li>ユーザー: {latestResult.userName}</li>
                    <li>コース: {latestResult.courseLabel}</li>
                    <li>総問題数: {latestResult.totalQuestions}</li>
                    <li>正答数: {latestResult.correctCount}</li>
                    <li>正答率: {latestResult.accuracyRate}%</li>
                    <li>平均回答時間: {latestResult.averageAnswerMs} ms</li>
                    <li>スコア: {latestResult.score}</li>
                    <li>日時: {latestResult.playedAt}</li>
                </ul>
            </section>

            <section className="card">
                <h2>問題別結果</h2>

                <table className="result-table">
                    <thead>
                        <tr>
                            <th>№</th>
                            <th>コース</th>
                            <th>問題</th>
                            <th>回答</th>
                            <th>正解</th>
                            <th>判定</th>
                            <th>時間</th>
                            <th>点</th>
                        </tr>
                    </thead>

                    <tbody>
                        {latestResult.answers.map((answer, index) => {
                            return (
                                <tr key={answer.questionId}>
                                    <td>{index + 1}</td>
                                    <td>{getCourseLabel(answer.course)}</td>
                                    <td>{answer.questionText}</td>
                                    <td>{answer.userAnswer}</td>
                                    <td>{answer.correctAnswerText}</td>
                                    <td>
                                        {answer.isTimeout === true
                                            ? '時間切れ'
                                            : (answer.isCorrect === true ? '〇' : '×')}
                                    </td>
                                    <td>{answer.elapsedMs} ms</td>
                                    <td>{answer.score}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </section>

            <section className="card">
                <div className="button-row">
                    <button
                        type="button"
                        onClick={() => {
                            handleRetry();
                        }}
                    >
                        リトライ
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            navigate('/ranking');
                        }}
                    >
                        ランキングへ
                    </button>

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