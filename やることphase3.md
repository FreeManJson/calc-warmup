いい感じです。
ではここからは **「見た目だけ」→「実際に遊べる最小版」** に進めます。

今回は次を入れます。

* ユーザーごとの前回設定保持
* コース選択・設定画面の本実装
* 問題生成
* 3カウント開始
* 正誤判定
* 時間切れ判定
* 結果画面への反映
* 端末内ランキング TOP10 保存

今回は **ローカル保存は `localStorage`** にしてあります。
`IndexedDB` はあとで手書きメモや履歴を広げるときに切り替えやすい構成です。

## 1. 追加するファイル構成

`src` をこうします。

```text
src
├─constants
│  ├─appConstants.ts
│  └─defaultSettings.ts
├─context
│  └─AppContext.tsx
├─pages
│  ├─TopPage.tsx
│  ├─SettingsPage.tsx
│  ├─QuizPage.tsx
│  ├─ResultPage.tsx
│  └─RankingPage.tsx
├─types
│  └─appTypes.ts
├─utils
│  └─quizUtils.ts
├─App.tsx
├─main.tsx
└─styles.css
```

---

## 2. `src/types/appTypes.ts` を新規作成

```tsx
export type CourseType = 'add' | 'sub' | 'mul' | 'div';
export type AnswerKind = 'number' | 'quotientRemainder';

export interface QuizSettings {
    selectedCourses: CourseType[];
    maxTerms: number;
    firstTermMaxDigits: number;
    secondTermMaxDigits: number;
    timeLimitEnabled: boolean;
    timeLimitSec: number;
    questionCount: number;
    allowNegative: boolean;
    allowDecimal: boolean;
    allowRemainder: boolean;
    allowRealDivision: boolean;
    presetName: string;
    handwritingMemoEnabled: boolean;
}

export interface UserProfile {
    id: string;
    name: string;
}

export interface GeneratedQuestion {
    id: string;
    course: CourseType;
    expression: string;
    answerKind: AnswerKind;
    correctText: string;
    expectedNumber?: number;
    expectedParts?: [number, number];
    tolerance?: number;
    inputHint?: string;
    difficulty: number;
}

export interface CurrentQuiz {
    id: string;
    selectedUserId: string;
    settingsSnapshot: QuizSettings;
    questions: GeneratedQuestion[];
}

export interface AnswerResult {
    questionId: string;
    questionText: string;
    course: CourseType;
    userAnswer: string;
    correctAnswerText: string;
    isCorrect: boolean;
    isTimeout: boolean;
    elapsedMs: number;
    score: number;
}

export interface QuizResult {
    userName: string;
    courseLabel: string;
    totalQuestions: number;
    correctCount: number;
    accuracyRate: number;
    averageAnswerMs: number;
    score: number;
    playedAt: string;
    answers: AnswerResult[];
}

export interface RankingEntry {
    id: string;
    userName: string;
    courseLabel: string;
    score: number;
    accuracyRate: number;
    averageAnswerMs: number;
    playedAt: string;
}
```

---

## 3. `src/constants/appConstants.ts` を新規作成

```tsx
export const MAX_TERMS = 9;
export const TOP_RANKING_COUNT = 10;
export const FEEDBACK_DISPLAY_MS = 1500;
export const REAL_DIVISION_DECIMAL_DIGITS = 2;

export const STORAGE_KEYS = {
    selectedUserId: 'calcWarmup.selectedUserId',
    settingsByUserId: 'calcWarmup.settingsByUserId',
    ranking: 'calcWarmup.ranking',
    latestResult: 'calcWarmup.latestResult',
} as const;
```

---

## 4. `src/constants/defaultSettings.ts` を新規作成

```tsx
import type { QuizSettings, UserProfile } from '../types/appTypes';

export function createDefaultSettings (): QuizSettings {
    return {
        selectedCourses: ['add'],
        maxTerms: 2,
        firstTermMaxDigits: 2,
        secondTermMaxDigits: 2,
        timeLimitEnabled: false,
        timeLimitSec: 10,
        questionCount: 10,
        allowNegative: false,
        allowDecimal: false,
        allowRemainder: false,
        allowRealDivision: false,
        presetName: '高校基礎',
        handwritingMemoEnabled: false,
    };
}

export function createDefaultUsers (): UserProfile[] {
    return [
        { id: 'father', name: 'お父さん' },
        { id: 'son', name: '息子' },
    ];
}
```

---

## 5. `src/utils/quizUtils.ts` を新規作成

```tsx
import {
    REAL_DIVISION_DECIMAL_DIGITS,
} from '../constants/appConstants';
import type {
    AnswerResult,
    CourseType,
    GeneratedQuestion,
    QuizResult,
    QuizSettings,
} from '../types/appTypes';

const COURSE_LABELS: Record<CourseType, string> = {
    add: '足し算',
    sub: '引き算',
    mul: '掛け算',
    div: '割り算',
};

export function getCourseLabel (course: CourseType): string {
    return COURSE_LABELS[course];
}

export function getCourseLabelText (courses: CourseType[]): string {
    return courses.map((course) => {
        return COURSE_LABELS[course];
    }).join(' / ');
}

export function generateQuestions (settings: QuizSettings): GeneratedQuestion[] {
    const questions: GeneratedQuestion[] = [];

    for (let lpIndex = 0; lpIndex < settings.questionCount; lpIndex += 1) {
        const course = pickRandomCourse(settings.selectedCourses);
        questions.push(generateSingleQuestion(course, settings, lpIndex));
    }

    return questions;
}

export function compareAnswer (
    question: GeneratedQuestion,
    inputValue: string
): { isCorrect: boolean; normalizedInput: string } {
    const trimmed = inputValue.trim();

    if (question.answerKind === 'quotientRemainder') {
        const matches = trimmed.match(/-?\d+/g);

        if ((matches == null) || (matches.length < 2) || (question.expectedParts == null)) {
            return {
                isCorrect: false,
                normalizedInput: trimmed,
            };
        }

        const quotient = Number(matches[0]);
        const remainder = Number(matches[1]);
        const normalizedInput = `${quotient} ${remainder}`;
        const isCorrect = (
            (quotient === question.expectedParts[0]) &&
            (remainder === question.expectedParts[1])
        );

        return {
            isCorrect,
            normalizedInput,
        };
    }

    const normalized = trimmed.replace(/,/g, '');
    const userNumber = Number(normalized);

    if (
        (trimmed.length <= 0) ||
        (Number.isFinite(userNumber) === false) ||
        (question.expectedNumber == null)
    ) {
        return {
            isCorrect: false,
            normalizedInput: trimmed,
        };
    }

    const tolerance = question.tolerance ?? 0.0001;
    const diff = Math.abs(userNumber - question.expectedNumber);

    return {
        isCorrect: (diff <= tolerance),
        normalizedInput: normalized,
    };
}

export function calculateQuestionScore (
    question: GeneratedQuestion,
    isCorrect: boolean,
    elapsedMs: number,
    settings: QuizSettings
): number {
    let targetMs = 3500;

    targetMs += ((settings.maxTerms - 2) * 500);
    targetMs += ((settings.secondTermMaxDigits - 1) * 250);

    if (settings.timeLimitEnabled === true) {
        targetMs = (settings.timeLimitSec * 1000);
    }

    if (isCorrect === false) {
        return 0;
    }

    const speedFactorBase = (targetMs / Math.max(elapsedMs, 300));
    const speedFactor = clamp(speedFactorBase, 0.6, 1.4);
    const rawScore = (100 * question.difficulty * speedFactor);

    return Math.round(rawScore);
}

export function buildQuizResult (
    userName: string,
    settings: QuizSettings,
    answers: AnswerResult[]
): QuizResult {
    const totalQuestions = answers.length;
    const correctCount = answers.filter((answer) => {
        return (answer.isCorrect === true);
    }).length;

    const totalElapsedMs = answers.reduce((sum, answer) => {
        return (sum + answer.elapsedMs);
    }, 0);

    const totalScore = answers.reduce((sum, answer) => {
        return (sum + answer.score);
    }, 0);

    const accuracyRate = (
        totalQuestions > 0
            ? Math.round((correctCount / totalQuestions) * 100)
            : 0
    );

    const averageAnswerMs = (
        totalQuestions > 0
            ? Math.round(totalElapsedMs / totalQuestions)
            : 0
    );

    return {
        userName,
        courseLabel: getCourseLabelText(settings.selectedCourses),
        totalQuestions,
        correctCount,
        accuracyRate,
        averageAnswerMs,
        score: totalScore,
        playedAt: formatDateTime(new Date()),
        answers,
    };
}

export function formatNumber (
    value: number,
    fractionDigits: number = 2
): string {
    if (Number.isInteger(value) === true) {
        return value.toString();
    }

    return value.toFixed(fractionDigits).replace(/\.?0+$/, '');
}

function pickRandomCourse (courses: CourseType[]): CourseType {
    const index = randomInt(0, (courses.length - 1));
    return courses[index];
}

function generateSingleQuestion (
    course: CourseType,
    settings: QuizSettings,
    index: number
): GeneratedQuestion {
    switch (course) {
        case 'add':
            return generateAdditionQuestion(settings, index);

        case 'sub':
            return generateSubtractionQuestion(settings, index);

        case 'mul':
            return generateMultiplicationQuestion(settings, index);

        case 'div':
            return generateDivisionQuestion(settings, index);

        default:
            return generateAdditionQuestion(settings, index);
    }
}

function generateAdditionQuestion (
    settings: QuizSettings,
    index: number
): GeneratedQuestion {
    const termCount = randomInt(2, settings.maxTerms);
    const operands: number[] = [];

    for (let lpIndex = 0; lpIndex < termCount; lpIndex += 1) {
        const maxDigits = getDigitsForTerm(lpIndex, settings);
        let value = createOperand(maxDigits, settings.allowDecimal);

        if ((settings.allowNegative === true) && (Math.random() < 0.25)) {
            value *= -1;
        }

        operands.push(value);
    }

    const answer = roundIfNeeded(operands.reduce((sum, value) => {
        return (sum + value);
    }, 0), settings.allowDecimal);

    const expression = operands.map((value, lpIndex) => {
        if (lpIndex === 0) {
            return wrapIfNegative(value);
        }

        if (value >= 0) {
            return `+ ${formatNumber(value, 1)}`;
        }

        return `+ (${formatNumber(value, 1)})`;
    }).join(' ');

    return {
        id: `q-add-${index}-${Date.now()}`,
        course: 'add',
        expression: `${expression} = ?`,
        answerKind: 'number',
        correctText: formatNumber(answer, 1),
        expectedNumber: answer,
        tolerance: (settings.allowDecimal === true ? 0.001 : 0.0001),
        difficulty: calculateDifficulty('add', settings, termCount),
    };
}

function generateSubtractionQuestion (
    settings: QuizSettings,
    index: number
): GeneratedQuestion {
    const termCount = randomInt(2, settings.maxTerms);
    const subOperands: number[] = [];

    for (let lpIndex = 1; lpIndex < termCount; lpIndex += 1) {
        const maxDigits = getDigitsForTerm(lpIndex, settings);
        subOperands.push(createOperand(maxDigits, settings.allowDecimal));
    }

    const subTotal = roundIfNeeded(subOperands.reduce((sum, value) => {
        return (sum + value);
    }, 0), settings.allowDecimal);

    const delta = createOperand(settings.firstTermMaxDigits, settings.allowDecimal);
    let firstOperand = subTotal + delta;

    if ((settings.allowNegative === true) && (Math.random() < 0.45)) {
        firstOperand = subTotal - delta;
    }

    const answer = roundIfNeeded(
        firstOperand - subTotal,
        settings.allowDecimal
    );

    const rightExpression = subOperands.map((value) => {
        return formatNumber(value, 1);
    }).join(' - ');

    return {
        id: `q-sub-${index}-${Date.now()}`,
        course: 'sub',
        expression: `${formatNumber(firstOperand, 1)} - ${rightExpression} = ?`,
        answerKind: 'number',
        correctText: formatNumber(answer, 1),
        expectedNumber: answer,
        tolerance: (settings.allowDecimal === true ? 0.001 : 0.0001),
        difficulty: calculateDifficulty('sub', settings, termCount),
    };
}

function generateMultiplicationQuestion (
    settings: QuizSettings,
    index: number
): GeneratedQuestion {
    const effectiveTermCount = Math.min(settings.maxTerms, (settings.allowDecimal === true ? 3 : 4));
    const termCount = randomInt(2, effectiveTermCount);
    const operands: number[] = [];

    for (let lpIndex = 0; lpIndex < termCount; lpIndex += 1) {
        const rawDigits = getDigitsForTerm(lpIndex, settings);
        const maxDigits = Math.min(rawDigits, (settings.allowDecimal === true ? 2 : 3));
        let value = createOperand(maxDigits, settings.allowDecimal);

        if (
            (settings.allowNegative === true) &&
            (lpIndex === 0) &&
            (Math.random() < 0.35)
        ) {
            value *= -1;
        }

        operands.push(value);
    }

    const answer = roundIfNeeded(operands.reduce((sum, value) => {
        return (sum * value);
    }, 1), settings.allowDecimal);

    const expression = operands.map((value) => {
        return wrapIfNegative(value);
    }).join(' × ');

    return {
        id: `q-mul-${index}-${Date.now()}`,
        course: 'mul',
        expression: `${expression} = ?`,
        answerKind: 'number',
        correctText: formatNumber(answer, 2),
        expectedNumber: answer,
        tolerance: (settings.allowDecimal === true ? 0.001 : 0.0001),
        difficulty: calculateDifficulty('mul', settings, termCount),
    };
}

function generateDivisionQuestion (
    settings: QuizSettings,
    index: number
): GeneratedQuestion {
    const divisorDigits = Math.min(settings.secondTermMaxDigits, 3);
    const quotientDigits = Math.min(settings.firstTermMaxDigits, 3);

    const divisor = Math.max(2, createIntegerOperand(divisorDigits));

    if (settings.allowRemainder === true) {
        const quotient = createIntegerOperand(quotientDigits);
        const remainder = randomInt(1, (divisor - 1));
        const dividend = ((divisor * quotient) + remainder);

        return {
            id: `q-div-${index}-${Date.now()}`,
            course: 'div',
            expression: `${dividend} ÷ ${divisor} = ?`,
            answerKind: 'quotientRemainder',
            correctText: `商 ${quotient} / 余り ${remainder}`,
            expectedParts: [quotient, remainder],
            inputHint: '商と余りを半角スペース区切りで入力（例: 12 3）',
            difficulty: calculateDifficulty('div', settings, 2),
        };
    }

    if (settings.allowRealDivision === true) {
        const dividend = createIntegerOperand(Math.min(settings.firstTermMaxDigits, 4));
        const rawAnswer = (dividend / divisor);
        const roundedAnswer = Number(rawAnswer.toFixed(REAL_DIVISION_DECIMAL_DIGITS));

        return {
            id: `q-div-${index}-${Date.now()}`,
            course: 'div',
            expression: `${dividend} ÷ ${divisor} = ?`,
            answerKind: 'number',
            correctText: formatNumber(roundedAnswer, REAL_DIVISION_DECIMAL_DIGITS),
            expectedNumber: roundedAnswer,
            tolerance: 0.005,
            inputHint: `小数第${REAL_DIVISION_DECIMAL_DIGITS}位までで入力`,
            difficulty: calculateDifficulty('div', settings, 2),
        };
    }

    let quotient = createIntegerOperand(quotientDigits);

    if ((settings.allowNegative === true) && (Math.random() < 0.35)) {
        quotient *= -1;
    }

    const dividend = (divisor * quotient);

    return {
        id: `q-div-${index}-${Date.now()}`,
        course: 'div',
        expression: `${dividend} ÷ ${divisor} = ?`,
        answerKind: 'number',
        correctText: quotient.toString(),
        expectedNumber: quotient,
        tolerance: 0.0001,
        difficulty: calculateDifficulty('div', settings, 2),
    };
}

function calculateDifficulty (
    course: CourseType,
    settings: QuizSettings,
    termCount: number
): number {
    let difficulty = 1.0;

    switch (course) {
        case 'add':
            difficulty = 1.00;
            break;

        case 'sub':
            difficulty = 1.12;
            break;

        case 'mul':
            difficulty = 1.35;
            break;

        case 'div':
            difficulty = 1.55;
            break;

        default:
            difficulty = 1.00;
            break;
    }

    difficulty += ((termCount - 2) * 0.08);
    difficulty += ((settings.secondTermMaxDigits - 1) * 0.07);

    if (settings.allowNegative === true) {
        difficulty += 0.10;
    }

    if (settings.allowDecimal === true) {
        difficulty += 0.15;
    }

    if (settings.allowRealDivision === true) {
        difficulty += 0.18;
    }

    if (settings.allowRemainder === true) {
        difficulty += 0.12;
    }

    return Number(difficulty.toFixed(2));
}

function getDigitsForTerm (
    termIndex: number,
    settings: QuizSettings
): number {
    if (termIndex === 0) {
        return settings.firstTermMaxDigits;
    }

    return settings.secondTermMaxDigits;
}

function createOperand (
    digits: number,
    allowDecimal: boolean
): number {
    const safeDigits = Math.max(1, digits);
    const minValue = (
        safeDigits === 1
            ? 0
            : Math.pow(10, (safeDigits - 1))
    );
    const maxValue = ((Math.pow(10, safeDigits)) - 1);
    const integerPart = randomInt(minValue, maxValue);

    if (allowDecimal === false) {
        return integerPart;
    }

    const decimalPart = (randomInt(0, 9) / 10);
    return Number((integerPart + decimalPart).toFixed(1));
}

function createIntegerOperand (digits: number): number {
    return Math.round(createOperand(digits, false));
}

function wrapIfNegative (value: number): string {
    if (value < 0) {
        return `(${formatNumber(value, 2)})`;
    }

    return formatNumber(value, 2);
}

function roundIfNeeded (
    value: number,
    allowDecimal: boolean
): number {
    if (allowDecimal === true) {
        return Number(value.toFixed(2));
    }

    return Math.round(value);
}

function clamp (
    value: number,
    minValue: number,
    maxValue: number
): number {
    return Math.min(Math.max(value, minValue), maxValue);
}

function randomInt (
    minValue: number,
    maxValue: number
): number {
    const min = Math.ceil(minValue);
    const max = Math.floor(maxValue);

    return Math.floor((Math.random() * ((max - min) + 1)) + min);
}

function formatDateTime (date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    const hour = `${date.getHours()}`.padStart(2, '0');
    const minute = `${date.getMinutes()}`.padStart(2, '0');
    const second = `${date.getSeconds()}`.padStart(2, '0');

    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}
```

---

## 6. `src/context/AppContext.tsx` を新規作成

```tsx
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import type { SetStateAction } from 'react';
import {
    STORAGE_KEYS,
    TOP_RANKING_COUNT,
} from '../constants/appConstants';
import {
    createDefaultSettings,
    createDefaultUsers,
} from '../constants/defaultSettings';
import type {
    CurrentQuiz,
    QuizResult,
    QuizSettings,
    RankingEntry,
    UserProfile,
} from '../types/appTypes';
import {
    generateQuestions,
} from '../utils/quizUtils';

interface AppContextType {
    users: UserProfile[];
    selectedUserId: string;
    setSelectedUserId: (userId: string) => void;
    quizSettings: QuizSettings;
    setQuizSettings: (nextValue: SetStateAction<QuizSettings>) => void;
    currentQuiz: CurrentQuiz | null;
    latestResult: QuizResult | null;
    ranking: RankingEntry[];
    startQuiz: () => boolean;
    clearQuiz: () => void;
    finishQuiz: (result: QuizResult) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider (
    { children }: { children: React.ReactNode }
) {
    const users = useMemo(() => {
        return createDefaultUsers();
    }, []);

    const [selectedUserId, setSelectedUserIdState] = useState<string>(() => {
        return readJson<string>(
            STORAGE_KEYS.selectedUserId,
            users[1]?.id ?? users[0].id
        );
    });

    const [settingsByUserId, setSettingsByUserId] = useState<Record<string, QuizSettings>>(() => {
        const initialMap = buildInitialSettingsMap(users);
        const storedMap = readJson<Record<string, QuizSettings>>(
            STORAGE_KEYS.settingsByUserId,
            initialMap
        );

        return {
            ...initialMap,
            ...storedMap,
        };
    });

    const [ranking, setRanking] = useState<RankingEntry[]>(() => {
        return readJson<RankingEntry[]>(STORAGE_KEYS.ranking, []);
    });

    const [latestResult, setLatestResult] = useState<QuizResult | null>(() => {
        return readJson<QuizResult | null>(STORAGE_KEYS.latestResult, null);
    });

    const [currentQuiz, setCurrentQuiz] = useState<CurrentQuiz | null>(null);

    const quizSettings = (
        settingsByUserId[selectedUserId] ?? createDefaultSettings()
    );

    useEffect(() => {
        writeJson(STORAGE_KEYS.selectedUserId, selectedUserId);
    }, [selectedUserId]);

    useEffect(() => {
        writeJson(STORAGE_KEYS.settingsByUserId, settingsByUserId);
    }, [settingsByUserId]);

    useEffect(() => {
        writeJson(STORAGE_KEYS.ranking, ranking);
    }, [ranking]);

    useEffect(() => {
        writeJson(STORAGE_KEYS.latestResult, latestResult);
    }, [latestResult]);

    useEffect(() => {
        if (settingsByUserId[selectedUserId] == null) {
            setSettingsByUserId((prevMap) => {
                return {
                    ...prevMap,
                    [selectedUserId]: createDefaultSettings(),
                };
            });
        }
    }, [selectedUserId, settingsByUserId]);

    const setSelectedUserId = useCallback((userId: string) => {
        setSelectedUserIdState(userId);
    }, []);

    const setQuizSettings = useCallback((nextValue: SetStateAction<QuizSettings>) => {
        setSettingsByUserId((prevMap) => {
            const currentSettings = (
                prevMap[selectedUserId] ?? createDefaultSettings()
            );

            const resolvedValue = (
                typeof nextValue === 'function'
                    ? nextValue(currentSettings)
                    : nextValue
            );

            return {
                ...prevMap,
                [selectedUserId]: resolvedValue,
            };
        });
    }, [selectedUserId]);

    const startQuiz = useCallback(() => {
        const snapshot: QuizSettings = {
            ...quizSettings,
            selectedCourses: [...quizSettings.selectedCourses],
        };

        if (snapshot.selectedCourses.length <= 0) {
            return false;
        }

        const questions = generateQuestions(snapshot);

        setCurrentQuiz({
            id: `quiz-${Date.now()}`,
            selectedUserId,
            settingsSnapshot: snapshot,
            questions,
        });

        return true;
    }, [quizSettings, selectedUserId]);

    const clearQuiz = useCallback(() => {
        setCurrentQuiz(null);
    }, []);

    const finishQuiz = useCallback((result: QuizResult) => {
        const rankingEntry: RankingEntry = {
            id: `rank-${Date.now()}`,
            userName: result.userName,
            courseLabel: result.courseLabel,
            score: result.score,
            accuracyRate: result.accuracyRate,
            averageAnswerMs: result.averageAnswerMs,
            playedAt: result.playedAt,
        };

        setLatestResult(result);

        setRanking((prevRanking) => {
            const nextRanking = [...prevRanking, rankingEntry];

            nextRanking.sort((left, right) => {
                if (left.score !== right.score) {
                    return (right.score - left.score);
                }

                if (left.accuracyRate !== right.accuracyRate) {
                    return (right.accuracyRate - left.accuracyRate);
                }

                return (left.averageAnswerMs - right.averageAnswerMs);
            });

            return nextRanking.slice(0, TOP_RANKING_COUNT);
        });

        setCurrentQuiz(null);
    }, []);

    const contextValue = useMemo<AppContextType>(() => {
        return {
            users,
            selectedUserId,
            setSelectedUserId,
            quizSettings,
            setQuizSettings,
            currentQuiz,
            latestResult,
            ranking,
            startQuiz,
            clearQuiz,
            finishQuiz,
        };
    }, [
        users,
        selectedUserId,
        setSelectedUserId,
        quizSettings,
        setQuizSettings,
        currentQuiz,
        latestResult,
        ranking,
        startQuiz,
        clearQuiz,
        finishQuiz,
    ]);

    return (
        <AppContext.Provider value={contextValue}>
            {children}
        </AppContext.Provider>
    );
}

export function useAppContext () {
    const context = useContext(AppContext);

    if (context == null) {
        throw new Error('useAppContext must be used inside AppProvider');
    }

    return context;
}

function buildInitialSettingsMap (users: UserProfile[]): Record<string, QuizSettings> {
    const initialMap: Record<string, QuizSettings> = {};

    users.forEach((user) => {
        initialMap[user.id] = createDefaultSettings();
    });

    return initialMap;
}

function readJson<T> (key: string, fallback: T): T {
    if (typeof window === 'undefined') {
        return fallback;
    }

    try {
        const raw = window.localStorage.getItem(key);

        if (raw == null) {
            return fallback;
        }

        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

function writeJson (key: string, value: unknown): void {
    if (typeof window === 'undefined') {
        return;
    }

    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // 何もしない
    }
}
```

---

## 7. `src/App.tsx` を置き換え

```tsx
import { Route, Routes } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { RankingPage } from './pages/RankingPage';
import { QuizPage } from './pages/QuizPage';
import { ResultPage } from './pages/ResultPage';
import { SettingsPage } from './pages/SettingsPage';
import { TopPage } from './pages/TopPage';

export default function App () {
    return (
        <AppProvider>
            <Routes>
                <Route path="/" element={<TopPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/quiz" element={<QuizPage />} />
                <Route path="/result" element={<ResultPage />} />
                <Route path="/ranking" element={<RankingPage />} />
            </Routes>
        </AppProvider>
    );
}
```

---

## 8. `src/pages/TopPage.tsx` を置き換え

```tsx
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
```

---

## 9. `src/pages/SettingsPage.tsx` を置き換え

```tsx
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
```

---

## 10. `src/pages/QuizPage.tsx` を置き換え

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FEEDBACK_DISPLAY_MS } from '../constants/appConstants';
import { useAppContext } from '../context/AppContext';
import type { AnswerResult } from '../types/appTypes';
import {
    buildQuizResult,
    calculateQuestionScore,
    compareAnswer,
    getCourseLabel,
} from '../utils/quizUtils';

type PhaseType = 'countdown' | 'active' | 'feedback';

export function QuizPage () {
    const navigate = useNavigate();
    const {
        currentQuiz,
        finishQuiz,
        clearQuiz,
        startQuiz,
        users,
    } = useAppContext();

    const [phase, setPhase] = useState<PhaseType>('countdown');
    const [countdownValue, setCountdownValue] = useState<number>(3);
    const [currentIndex, setCurrentIndex] = useState<number>(0);
    const [inputValue, setInputValue] = useState<string>('');
    const [answers, setAnswers] = useState<AnswerResult[]>([]);
    const [questionStartedAt, setQuestionStartedAt] = useState<number | null>(null);
    const [pausedAt, setPausedAt] = useState<number | null>(null);
    const [pausedMs, setPausedMs] = useState<number>(0);
    const [nowTick, setNowTick] = useState<number>(Date.now());
    const [feedbackClassName, setFeedbackClassName] = useState<string>('');
    const [feedbackText, setFeedbackText] = useState<string>('');

    const nextTimeoutRef = useRef<number | null>(null);

    const currentQuestion = useMemo(() => {
        if (currentQuiz == null) {
            return null;
        }

        return currentQuiz.questions[currentIndex] ?? null;
    }, [currentQuiz, currentIndex]);

    const elapsedMs = useMemo(() => {
        if (questionStartedAt == null) {
            return 0;
        }

        const effectiveNow = (pausedAt ?? nowTick);
        return Math.max(0, (effectiveNow - questionStartedAt - pausedMs));
    }, [questionStartedAt, pausedAt, nowTick, pausedMs]);

    const remainingMs = useMemo(() => {
        if (
            (currentQuiz == null) ||
            (currentQuiz.settingsSnapshot.timeLimitEnabled === false)
        ) {
            return null;
        }

        const limitMs = (currentQuiz.settingsSnapshot.timeLimitSec * 1000);
        return Math.max(0, (limitMs - elapsedMs));
    }, [currentQuiz, elapsedMs]);

    useEffect(() => {
        return () => {
            if (nextTimeoutRef.current != null) {
                window.clearTimeout(nextTimeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (currentQuiz == null) {
            return;
        }

        setPhase('countdown');
        setCountdownValue(3);
        setCurrentIndex(0);
        setInputValue('');
        setAnswers([]);
        setQuestionStartedAt(null);
        setPausedAt(null);
        setPausedMs(0);
        setNowTick(Date.now());
        setFeedbackClassName('');
        setFeedbackText('');
    }, [currentQuiz?.id]);

    useEffect(() => {
        if (phase !== 'countdown') {
            return;
        }

        if (countdownValue <= 0) {
            setPhase('active');
            setQuestionStartedAt(Date.now());
            setPausedAt(null);
            setPausedMs(0);
            setNowTick(Date.now());
            return;
        }

        const timerId = window.setTimeout(() => {
            setCountdownValue((prev) => {
                return (prev - 1);
            });
        }, 1000);

        return () => {
            window.clearTimeout(timerId);
        };
    }, [phase, countdownValue]);

    const handleSettleCurrentQuestion = useCallback((
        mode: 'submit' | 'timeout'
    ) => {
        if (
            (currentQuiz == null) ||
            (currentQuestion == null) ||
            (phase !== 'active')
        ) {
            return;
        }

        const effectiveElapsedMs = (
            questionStartedAt == null
                ? 0
                : Math.max(0, ((Date.now()) - questionStartedAt - pausedMs))
        );

        const compareResult = (
            mode === 'timeout'
                ? { isCorrect: false, normalizedInput: '(時間切れ)' }
                : compareAnswer(currentQuestion, inputValue)
        );

        const isCorrect = (
            (mode !== 'timeout') &&
            (compareResult.isCorrect === true)
        );

        const answerRecord: AnswerResult = {
            questionId: currentQuestion.id,
            questionText: currentQuestion.expression,
            course: currentQuestion.course,
            userAnswer: (
                mode === 'timeout'
                    ? '(時間切れ)'
                    : (
                        compareResult.normalizedInput.trim().length > 0
                            ? compareResult.normalizedInput
                            : '(未入力)'
                    )
            ),
            correctAnswerText: currentQuestion.correctText,
            isCorrect,
            isTimeout: (mode === 'timeout'),
            elapsedMs: effectiveElapsedMs,
            score: calculateQuestionScore(
                currentQuestion,
                isCorrect,
                effectiveElapsedMs,
                currentQuiz.settingsSnapshot
            ),
        };

        const nextAnswers = [...answers, answerRecord];

        setAnswers(nextAnswers);
        setPhase('feedback');
        setInputValue('');

        if (mode === 'timeout') {
            setFeedbackClassName('feedback-timeout');
            setFeedbackText(`時間切れ！ 正解: ${currentQuestion.correctText}`);
        } else if (isCorrect === true) {
            setFeedbackClassName('feedback-correct');
            setFeedbackText(`正解！ ${answerRecord.score}点`);
        } else {
            setFeedbackClassName('feedback-wrong');
            setFeedbackText(`不正解。正解: ${currentQuestion.correctText}`);
        }

        if (nextTimeoutRef.current != null) {
            window.clearTimeout(nextTimeoutRef.current);
        }

        nextTimeoutRef.current = window.setTimeout(() => {
            if (currentQuiz == null) {
                return;
            }

            const isLastQuestion = ((currentIndex + 1) >= currentQuiz.questions.length);

            if (isLastQuestion === true) {
                const userName = (
                    users.find((user) => {
                        return (user.id === currentQuiz.selectedUserId);
                    })?.name ?? 'ゲスト'
                );

                const result = buildQuizResult(
                    userName,
                    currentQuiz.settingsSnapshot,
                    nextAnswers
                );

                finishQuiz(result);
                navigate('/result');
                return;
            }

            setCurrentIndex((prev) => {
                return (prev + 1);
            });
            setPhase('active');
            setQuestionStartedAt(Date.now());
            setPausedAt(null);
            setPausedMs(0);
            setNowTick(Date.now());
            setFeedbackClassName('');
            setFeedbackText('');
        }, FEEDBACK_DISPLAY_MS);
    }, [
        currentQuiz,
        currentQuestion,
        phase,
        questionStartedAt,
        pausedMs,
        inputValue,
        answers,
        currentIndex,
        users,
        finishQuiz,
        navigate,
    ]);

    useEffect(() => {
        if (
            (phase !== 'active') ||
            (currentQuiz == null) ||
            (questionStartedAt == null) ||
            (pausedAt != null)
        ) {
            return;
        }

        const intervalId = window.setInterval(() => {
            const now = Date.now();
            setNowTick(now);

            if (currentQuiz.settingsSnapshot.timeLimitEnabled === true) {
                const elapsed = Math.max(0, (now - questionStartedAt - pausedMs));
                const limitMs = (currentQuiz.settingsSnapshot.timeLimitSec * 1000);

                if (elapsed >= limitMs) {
                    window.clearInterval(intervalId);
                    handleSettleCurrentQuestion('timeout');
                }
            }
        }, 100);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [
        phase,
        currentQuiz,
        questionStartedAt,
        pausedAt,
        pausedMs,
        handleSettleCurrentQuestion,
    ]);

    function handlePauseToggle (): void {
        if (phase !== 'active') {
            return;
        }

        if (pausedAt == null) {
            setPausedAt(Date.now());
            return;
        }

        const pausedDurationMs = (Date.now() - pausedAt);

        setPausedMs((prev) => {
            return (prev + pausedDurationMs);
        });
        setPausedAt(null);
        setNowTick(Date.now());
    }

    function handleRetry (): void {
        const confirmed = window.confirm('同じ設定で最初からやり直しますか？');

        if (confirmed === false) {
            return;
        }

        const started = startQuiz();

        if (started === true) {
            setFeedbackText('');
            setFeedbackClassName('');
        }
    }

    function handleBackToTop (): void {
        const confirmed = window.confirm('TOPへ戻ります。現在のプレイは終了します。');

        if (confirmed === false) {
            return;
        }

        clearQuiz();
        navigate('/');
    }

    function handleSubmit (event: React.FormEvent<HTMLFormElement>): void {
        event.preventDefault();
        handleSettleCurrentQuestion('submit');
    }

    if ((currentQuiz == null) || (currentQuestion == null)) {
        return (
            <div className="page-container">
                <h1>出題画面</h1>

                <section className="card">
                    <p>開始前です。TOPからコースを選んで開始してください。</p>

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

    const questionNo = (currentIndex + 1);
    const totalQuestions = currentQuiz.questions.length;
    const paused = (pausedAt != null);

    return (
        <div className="page-container">
            <header className="quiz-header">
                <div>
                    <h1>出題画面</h1>
                    <p className="sub-text">
                        {questionNo} / {totalQuestions}問目 ・ {getCourseLabel(currentQuestion.course)}
                    </p>
                </div>

                <div className="button-row">
                    <button
                        type="button"
                        onClick={() => {
                            handlePauseToggle();
                        }}
                    >
                        {paused === true ? '再開' : '一時停止'}
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            handleBackToTop();
                        }}
                    >
                        TOPへ戻る
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            handleRetry();
                        }}
                    >
                        リトライ
                    </button>
                </div>
            </header>

            {phase === 'countdown' && (
                <section className="card">
                    <h2>カウントダウン</h2>
                    <div className="big-display">{countdownValue}</div>
                </section>
            )}

            {phase !== 'countdown' && (
                <>
                    <section className="card">
                        <div className="status-row">
                            <div>
                                <strong>経過時間:</strong> {Math.ceil(elapsedMs / 100) / 10} 秒
                            </div>

                            {remainingMs != null && (
                                <div className="timer-badge">
                                    残り: {Math.ceil(remainingMs / 100) / 10} 秒
                                </div>
                            )}
                        </div>

                        <h2>問題</h2>
                        <div className="question-box">{currentQuestion.expression}</div>

                        {currentQuestion.inputHint != null && (
                            <p className="sub-text">{currentQuestion.inputHint}</p>
                        )}

                        <form onSubmit={handleSubmit}>
                            <label>
                                回答入力
                                <input
                                    className="input-control"
                                    type="text"
                                    value={inputValue}
                                    disabled={(phase !== 'active') || (paused === true)}
                                    placeholder="ここに答えを入力"
                                    onChange={(event) => {
                                        setInputValue(event.target.value);
                                    }}
                                />
                            </label>

                            <div className="button-row top-gap">
                                <button
                                    type="submit"
                                    disabled={(phase !== 'active') || (paused === true)}
                                >
                                    回答する
                                </button>
                            </div>
                        </form>
                    </section>

                    {currentQuiz.settingsSnapshot.handwritingMemoEnabled === true && (
                        <section className="card">
                            <h2>メモ欄（ダミー）</h2>
                            <div className="memo-dummy">
                                将来的にここへ手書きメモを実装
                            </div>
                        </section>
                    )}

                    {feedbackText.length > 0 && (
                        <section className={`card feedback-box ${feedbackClassName}`}>
                            <strong>{feedbackText}</strong>
                        </section>
                    )}

                    {paused === true && (
                        <section className="card paused-box">
                            <strong>一時停止中</strong>
                            <p className="sub-text">「再開」を押すと続きから再開します。</p>
                        </section>
                    )}
                </>
            )}
        </div>
    );
}
```

---

## 11. `src/pages/ResultPage.tsx` を置き換え

```tsx
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
                            <th>No</th>
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
```

---

## 12. `src/pages/RankingPage.tsx` を置き換え

```tsx
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

export function RankingPage () {
    const navigate = useNavigate();
    const { ranking } = useAppContext();

    return (
        <div className="page-container">
            <h1>ランキング</h1>

            <section className="card">
                {ranking.length <= 0 && (
                    <p>まだランキングはありません。</p>
                )}

                {ranking.length > 0 && (
                    <table className="result-table">
                        <thead>
                            <tr>
                                <th>順位</th>
                                <th>ユーザー</th>
                                <th>コース</th>
                                <th>スコア</th>
                                <th>正答率</th>
                                <th>平均時間</th>
                                <th>日時</th>
                            </tr>
                        </thead>

                        <tbody>
                            {ranking.map((entry, index) => {
                                return (
                                    <tr key={entry.id}>
                                        <td>{index + 1}</td>
                                        <td>{entry.userName}</td>
                                        <td>{entry.courseLabel}</td>
                                        <td>{entry.score}</td>
                                        <td>{entry.accuracyRate}%</td>
                                        <td>{entry.averageAnswerMs} ms</td>
                                        <td>{entry.playedAt}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
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
                </div>
            </section>
        </div>
    );
}
```

---

## 13. `src/main.tsx` を確認

前回のままでほぼOKですが、こうなっていれば大丈夫です。

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </React.StrictMode>
);
```

---

## 14. `src/styles.css` を置き換え

```css
:root {
    font-family: Arial, "Yu Gothic", "Hiragino Kaku Gothic ProN", sans-serif;
    color: #222;
    background-color: #f5f7fb;
    line-height: 1.5;
}

* {
    box-sizing: border-box;
}

body {
    margin: 0;
    min-width: 320px;
}

button,
input,
select {
    font: inherit;
}

button {
    cursor: pointer;
    border: 1px solid #c7cbd6;
    border-radius: 8px;
    padding: 10px 16px;
    background-color: #ffffff;
}

button:hover {
    background-color: #f0f4ff;
}

button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
}

.page-container {
    max-width: 980px;
    margin: 0 auto;
    padding: 20px;
}

.card {
    background-color: #ffffff;
    border: 1px solid #d9deea;
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 16px;
}

.card h2 {
    margin-top: 0;
    font-size: 20px;
}

.input-control {
    display: block;
    width: 100%;
    margin-top: 6px;
    padding: 10px;
    border: 1px solid #c7cbd6;
    border-radius: 8px;
    background-color: #ffffff;
}

.form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
}

.check-group {
    display: grid;
    gap: 10px;
}

.single-check {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
}

.button-row {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
}

.quiz-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-bottom: 20px;
}

.big-display {
    font-size: 72px;
    font-weight: bold;
    text-align: center;
    padding: 16px;
}

.question-box {
    font-size: 32px;
    font-weight: bold;
    text-align: center;
    padding: 20px;
    background-color: #f8fbff;
    border: 1px solid #d9deea;
    border-radius: 12px;
    margin-bottom: 16px;
    word-break: break-word;
}

.memo-dummy {
    min-height: 180px;
    border: 2px dashed #9ea8bf;
    border-radius: 12px;
    background-color: #fcfdff;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #6f7890;
    text-align: center;
    padding: 16px;
}

.simple-list {
    margin: 0;
    padding-left: 20px;
}

.sub-text {
    color: #666;
    font-size: 14px;
}

.result-table {
    width: 100%;
    border-collapse: collapse;
}

.result-table th,
.result-table td {
    border: 1px solid #d9deea;
    padding: 8px 10px;
    text-align: left;
    vertical-align: top;
}

.result-table th {
    background-color: #f3f6fc;
}

.status-row {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
}

.timer-badge {
    padding: 6px 10px;
    border-radius: 999px;
    background-color: #eef5ff;
    border: 1px solid #cfe0ff;
}

.feedback-box {
    font-size: 18px;
}

.feedback-correct {
    background-color: #eefcf0;
    border-color: #bfe6c5;
}

.feedback-wrong {
    background-color: #fff4f4;
    border-color: #f0c2c2;
}

.feedback-timeout {
    background-color: #fff6e8;
    border-color: #f0d1a2;
}

.paused-box {
    background-color: #f7f7fb;
}

.top-gap {
    margin-top: 12px;
}

@media (max-width: 640px) {
    .quiz-header {
        flex-direction: column;
    }

    .question-box {
        font-size: 24px;
    }

    .result-table {
        font-size: 13px;
    }
}
```

---

## 15. 起動

```powershell
npm run dev
```

---

## 16. この段階でできること

これで次が通るはずです。

* ユーザーを切り替えると、そのユーザーごとの前回設定が残る
* TOP でコース選択できる
* 設定画面で出題条件を変えられる
* 開始で 3 カウント後に出題開始
* 回答で正解 / 不正解 / 時間切れの表示
* 問題終了後に結果画面へ遷移
* スコアが出る
* ランキング TOP10 が端末保存される

---

## 17. 補足

今回はまず **動く版優先** にしてあります。
そのため、いくつか意図的な簡略化があります。

* 手書きメモはまだダミー表示
* 実数割り算は「小数第2位まで」
* 掛け算は JavaScript の巨大桁あふれ回避のため、内部的に少し安全寄り
* `localStorage` 保存なので、端末をまたいだランキング共有は未対応

---

## 18. 次に進むなら

次の一手はこれが良いです。

* 出題ロジックの微調整
* スコア係数の調整
* メモ欄の Canvas 実装
* `localStorage` → IndexedDB への移行
* PWA の再導入

エラーが出たら、**出たエラーメッセージ全文** と **該当ファイル名** をそのまま貼ってください。
