import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import type { CourseType, InputMethodType } from '../types/appTypes';
import { defaultFantasyTheme } from '../themes/defaultFantasyTheme';
import { getBadgeLabel, getEnabledExtensionCount, getProblemLevel } from '../utils/adventureUtils';
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
        renameUser,
        deleteUser,
    } = useAppContext();

    const [settingsExpanded, setSettingsExpanded] = useState<boolean>(false);

    const selectedUser = useMemo(() => {
        return users.find((user) => {
            return (user.id === selectedUserId);
        }) ?? null;
    }, [users, selectedUserId]);

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

    function handleStartStudyMode (): void {
        const started = startQuiz();

        if (started === false) {
            window.alert('コースを1つ以上選択してください。');
            return;
        }

        navigate('/quiz');
    }

    function handleOpenAdventureMode (): void {
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
        if (selectedUser == null) {
            return;
        }

        const inputName = window.prompt('変更後のユーザー名を入力してください。', selectedUser.name);

        if (inputName == null) {
            return;
        }

        const result = renameUser(selectedUser.id, inputName);

        if (result.ok === false) {
            window.alert(result.message ?? 'ユーザー名変更に失敗しました。');
        }
    }

    function handleDeleteUser (): void {
        if (selectedUser == null) {
            return;
        }

        const confirmed = window.confirm(
            `ユーザー「${selectedUser.name}」を削除します。よろしいですか？`
        );

        if (confirmed === false) {
            return;
        }

        const result = deleteUser(selectedUser.id);

        if (result.ok === false) {
            window.alert(result.message ?? 'ユーザー削除に失敗しました。');
        }
    }

    const visibleTermDigits = quizSettings.termMaxDigits.slice(0, quizSettings.maxTerms);
    const badgeLabel = getBadgeLabel(quizSettings, defaultFantasyTheme);
    const extensionCount = getEnabledExtensionCount(quizSettings);
    const problemLevel = getProblemLevel(quizSettings);

    return (
        <div className="page-container">
            <h1>計算ウォーミングアップ</h1>

            <section className="card hero-start-card">
                <div className="hero-title-row">
                    <div>
                        <h2>はじめる</h2>
                        <p className="sub-text hero-subtext">
                            まずは学習モードをすぐ開始できるようにしつつ、冒険モードは別ページで安全に段階実装します。
                        </p>
                    </div>

                    <span className="mode-badge">スマホ重視</span>
                </div>

                <div className="hero-action-grid top-gap">
                    <button
                        type="button"
                        className="primary-button primary-button-large"
                        onClick={() => {
                            handleStartStudyMode();
                        }}
                    >
                        学習モードを開始
                    </button>

                    <button
                        type="button"
                        className="secondary-hero-button"
                        onClick={() => {
                            handleOpenAdventureMode();
                        }}
                    >
                        冒険モードへ
                    </button>
                </div>

                <div className="summary-chip-row top-gap">
                    <span className="mode-badge">ユーザー: {selectedUser?.name ?? '未選択'}</span>
                    <span className="mode-badge">問題レベル Lv{problemLevel}</span>
                    <span className="mode-badge">バッジ {badgeLabel}</span>
                    <span className="mode-badge">拡張 {extensionCount}個</span>
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
                    ユーザーごとに前回設定を保持します。今回の第1弾では、ユーザー名変更時にローカルランキング表示名も追従するようにしています。
                </p>
            </section>

            <section className="card">
                <h2>演算種別</h2>

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
                    演算種別は最低1つ選択された状態を保持します。冒険モードではこの選択数がバッジ階級の基準になります。
                </p>
            </section>

            <section className="card">
                <div className="summary-toggle-row">
                    <div>
                        <h2>現在の設定</h2>
                        <p className="sub-text summary-subtext">通常は要点だけ表示し、必要なときだけ展開する形に変更しています。</p>
                    </div>

                    <button
                        type="button"
                        className="summary-toggle-button"
                        onClick={() => {
                            setSettingsExpanded((prev) => {
                                return (prev === false);
                            });
                        }}
                    >
                        {settingsExpanded === true ? '− 閉じる' : '+ 詳細を表示'}
                    </button>
                </div>

                <div className="summary-chip-row top-gap">
                    <span className="mode-badge">演算: {getCourseLabelText(quizSettings.selectedCourses)}</span>
                    <span className="mode-badge">最大項目数 {quizSettings.maxTerms}</span>
                    <span className="mode-badge">出題数 {quizSettings.questionCount}</span>
                    <span className="mode-badge">
                        時間制限
                        {quizSettings.timeLimitEnabled === true
                            ? ` ${quizSettings.timeLimitSec}秒`
                            : ' なし'}
                    </span>
                </div>

                {settingsExpanded === true && (
                    <ul className="simple-list top-gap">
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
                        <li>入力方式: {getInputMethodLabel(quizSettings.inputMethod)}</li>
                        <li>マイナス: {quizSettings.allowNegative === true ? 'ON' : 'OFF'}</li>
                        <li>小数: {quizSettings.allowDecimal === true ? 'ON' : 'OFF'}</li>
                        <li>あまり: {quizSettings.allowRemainder === true ? 'ON' : 'OFF'}</li>
                        <li>実数割り算: {quizSettings.allowRealDivision === true ? 'ON' : 'OFF'}</li>
                    </ul>
                )}
            </section>

            <section className="card">
                <h2>メニュー</h2>

                <div className="button-row">
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

                <p className="sub-text top-gap">
                    ランキングは引き続き学習モード専用です。冒険モードの素材・武器・トロフィーは次段階で別保存に分離します。
                </p>
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
