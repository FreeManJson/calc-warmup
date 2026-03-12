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