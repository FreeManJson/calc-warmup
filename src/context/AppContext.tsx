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
    CourseType,
    CurrentQuiz,
    QuizResult,
    QuizSettings,
    RankingEntry,
    UserProfile,
} from '../types/appTypes';
import {
    generateQuestions,
} from '../utils/quizUtils';

interface AddUserResult {
    ok: boolean;
    message?: string;
}

interface DeleteUserResult {
    ok: boolean;
    message?: string;
}

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
    addUser: (name: string) => AddUserResult;
    deleteUser: (userId: string) => DeleteUserResult;
    clearRanking: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

const DEFAULT_USERS = createDefaultUsers();

export function AppProvider (
    { children }: { children: React.ReactNode }
) {
    const [users, setUsers] = useState<UserProfile[]>(() => {
        const storedUsers = readJson<UserProfile[] | null>(
            STORAGE_KEYS.users,
            null
        );

        if ((storedUsers == null) || (storedUsers.length <= 0)) {
            return DEFAULT_USERS;
        }

        return storedUsers;
    });

    const [selectedUserId, setSelectedUserIdState] = useState<string>(() => {
        const storedUserId = readJson<string | null>(
            STORAGE_KEYS.selectedUserId,
            null
        );

        if ((storedUserId != null) && (storedUserId.length > 0)) {
            return storedUserId;
        }

        return DEFAULT_USERS[0].id;
    });

    const [settingsByUserId, setSettingsByUserId] = useState<Record<string, QuizSettings>>(() => {
        const initialMap = buildInitialSettingsMap(
            readJson<UserProfile[] | null>(STORAGE_KEYS.users, null) ?? DEFAULT_USERS
        );
        const storedMap = readJson<Record<string, QuizSettings> | null>(
            STORAGE_KEYS.settingsByUserId,
            null
        );

        return {
            ...initialMap,
            ...(storedMap ?? {}),
        };
    });

    const [ranking, setRanking] = useState<RankingEntry[]>(() => {
        return readJson<RankingEntry[]>(STORAGE_KEYS.ranking, []);
    });

    const [latestResult, setLatestResult] = useState<QuizResult | null>(() => {
        return readJson<QuizResult | null>(STORAGE_KEYS.latestResult, null);
    });

    const [currentQuiz, setCurrentQuiz] = useState<CurrentQuiz | null>(null);

    useEffect(() => {
        if (users.length <= 0) {
            setUsers(DEFAULT_USERS);
            return;
        }

        const exists = users.some((user) => {
            return (user.id === selectedUserId);
        });

        if (exists === false) {
            setSelectedUserIdState(users[0].id);
        }
    }, [users, selectedUserId]);

    useEffect(() => {
        setSettingsByUserId((prevMap) => {
            const nextMap = { ...prevMap };

            users.forEach((user) => {
                if (nextMap[user.id] == null) {
                    nextMap[user.id] = createDefaultSettings();
                }
            });

            Object.keys(nextMap).forEach((userId) => {
                const exists = users.some((user) => {
                    return (user.id === userId);
                });

                if (exists === false) {
                    delete nextMap[userId];
                }
            });

            return nextMap;
        });
    }, [users]);

    useEffect(() => {
        writeJson(STORAGE_KEYS.users, users);
    }, [users]);

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

    const quizSettings = (
        settingsByUserId[selectedUserId] ?? createDefaultSettings()
    );

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
            const normalizedCourses: CourseType[] = (
                resolvedValue.selectedCourses.length > 0
                    ? resolvedValue.selectedCourses
                    : ['add']
            );

            return {
                ...prevMap,
                [selectedUserId]: {
                    ...resolvedValue,
                    selectedCourses: normalizedCourses,
                },
            };
        });
    }, [selectedUserId]);

    const startQuiz = useCallback(() => {
        const normalizedCourses: CourseType[] = (
            quizSettings.selectedCourses.length > 0
                ? quizSettings.selectedCourses
                : ['add']
        );

        const snapshot: QuizSettings = {
            ...quizSettings,
            selectedCourses: [...normalizedCourses],
            termMaxDigits: [...quizSettings.termMaxDigits],
        };

        const questions = generateQuestions(snapshot);

        if (questions.length <= 0) {
            return false;
        }

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

    const addUser = useCallback((name: string): AddUserResult => {
        const trimmed = name.trim();

        if (trimmed.length <= 0) {
            return {
                ok: false,
                message: 'ユーザー名を入力してください。',
            };
        }

        const exists = users.some((user) => {
            return (user.name.toLowerCase() === trimmed.toLowerCase());
        });

        if (exists === true) {
            return {
                ok: false,
                message: '同名ユーザーが既に存在します。',
            };
        }

        const newUser: UserProfile = {
            id: `user-${Date.now()}`,
            name: trimmed,
        };

        setUsers((prevUsers) => {
            return [...prevUsers, newUser];
        });

        setSettingsByUserId((prevMap) => {
            return {
                ...prevMap,
                [newUser.id]: createDefaultSettings(),
            };
        });

        setSelectedUserIdState(newUser.id);

        return {
            ok: true,
        };
    }, [users]);

    const deleteUser = useCallback((userId: string): DeleteUserResult => {
        if (users.length <= 1) {
            return {
                ok: false,
                message: '最後の1ユーザーは削除できません。',
            };
        }

        const targetUser = users.find((user) => {
            return (user.id === userId);
        });

        if (targetUser == null) {
            return {
                ok: false,
                message: '削除対象ユーザーが見つかりません。',
            };
        }

        const nextUsers = users.filter((user) => {
            return (user.id !== userId);
        });

        setUsers(nextUsers);

        setSettingsByUserId((prevMap) => {
            const nextMap = { ...prevMap };
            delete nextMap[userId];
            return nextMap;
        });

        setRanking((prevRanking) => {
            return prevRanking.filter((entry) => {
                return (entry.userName !== targetUser.name);
            });
        });

        if (selectedUserId === userId) {
            setSelectedUserIdState(nextUsers[0].id);
        }

        return {
            ok: true,
        };
    }, [users, selectedUserId]);

    const clearRanking = useCallback(() => {
        setRanking([]);
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
            addUser,
            deleteUser,
            clearRanking,
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
        addUser,
        deleteUser,
        clearRanking,
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