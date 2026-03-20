import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import type { CourseType } from '../types/appTypes';
import { getCourseLabelText } from '../utils/quizUtils';
import {
    ADVENTURE_CONSTANTS,
    buildAdventureOverview,
} from '../utils/adventureUtils';

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
        renameUser,
        adventureTheme,
        adventureProgress,
    } = useAppContext();

    const adventureOverview = useMemo(() => {
        return buildAdventureOverview(adventureProgress, adventureTheme);
    }, [adventureProgress, adventureTheme]);

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

    function handleStartNormal (): void {
        const started = startQuiz();

        if (started === false) {
            window.alert('コースを1つ以上選択してください。');
            return;
        }

        navigate('/quiz');
    }

    function handleStartAdventure (): void {
        navigate('/adventure');
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

    function handleRenameUser (): void {
        const currentUser = users.find((user) => {
            return (user.id === selectedUserId);
        });

        if (currentUser == null) {
            return;
        }

        const inputName = window.prompt('新しいユーザー名を入力してください。', currentUser.name);

        if (inputName == null) {
            return;
        }

        const result = renameUser(currentUser.id, inputName);

        if (result.ok === false) {
            window.alert(result.message ?? 'ユーザー名変更に失敗しました。');
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

            <section className="card hero-card">
                <div className="hero-card-row">
                    <div>
                        <div className="hero-title">今日のモードを選ぶ</div>
                        <div className="hero-subtitle">
                            通常モードは n問完結、冒険モードは {ADVENTURE_CONSTANTS.totalTimeSec}秒 のタイムアタックです。
                        </div>
                    </div>

                    <div className="hero-button-group">
                        <button
                            type="button"
                            className="primary-hero-button"
                            onClick={() => {
                                handleStartNormal();
                            }}
                        >
                            {adventureTheme.normalModeLabel}を開始
                        </button>

                        <button
                            type="button"
                            className="secondary-hero-button"
                            onClick={() => {
                                handleStartAdventure();
                            }}
                        >
                            {adventureTheme.adventureModeLabel}へ
                        </button>
                    </div>
                </div>
            </section>

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
                            handleRenameUser();
                        }}
                    >
                        選択中ユーザー名変更
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
                    ユーザーごとに通常モード設定と冒険モード進行状況を保持します。
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
                            return `${index + 1}項目め ${digits}桁`;
                        }).join(' / ')}
                    </li>
                    <li>出題数: {quizSettings.questionCount}問</li>
                    <li>
                        時間制限:
                        {quizSettings.timeLimitEnabled === true
                            ? ` あり（${quizSettings.timeLimitSec}秒）`
                            : ' なし'}
                    </li>
                </ul>

                <div className="button-row top-gap">
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

            <section className="card adventure-summary-card">
                <h2>{adventureTheme.adventureModeLabel} 進行状況</h2>

                <div className="adventure-overview-grid">
                    <div className="adventure-overview-item">
                        <div className="adventure-overview-label">総攻撃力</div>
                        <div className="adventure-overview-value">{adventureOverview.totalAttack}</div>
                    </div>

                    <div className="adventure-overview-item">
                        <div className="adventure-overview-label">鍛えた武器</div>
                        <div className="adventure-overview-value">{adventureOverview.totalCraftedWeapons}</div>
                    </div>

                    <div className="adventure-overview-item">
                        <div className="adventure-overview-label">獲得した宝</div>
                        <div className="adventure-overview-value">{adventureOverview.totalUnlockedTreasures}</div>
                    </div>

                    <div className="adventure-overview-item">
                        <div className="adventure-overview-label">累計討伐数</div>
                        <div className="adventure-overview-value">{adventureOverview.totalEnemyKills}</div>
                    </div>
                </div>

                <p className="sub-text top-gap">
                    v1 ではダンジョン挑戦、素材獲得、自動錬成、宝解放までを先に入れています。
                    続行選択・専用コレクションUI・テーマ差し替え拡張は次段階で積み上げやすい構造にしています。
                </p>
            </section>
        </div>
    );
}
