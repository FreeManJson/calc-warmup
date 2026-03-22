import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ADVENTURE_COMPLETE_PARTY_REWARD_COUNT, ADVENTURE_SECRET_UNLOCK_SECONDS, ADVENTURE_TIME_LIMIT_SEC, ADVENTURE_WEAPON_MATERIAL_REQUIREMENT } from '../constants/adventureConstants';
import { useAppContext } from '../context/AppContext';
import { defaultFantasyTheme } from '../themes/defaultFantasyTheme';
import { buildAdventureDungeonPreview, getBadgeLabel, getCurrentAdventureEnemy, getEnabledExtensionCount, getProblemLevel } from '../utils/adventureUtils';
import { getCourseLabelText } from '../utils/quizUtils';

export function AdventureHubPage () {
    const navigate = useNavigate();
    const {
        quizSettings,
        currentAdventure,
        latestAdventureResult,
        startAdventure,
        clearAdventureResult,
    } = useAppContext();

    const [expandedDungeonId, setExpandedDungeonId] = useState<string | null>(null);

    const previews = useMemo(() => {
        const previewMap: Record<string, ReturnType<typeof buildAdventureDungeonPreview>> = {};

        defaultFantasyTheme.dungeons.forEach((dungeon) => {
            previewMap[dungeon.id] = buildAdventureDungeonPreview(
                quizSettings,
                defaultFantasyTheme,
                dungeon.id
            );
        });

        return previewMap;
    }, [quizSettings]);

    function handleStartDungeon (dungeonId: string, dungeonName: string): void {
        const restartMessage = currentAdventure != null
            ? `進行中の冒険「${currentAdventure.dungeonName}」を上書きして、\n「${dungeonName}」へ出発します。よろしいですか？`
            : `「${dungeonName}」へ出発します。よろしいですか？`;
        const confirmed = window.confirm(restartMessage);

        if (confirmed === false) {
            return;
        }

        const started = startAdventure(dungeonId);

        if (started === false) {
            window.alert('冒険モードの開始に失敗しました。');
            return;
        }

        navigate('/adventure/play');
    }

    const badgeText = getBadgeLabel(quizSettings, defaultFantasyTheme);
    const extensionCount = getEnabledExtensionCount(quizSettings);
    const problemLevel = getProblemLevel(quizSettings);

    return (
        <div className="page-container">
            <section className="card hero-start-card">
                <div className="hero-title-row">
                    <div>
                        <h1>冒険モード</h1>
                        <p className="sub-text hero-subtext">{defaultFantasyTheme.introText}</p>
                    </div>

                    <span className="mode-badge">60.0秒サバイバル</span>
                </div>

                <div className="summary-chip-row top-gap">
                    <span className="mode-badge">演算: {getCourseLabelText(quizSettings.selectedCourses)}</span>
                    <span className="mode-badge">問題Lv {problemLevel}</span>
                    <span className="mode-badge">バッジ {badgeText}</span>
                    <span className="mode-badge">拡張 {extensionCount}個</span>
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

            {currentAdventure != null && (
                <section className="card challenge-ready-card">
                    <div className="hero-title-row">
                        <div>
                            <h2>進行中の冒険があります</h2>
                            <p className="sub-text hero-subtext">
                                「{currentAdventure.dungeonName}」を途中から再開できます。別ダンジョンへ出発すると現在の進行は上書きされます。
                            </p>
                        </div>

                        <span className="mode-badge">残り {(currentAdventure.remainingMs / 1000).toFixed(1)}秒</span>
                    </div>

                    <div className="summary-chip-row top-gap">
                        <span className="mode-badge">現在敵 {getCurrentAdventureEnemy(currentAdventure.enemyStates)?.enemyName ?? '制覇済み'}</span>
                        <span className="mode-badge">撃破 {currentAdventure.defeatedStages.length}体</span>
                        <span className="mode-badge">累計ダメージ {currentAdventure.totalDamage}</span>
                    </div>

                    <div className="button-row top-gap">
                        <button
                            type="button"
                            className="primary-button"
                            onClick={() => {
                                navigate('/adventure/play');
                            }}
                        >
                            冒険を再開
                        </button>
                    </div>
                </section>
            )}

            {latestAdventureResult != null && (
                <section className="card">
                    <div className="hero-title-row">
                        <div>
                            <h2>前回の冒険結果</h2>
                            <p className="sub-text hero-subtext">
                                {latestAdventureResult.userName} / {latestAdventureResult.dungeonName}
                            </p>
                        </div>

                        <span className="mode-badge">{latestAdventureResult.cleared === true ? '攻略成功' : '時間切れ終了'}</span>
                    </div>

                    <div className="summary-chip-row top-gap">
                        <span className="mode-badge">撃破 {latestAdventureResult.defeatedStages.length}体</span>
                        <span className="mode-badge">素材 {latestAdventureResult.materialEarned}個</span>
                        <span className="mode-badge">累計ダメージ {latestAdventureResult.totalDamage}</span>
                    </div>

                    <div className="button-row top-gap">
                        <button
                            type="button"
                            onClick={() => {
                                navigate('/adventure/result');
                            }}
                        >
                            結果を見る
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                clearAdventureResult();
                            }}
                        >
                            表示を閉じる
                        </button>
                    </div>
                </section>
            )}

            <section className="card">
                <h2>現在の挑戦条件</h2>

                <ul className="simple-list">
                    <li>演算種別: {getCourseLabelText(quizSettings.selectedCourses)}</li>
                    <li>問題レベル: Lv{getProblemLevel(quizSettings)}</li>
                    <li>バッジ階級: {getBadgeLabel(quizSettings, defaultFantasyTheme)}</li>
                    <li>制限時間: {ADVENTURE_TIME_LIMIT_SEC.toFixed(1)}秒</li>
                    <li>シークレット出現条件: ボスを{ADVENTURE_SECRET_UNLOCK_SECONDS}秒以内に撃破</li>
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
                        <p className="sub-text hero-subtext">
                            各ダンジョン枠からそのまま出発できます。詳細は必要なものだけ開く形にしました。
                        </p>
                    </div>
                </div>

                <div className="adventure-grid">
                    {defaultFantasyTheme.dungeons.map((dungeon) => {
                        const preview = previews[dungeon.id];
                        const expanded = (expandedDungeonId === dungeon.id);

                        return (
                            <article key={dungeon.id} className="dungeon-card dungeon-card-article">
                                <div className="dungeon-card-title">{dungeon.name}</div>
                                <div className="sub-text">{dungeon.accentText}</div>

                                <div className="summary-chip-row top-gap">
                                    <span className="mode-badge">Lv{preview.questionLevel}</span>
                                    <span className="mode-badge">推奨 {preview.recommendedPower}</span>
                                    <span className="mode-badge">素材 {preview.rewardMaterialCount}</span>
                                </div>

                                <div className="dungeon-action-row top-gap">
                                    <button
                                        type="button"
                                        className="primary-button"
                                        onClick={() => {
                                            handleStartDungeon(dungeon.id, dungeon.name);
                                        }}
                                    >
                                        冒険に出発
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setExpandedDungeonId(expanded === true ? null : dungeon.id);
                                        }}
                                    >
                                        {expanded === true ? '詳細を閉じる' : '詳細を見る'}
                                    </button>
                                </div>

                                {expanded === true && (
                                    <div className="dungeon-inline-detail top-gap">
                                        <p className="sub-text">{dungeon.description}</p>

                                        <ul className="simple-list compact-list">
                                            <li>味方戦力: {preview.attackPower}</li>
                                            <li>想定素材: {preview.rewardMaterialCount}個</li>
                                            <li>ザコA: {dungeon.enemies.mobA} / HP {preview.enemyHpMap.mobA}</li>
                                            <li>ザコB: {dungeon.enemies.mobB} / HP {preview.enemyHpMap.mobB}</li>
                                            <li>ザコC: {dungeon.enemies.mobC} / HP {preview.enemyHpMap.mobC}</li>
                                            <li>ボス: {dungeon.enemies.boss} / HP {preview.enemyHpMap.boss}</li>
                                            <li>シークレット: {dungeon.enemies.secret} / HP {preview.enemyHpMap.secret}</li>
                                            <li>宝候補: {dungeon.rewards.treasureName}</li>
                                        </ul>
                                    </div>
                                )}
                            </article>
                        );
                    })}
                </div>
            </section>
        </div>
    );
}
