import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ADVENTURE_COMPLETE_PARTY_REWARD_COUNT, ADVENTURE_SECRET_UNLOCK_SECONDS, ADVENTURE_TIME_LIMIT_SEC, ADVENTURE_WEAPON_MATERIAL_REQUIREMENT } from '../constants/adventureConstants';
import { useAppContext } from '../context/AppContext';
import { defaultFantasyTheme } from '../themes/defaultFantasyTheme';
import { buildAdventureDungeonPreview, getBadgeLabel, getDungeonById, getEnabledExtensionCount, getProblemLevel } from '../utils/adventureUtils';
import { getCourseLabelText } from '../utils/quizUtils';

export function AdventureHubPage () {
    const navigate = useNavigate();
    const {
        users,
        selectedUserId,
        quizSettings,
    } = useAppContext();

    const currentUser = users.find((user) => {
        return (user.id === selectedUserId);
    });

    const [selectedDungeonId, setSelectedDungeonId] = useState<string>(defaultFantasyTheme.dungeons[0].id);
    const [confirmedDungeonId, setConfirmedDungeonId] = useState<string | null>(null);

    const selectedDungeon = useMemo(() => {
        return getDungeonById(defaultFantasyTheme, selectedDungeonId);
    }, [selectedDungeonId]);

    const confirmedDungeon = useMemo(() => {
        if (confirmedDungeonId == null) {
            return null;
        }

        return getDungeonById(defaultFantasyTheme, confirmedDungeonId);
    }, [confirmedDungeonId]);

    const preview = useMemo(() => {
        return buildAdventureDungeonPreview(
            quizSettings,
            defaultFantasyTheme,
            selectedDungeonId
        );
    }, [quizSettings, selectedDungeonId]);

    function handleChallenge (): void {
        if (selectedDungeon == null) {
            return;
        }

        const confirmed = window.confirm(
            `「${selectedDungeon.name}」に挑戦しますか？

制限時間: ${ADVENTURE_TIME_LIMIT_SEC}秒
想定問題レベル: Lv${preview.questionLevel}
推奨戦力: ${preview.recommendedPower}`
        );

        if (confirmed === false) {
            return;
        }

        setConfirmedDungeonId(selectedDungeon.id);
        window.scrollTo({
            top: 0,
            behavior: 'smooth',
        });
    }

    return (
        <div className="page-container">
            <h1>冒険モード</h1>

            <section className="card hero-start-card">
                <div className="hero-title-row">
                    <div>
                        <h2>{defaultFantasyTheme.title}</h2>
                        <p className="sub-text hero-subtext">{defaultFantasyTheme.introText}</p>
                    </div>

                    <span className="mode-badge">v1 骨組み</span>
                </div>

                <div className="summary-chip-row top-gap">
                    <span className="mode-badge">挑戦者: {currentUser?.name ?? 'ゲスト'}</span>
                    <span className="mode-badge">問題レベル Lv{getProblemLevel(quizSettings)}</span>
                    <span className="mode-badge">バッジ {getBadgeLabel(quizSettings, defaultFantasyTheme)}</span>
                    <span className="mode-badge">拡張 {getEnabledExtensionCount(quizSettings)}個</span>
                </div>

                <div className="button-row top-gap">
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
                            navigate('/settings');
                        }}
                    >
                        学習設定を調整
                    </button>
                </div>
            </section>

            {confirmedDungeon == null && (
                <>
                    <section className="card">
                        <h2>現在の挑戦条件</h2>

                        <ul className="simple-list">
                            <li>演算種別: {getCourseLabelText(quizSettings.selectedCourses)}</li>
                            <li>問題レベル: Lv{getProblemLevel(quizSettings)}</li>
                            <li>バッジ階級: {getBadgeLabel(quizSettings, defaultFantasyTheme)}</li>
                            <li>制限時間: {ADVENTURE_TIME_LIMIT_SEC.toFixed(1)}秒</li>
                            <li>シークレット出現条件（案）: ボスを{ADVENTURE_SECRET_UNLOCK_SECONDS}秒以内に撃破</li>
                            <li>1人分の武器錬成素材: {ADVENTURE_WEAPON_MATERIAL_REQUIREMENT}個前後</li>
                            <li>4人分完成報酬: {ADVENTURE_COMPLETE_PARTY_REWARD_COUNT}人分そろえると宝獲得</li>
                        </ul>
                    </section>

                    <section className="card">
                        <h2>パーティ</h2>

                        <div className="adventure-grid">
                            {defaultFantasyTheme.partyMembers.map((member) => {
                                return (
                                    <article key={member.id} className="dungeon-card">
                                        <div className="dungeon-card-title">{member.characterLabel}</div>
                                        <div>{member.jobName}</div>
                                        <div className="sub-text">初期武器: {member.initialWeaponName}</div>
                                    </article>
                                );
                            })}
                        </div>
                    </section>

                    <section className="card">
                        <div className="hero-title-row">
                            <div>
                                <h2>ダンジョン選択</h2>
                                <p className="sub-text">世界観テキストは theme 定義から差し替えられる構造にしています。</p>
                            </div>
                        </div>

                        <div className="adventure-grid">
                            {defaultFantasyTheme.dungeons.map((dungeon) => {
                                const dungeonPreview = buildAdventureDungeonPreview(
                                    quizSettings,
                                    defaultFantasyTheme,
                                    dungeon.id
                                );
                                const selected = (dungeon.id === selectedDungeonId);

                                return (
                                    <button
                                        key={dungeon.id}
                                        type="button"
                                        className={`dungeon-card dungeon-select-button ${selected === true ? 'is-selected' : ''}`}
                                        onClick={() => {
                                            setSelectedDungeonId(dungeon.id);
                                        }}
                                    >
                                        <div className="dungeon-card-title">{dungeon.name}</div>
                                        <div className="sub-text">{dungeon.accentText}</div>
                                        <div className="summary-chip-row top-gap">
                                            <span className="mode-badge">Lv{dungeonPreview.questionLevel}</span>
                                            <span className="mode-badge">推奨 {dungeonPreview.recommendedPower}</span>
                                            <span className="mode-badge">{dungeonPreview.badgeText}</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    {selectedDungeon != null && (
                        <section className="card dungeon-detail-card">
                            <div className="hero-title-row">
                                <div>
                                    <h2>{selectedDungeon.name}</h2>
                                    <p className="sub-text hero-subtext">{selectedDungeon.description}</p>
                                </div>

                                <span className="mode-badge">素材: {selectedDungeon.rewards.materialName}</span>
                            </div>

                            <div className="form-grid top-gap">
                                <div>
                                    <h3>基本情報</h3>
                                    <ul className="simple-list compact-list">
                                        <li>問題レベル: Lv{preview.questionLevel}</li>
                                        <li>バッジ: {preview.badgeText}</li>
                                        <li>味方戦力: {preview.attackPower}</li>
                                        <li>推奨戦力: {preview.recommendedPower}</li>
                                        <li>想定獲得素材: {preview.rewardMaterialCount}個</li>
                                        <li>宝候補: {selectedDungeon.rewards.treasureName}</li>
                                    </ul>
                                </div>

                                <div>
                                    <h3>出現順</h3>
                                    <ol className="simple-list compact-list ordered-list">
                                        <li>ザコA: {selectedDungeon.enemies.mobA} / HP {preview.enemyHpMap.mobA}</li>
                                        <li>ザコB: {selectedDungeon.enemies.mobB} / HP {preview.enemyHpMap.mobB}</li>
                                        <li>ザコC: {selectedDungeon.enemies.mobC} / HP {preview.enemyHpMap.mobC}</li>
                                        <li>ボス: {selectedDungeon.enemies.boss} / HP {preview.enemyHpMap.boss}</li>
                                        <li>シークレット: {selectedDungeon.enemies.secret} / HP {preview.enemyHpMap.secret}</li>
                                    </ol>
                                </div>
                            </div>

                            <div className="button-row top-gap">
                                <button
                                    type="button"
                                    className="primary-button primary-button-large"
                                    onClick={() => {
                                        handleChallenge();
                                    }}
                                >
                                    このダンジョンに挑戦
                                </button>
                            </div>
                        </section>
                    )}
                </>
            )}

            {confirmedDungeon != null && (
                <section className="card challenge-ready-card">
                    <h2>挑戦準備完了</h2>

                    <p>
                        「{confirmedDungeon.name}」への挑戦状態へ切り替わりました。ここでダンジョン選択UIを下に残したまま出題するのではなく、
                        冒険専用の進行画面へ遷移させる構成にするのが次段階です。
                    </p>

                    <ul className="simple-list">
                        <li>次段階で接続する内容: 60秒タイマー / 敵HP / ダメージ繰り越し / フィードバック停止時間</li>
                        <li>今回ここまでで固めた内容: ダンジョン選択 / 確認ポップアップ / theme外出し土台 / 戦力プレビュー</li>
                    </ul>

                    <div className="button-row top-gap">
                        <button
                            type="button"
                            onClick={() => {
                                setConfirmedDungeonId(null);
                            }}
                        >
                            別のダンジョンを選ぶ
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
            )}
        </div>
    );
}
