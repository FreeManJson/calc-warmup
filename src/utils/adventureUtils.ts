import { ADVENTURE_ATTACK_TUNING, ADVENTURE_BADGE_TIER_BY_COURSE_COUNT, ADVENTURE_ENEMY_TUNING, ADVENTURE_REWARD_TUNING, ADVENTURE_SECRET_UNLOCK_SECONDS, ADVENTURE_STAGE_HP_MULTIPLIERS, ADVENTURE_STAGE_ORDER, ADVENTURE_TIME_LIMIT_SEC } from '../constants/adventureConstants';
import type { GeneratedQuestion, QuizSettings } from '../types/appTypes';
import type { AdventureBattleLogEntry, AdventureDungeonPreview, AdventureEnemyState, AdventureFeedbackState, AdventureResult, AdventureSession, AdventureStageKey, AdventureThemeDefinition, BadgeTier, DungeonThemeDefinition } from '../types/adventureTypes';
import { generateQuestions } from './quizUtils';

export function getProblemLevel (settings: QuizSettings): number {
    const visibleDigits = settings.termMaxDigits.slice(0, settings.maxTerms);

    if (visibleDigits.length <= 0) {
        return 1;
    }

    const sum = visibleDigits.reduce((accumulator, value) => {
        return (accumulator + Math.max(1, value));
    }, 0);

    return Math.max(1, Math.floor(sum / visibleDigits.length));
}

export function getEnabledExtensionCount (settings: QuizSettings): number {
    const flags = [
        settings.allowNegative,
        settings.allowDecimal,
        settings.allowRemainder,
        settings.allowRealDivision,
    ];

    return flags.filter((value) => {
        return (value === true);
    }).length;
}

export function getBadgeTier (settings: QuizSettings): BadgeTier {
    const courseCount = Math.max(1, Math.min(4, settings.selectedCourses.length));
    return ADVENTURE_BADGE_TIER_BY_COURSE_COUNT[courseCount] ?? 'bronze';
}

export function getBadgeLabel (
    settings: QuizSettings,
    theme: AdventureThemeDefinition
): string {
    const tier = getBadgeTier(settings);
    const plusCount = getEnabledExtensionCount(settings);
    const isMastery = (
        (settings.selectedCourses.length >= 4) &&
        (plusCount >= 4)
    );

    if (isMastery === true) {
        return theme.masteryLabel;
    }

    return `${theme.badgeLabels[tier]}${'+'.repeat(plusCount)}`;
}

export function getDungeonById (
    theme: AdventureThemeDefinition,
    dungeonId: string
): DungeonThemeDefinition | null {
    return theme.dungeons.find((dungeon) => {
        return (dungeon.id === dungeonId);
    }) ?? null;
}

export function buildAdventureDungeonPreview (
    settings: QuizSettings,
    theme: AdventureThemeDefinition,
    dungeonId: string
): AdventureDungeonPreview {
    const questionLevel = getProblemLevel(settings);
    const extensionCount = getEnabledExtensionCount(settings);
    const courseCount = Math.max(1, settings.selectedCourses.length);
    const dungeonIndex = Math.max(0, theme.dungeons.findIndex((dungeon) => {
        return (dungeon.id === dungeonId);
    }));

    const attackPower = Math.round(
        ADVENTURE_ATTACK_TUNING.baseAttack *
        (1 + ((questionLevel - 1) * ADVENTURE_ATTACK_TUNING.perQuestionLevelRate)) *
        (1 + ((courseCount - 1) * ADVENTURE_ATTACK_TUNING.perCourseRate)) *
        (1 + (extensionCount * ADVENTURE_ATTACK_TUNING.perExtensionRate))
    );

    const enemyHpBase = (
        ADVENTURE_ENEMY_TUNING.baseHp *
        (1 + ((questionLevel - 1) * ADVENTURE_ENEMY_TUNING.perQuestionLevelRate)) *
        (1 + (dungeonIndex * ADVENTURE_ENEMY_TUNING.perDungeonRate))
    );

    const enemyHpMap = {
        mobA: Math.round(enemyHpBase * ADVENTURE_STAGE_HP_MULTIPLIERS.mobA),
        mobB: Math.round(enemyHpBase * ADVENTURE_STAGE_HP_MULTIPLIERS.mobB),
        mobC: Math.round(enemyHpBase * ADVENTURE_STAGE_HP_MULTIPLIERS.mobC),
        boss: Math.round(enemyHpBase * ADVENTURE_STAGE_HP_MULTIPLIERS.boss),
        secret: Math.round(enemyHpBase * ADVENTURE_STAGE_HP_MULTIPLIERS.secret),
    };

    const rewardMaterialCount = Math.max(
        1,
        Math.round(
            ADVENTURE_REWARD_TUNING.baseMaterials +
            ((questionLevel - 1) * ADVENTURE_REWARD_TUNING.perQuestionLevelRate) +
            (dungeonIndex * ADVENTURE_REWARD_TUNING.perDungeonRate)
        )
    );

    return {
        badgeText: getBadgeLabel(settings, theme),
        questionLevel,
        attackPower,
        recommendedPower: Math.round(attackPower * (1 + (dungeonIndex * 0.18))),
        rewardMaterialCount,
        enemyHpMap,
    };
}

export function getStageLabel (stageKey: AdventureStageKey): string {
    const labels: Record<AdventureStageKey, string> = {
        mobA: 'ザコA',
        mobB: 'ザコB',
        mobC: 'ザコC',
        boss: 'ボス',
        secret: 'シークレット',
    };

    return labels[stageKey];
}

export function buildAdventureEnemyStates (
    dungeon: DungeonThemeDefinition,
    preview: AdventureDungeonPreview
): Record<AdventureStageKey, AdventureEnemyState> {
    return {
        mobA: buildEnemyState('mobA', dungeon.enemies.mobA, preview.enemyHpMap.mobA, true),
        mobB: buildEnemyState('mobB', dungeon.enemies.mobB, preview.enemyHpMap.mobB, true),
        mobC: buildEnemyState('mobC', dungeon.enemies.mobC, preview.enemyHpMap.mobC, true),
        boss: buildEnemyState('boss', dungeon.enemies.boss, preview.enemyHpMap.boss, true),
        secret: buildEnemyState('secret', dungeon.enemies.secret, preview.enemyHpMap.secret, false),
    };
}

export function getCurrentAdventureEnemy (
    enemyStates: Record<AdventureStageKey, AdventureEnemyState>
): AdventureEnemyState | null {
    for (const stageKey of ADVENTURE_STAGE_ORDER) {
        const enemyState = enemyStates[stageKey];

        if ((enemyState.unlocked === true) && (enemyState.defeated === false)) {
            return enemyState;
        }
    }

    return null;
}

export function createAdventureSession (
    userId: string,
    userName: string,
    settings: QuizSettings,
    theme: AdventureThemeDefinition,
    dungeonId: string
): AdventureSession | null {
    const dungeon = getDungeonById(theme, dungeonId);

    if (dungeon == null) {
        return null;
    }

    const preview = buildAdventureDungeonPreview(settings, theme, dungeonId);
    const enemyStates = buildAdventureEnemyStates(dungeon, preview);

    return {
        id: `adventure-${Date.now()}`,
        userId,
        userName,
        themeId: theme.id,
        dungeonId,
        dungeonName: dungeon.name,
        settingsSnapshot: settings,
        preview,
        startedAt: new Date().toISOString(),
        remainingMs: (ADVENTURE_TIME_LIMIT_SEC * 1000),
        totalElapsedMs: 0,
        questionIndex: 0,
        totalDamage: 0,
        correctCount: 0,
        missCount: 0,
        timeoutCount: 0,
        defeatedStages: [],
        secretAppeared: false,
        cleared: false,
        failed: false,
        enemyStates,
        currentQuestion: generateAdventureQuestion(settings),
        battleLog: [],
    };
}

export function generateAdventureQuestion (settings: QuizSettings): GeneratedQuestion | null {
    const questions = generateQuestions({
        ...settings,
        questionCount: 1,
    });

    return questions[0] ?? null;
}

export function tickAdventureSession (
    session: AdventureSession,
    deltaMs: number
): AdventureSession {
    const safeDelta = Math.max(0, Math.round(deltaMs));
    const remainingMs = Math.max(0, session.remainingMs - safeDelta);
    const failed = (
        remainingMs <= 0
            ? true
            : session.failed
    );

    return {
        ...session,
        remainingMs,
        totalElapsedMs: (session.totalElapsedMs + safeDelta),
        failed,
    };
}

export function resolveAdventureAnswer (
    session: AdventureSession,
    payload: {
        isCorrect: boolean;
        isTimeout: boolean;
        userAnswer: string;
    }
): { nextSession: AdventureSession; feedback: AdventureFeedbackState; result: AdventureResult | null } {
    const currentEnemy = getCurrentAdventureEnemy(session.enemyStates);
    const currentQuestion = session.currentQuestion;
    const stageKeyBefore = currentEnemy?.stageKey ?? null;

    if ((currentEnemy == null) || (currentQuestion == null)) {
        const nextSession = {
            ...session,
            cleared: true,
        };

        return {
            nextSession,
            feedback: {
                kind: 'correct',
                title: '冒険完了',
                subText: 'すでに攻略済みです。',
                damage: 0,
                defeatedStages: [],
                stageKeyBefore: null,
                stageKeyAfter: null,
                expression: '',
                correctAnswerText: '',
            },
            result: buildAdventureResult(nextSession),
        };
    }

    const damage = payload.isCorrect === true ? session.preview.attackPower : 0;
    const afterDamage = applyAdventureDamage(
        session.enemyStates,
        damage,
        session.totalElapsedMs
    );

    const nextEnemy = getCurrentAdventureEnemy(afterDamage.enemyStates);
    const answeredCount = (session.questionIndex + 1);
    const nextSession: AdventureSession = {
        ...session,
        questionIndex: answeredCount,
        totalDamage: (session.totalDamage + damage),
        correctCount: (session.correctCount + (payload.isCorrect === true ? 1 : 0)),
        missCount: (session.missCount + ((payload.isCorrect === false) && (payload.isTimeout === false) ? 1 : 0)),
        timeoutCount: (session.timeoutCount + (payload.isTimeout === true ? 1 : 0)),
        defeatedStages: mergeDefeatedStages(session.defeatedStages, afterDamage.defeatedStages),
        secretAppeared: (session.secretAppeared || afterDamage.secretAppeared),
        cleared: afterDamage.cleared,
        failed: session.failed,
        enemyStates: afterDamage.enemyStates,
        currentQuestion: (
            afterDamage.cleared === true
                ? null
                : generateAdventureQuestion(session.settingsSnapshot)
        ),
        battleLog: [
            ...session.battleLog,
            buildBattleLogEntry(
                currentQuestion,
                payload.userAnswer,
                payload.isCorrect,
                payload.isTimeout,
                damage,
                stageKeyBefore,
                nextEnemy?.stageKey ?? null,
                afterDamage.defeatedStages
            ),
        ],
    };

    const feedback = buildFeedback(
        currentQuestion,
        payload.isCorrect,
        payload.isTimeout,
        damage,
        afterDamage.defeatedStages,
        stageKeyBefore,
        nextEnemy?.stageKey ?? null,
        afterDamage.secretAppeared,
        afterDamage.cleared
    );

    return {
        nextSession,
        feedback,
        result: (
            (nextSession.cleared === true) || (nextSession.failed === true)
                ? buildAdventureResult(nextSession)
                : null
        ),
    };
}

export function buildAdventureResult (session: AdventureSession): AdventureResult {
    const clearedStagesCount = session.defeatedStages.length;
    const materialRatio = Math.max(0.35, Math.min(1, (clearedStagesCount / 4)));
    const materialEarned = Math.max(
        1,
        Math.round(session.preview.rewardMaterialCount * materialRatio)
    );
    const treasureEarned = (
        session.defeatedStages.includes('boss') === true
    );

    return {
        id: `adventure-result-${Date.now()}`,
        sessionId: session.id,
        userId: session.userId,
        userName: session.userName,
        themeId: session.themeId,
        dungeonId: session.dungeonId,
        dungeonName: session.dungeonName,
        settingsSnapshot: session.settingsSnapshot,
        preview: session.preview,
        playedAt: new Date().toISOString(),
        totalElapsedMs: session.totalElapsedMs,
        totalDamage: session.totalDamage,
        answeredCount: session.questionIndex,
        correctCount: session.correctCount,
        missCount: session.missCount,
        timeoutCount: session.timeoutCount,
        defeatedStages: session.defeatedStages,
        cleared: session.cleared,
        secretAppeared: session.secretAppeared,
        materialEarned,
        treasureEarned,
        battleLog: session.battleLog,
    };
}

function buildEnemyState (
    stageKey: AdventureStageKey,
    enemyName: string,
    maxHp: number,
    unlocked: boolean
): AdventureEnemyState {
    return {
        stageKey,
        enemyName,
        maxHp,
        remainingHp: maxHp,
        unlocked,
        defeated: false,
    };
}

function mergeDefeatedStages (
    baseStages: AdventureStageKey[],
    additionalStages: AdventureStageKey[]
): AdventureStageKey[] {
    const merged = [...baseStages];

    additionalStages.forEach((stageKey) => {
        if (merged.includes(stageKey) === false) {
            merged.push(stageKey);
        }
    });

    return merged;
}

function applyAdventureDamage (
    enemyStates: Record<AdventureStageKey, AdventureEnemyState>,
    damage: number,
    totalElapsedMs: number
): {
    enemyStates: Record<AdventureStageKey, AdventureEnemyState>;
    defeatedStages: AdventureStageKey[];
    secretAppeared: boolean;
    cleared: boolean;
} {
    const nextEnemyStates = cloneEnemyStates(enemyStates);
    const defeatedStages: AdventureStageKey[] = [];
    let remainingDamage = Math.max(0, damage);
    let secretAppeared = false;

    for (const stageKey of ADVENTURE_STAGE_ORDER) {
        const enemyState = nextEnemyStates[stageKey];

        if ((enemyState.unlocked === false) || (enemyState.defeated === true)) {
            continue;
        }

        if (remainingDamage <= 0) {
            break;
        }

        if (remainingDamage >= enemyState.remainingHp) {
            remainingDamage -= enemyState.remainingHp;
            enemyState.remainingHp = 0;
            enemyState.defeated = true;
            defeatedStages.push(stageKey);

            if (stageKey === 'boss') {
                const secretUnlocked = (totalElapsedMs <= (ADVENTURE_SECRET_UNLOCK_SECONDS * 1000));

                if (secretUnlocked === true) {
                    nextEnemyStates.secret.unlocked = true;
                    secretAppeared = true;
                }
            }
        }

        else {
            enemyState.remainingHp -= remainingDamage;
            remainingDamage = 0;
            break;
        }
    }

    const cleared = isAdventureCleared(nextEnemyStates);

    return {
        enemyStates: nextEnemyStates,
        defeatedStages,
        secretAppeared,
        cleared,
    };
}

function isAdventureCleared (
    enemyStates: Record<AdventureStageKey, AdventureEnemyState>
): boolean {
    const bossDefeated = (enemyStates.boss.defeated === true);

    if (bossDefeated === false) {
        return false;
    }

    if (enemyStates.secret.unlocked === true) {
        return (enemyStates.secret.defeated === true);
    }

    return true;
}

function cloneEnemyStates (
    enemyStates: Record<AdventureStageKey, AdventureEnemyState>
): Record<AdventureStageKey, AdventureEnemyState> {
    return {
        mobA: { ...enemyStates.mobA },
        mobB: { ...enemyStates.mobB },
        mobC: { ...enemyStates.mobC },
        boss: { ...enemyStates.boss },
        secret: { ...enemyStates.secret },
    };
}

function buildBattleLogEntry (
    question: GeneratedQuestion,
    userAnswer: string,
    isCorrect: boolean,
    isTimeout: boolean,
    damage: number,
    stageKeyBefore: AdventureStageKey | null,
    stageKeyAfter: AdventureStageKey | null,
    defeatedStages: AdventureStageKey[]
): AdventureBattleLogEntry {
    return {
        questionId: question.id,
        stageKeyBefore,
        stageKeyAfter,
        expression: question.expression,
        userAnswer,
        correctAnswerText: question.correctText,
        isCorrect,
        isTimeout,
        damage,
        defeatedStages,
        answeredAt: new Date().toISOString(),
    };
}

function buildFeedback (
    question: GeneratedQuestion,
    isCorrect: boolean,
    isTimeout: boolean,
    damage: number,
    defeatedStages: AdventureStageKey[],
    stageKeyBefore: AdventureStageKey | null,
    stageKeyAfter: AdventureStageKey | null,
    secretAppeared: boolean,
    cleared: boolean
): AdventureFeedbackState {
    if (isCorrect === true) {
        const defeatedText = (
            defeatedStages.length > 0
                ? `撃破: ${defeatedStages.map((stageKey) => {
                    return getStageLabel(stageKey);
                }).join(' / ')}`
                : '敵へ命中'
        );

        const specialTextParts: string[] = [
            `${defeatedText} / ${damage}ダメージ`,
        ];

        if (secretAppeared === true) {
            specialTextParts.push('ボスを30秒以内に倒したため、シークレット出現');
        }

        if (cleared === true) {
            specialTextParts.push('ダンジョン制覇');
        }

        return {
            kind: 'correct',
            title: 'ヒット！',
            subText: specialTextParts.join(' / '),
            damage,
            defeatedStages,
            stageKeyBefore,
            stageKeyAfter,
            expression: question.expression,
            correctAnswerText: question.correctText,
        };
    }

    if (isTimeout === true) {
        return {
            kind: 'timeout',
            title: '時間切れ',
            subText: '攻撃は不発でした。0ダメージ',
            damage: 0,
            defeatedStages,
            stageKeyBefore,
            stageKeyAfter,
            expression: question.expression,
            correctAnswerText: question.correctText,
        };
    }

    return {
        kind: 'wrong',
        title: 'ミス',
        subText: '攻撃は外れました。0ダメージ',
        damage: 0,
        defeatedStages,
        stageKeyBefore,
        stageKeyAfter,
        expression: question.expression,
        correctAnswerText: question.correctText,
    };
}
