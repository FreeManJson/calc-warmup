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
    InputMethodType,
    QuizResult,
    QuizSettings,
    RankingEntry,
    UserProfile,
} from '../types/appTypes';
import {
    generateQuestions,
} from '../utils/quizUtils';
import {
    createRankingEntryFromResult,
} from '../utils/scoreUtils';

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
    startQuiz: (overrideSettings?: QuizSettings) => boolean;
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
        const baseUsers = (
            readJson<UserProfile[] | null>(STORAGE_KEYS.users, null) ?? DEFAULT_USERS
        );
        const initialMap = buildInitialSettingsMap(baseUsers);
        const storedMap = readJson<Record<string, unknown> | null>(
            STORAGE_KEYS.settingsByUserId,
            null
        );

        const normalizedStoredMap: Record<string, QuizSettings> = {};

        if (storedMap != null) {
            Object.keys(storedMap).forEach((userId) => {
                normalizedStoredMap[userId] = normalizeQuizSettings(storedMap[userId]);
            });
        }

        return {
            ...initialMap,
            ...normalizedStoredMap,
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

            const normalizedValue = normalizeQuizSettings(resolvedValue);

            return {
                ...prevMap,
                [selectedUserId]: normalizedValue,
            };
        });
    }, [selectedUserId]);

    const startQuiz = useCallback((overrideSettings?: QuizSettings) => {
        const snapshot = normalizeQuizSettings(overrideSettings ?? quizSettings);
        const questions = generateQuestions(snapshot);

        if (questions.length <= 0) {
            return false;
        }

        setSettingsByUserId((prevMap) => {
            return {
                ...prevMap,
                [selectedUserId]: snapshot,
            };
        });

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
        setLatestResult(result);

        if (result.rankingEligible === true) {
            const rankingEntry = createRankingEntryFromResult(result);

            setRanking((prevRanking) => {
                const nextRanking = [...prevRanking, rankingEntry];

                nextRanking.sort((left, right) => {
                    if (left.rankingScore !== right.rankingScore) {
                        return (right.rankingScore - left.rankingScore);
                    }

                    if (left.averageQuestionScore !== right.averageQuestionScore) {
                        return (right.averageQuestionScore - left.averageQuestionScore);
                    }

                    if (left.accuracyRate !== right.accuracyRate) {
                        return (right.accuracyRate - left.accuracyRate);
                    }

                    return (left.averageAnswerMs - right.averageAnswerMs);
                });

                return nextRanking.slice(0, TOP_RANKING_COUNT);
            });
        }

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

function normalizeQuizSettings (raw: unknown): QuizSettings {
    const defaults = createDefaultSettings();
    const value = (typeof raw === 'object' && raw != null)
        ? (raw as Partial<QuizSettings> & {
            firstTermMaxDigits?: number;
            secondTermMaxDigits?: number;
        })
        : {};

    let termMaxDigits = Array.isArray(value.termMaxDigits)
        ? value.termMaxDigits
        : defaults.termMaxDigits;

    if (Array.isArray(value.termMaxDigits) === false) {
        const firstDigits = (
            typeof value.firstTermMaxDigits === 'number'
                ? value.firstTermMaxDigits
                : 2
        );
        const secondDigits = (
            typeof value.secondTermMaxDigits === 'number'
                ? value.secondTermMaxDigits
                : 2
        );

        termMaxDigits = defaults.termMaxDigits.map((_, index) => {
            if (index === 0) {
                return firstDigits;
            }

            return secondDigits;
        });
    }

    const normalizedCourses = normalizeSelectedCourses(value.selectedCourses);
    const normalizedInputMethod = normalizeInputMethod(value.inputMethod);

    return {
        selectedCourses: normalizedCourses,
        maxTerms: (
            typeof value.maxTerms === 'number'
                ? value.maxTerms
                : defaults.maxTerms
        ),
        termMaxDigits: defaults.termMaxDigits.map((defaultDigit, index) => {
            const digit = termMaxDigits[index];
            return (typeof digit === 'number' ? digit : defaultDigit);
        }),
        timeLimitEnabled: (
            typeof value.timeLimitEnabled === 'boolean'
                ? value.timeLimitEnabled
                : defaults.timeLimitEnabled
        ),
        timeLimitSec: (
            typeof value.timeLimitSec === 'number'
                ? value.timeLimitSec
                : defaults.timeLimitSec
        ),
        questionCount: (
            typeof value.questionCount === 'number'
                ? value.questionCount
                : defaults.questionCount
        ),
        allowNegative: (
            typeof value.allowNegative === 'boolean'
                ? value.allowNegative
                : defaults.allowNegative
        ),
        allowDecimal: (
            typeof value.allowDecimal === 'boolean'
                ? value.allowDecimal
                : defaults.allowDecimal
        ),
        allowRemainder: (
            typeof value.allowRemainder === 'boolean'
                ? value.allowRemainder
                : defaults.allowRemainder
        ),
        allowRealDivision: (
            typeof value.allowRealDivision === 'boolean'
                ? value.allowRealDivision
                : defaults.allowRealDivision
        ),
        presetName: (
            typeof value.presetName === 'string'
                ? value.presetName
                : defaults.presetName
        ),
        handwritingMemoEnabled: (
            typeof value.handwritingMemoEnabled === 'boolean'
                ? value.handwritingMemoEnabled
                : defaults.handwritingMemoEnabled
        ),
        inputMethod: normalizedInputMethod,
    };
}

function normalizeSelectedCourses (value: unknown): CourseType[] {
    if (Array.isArray(value) === false) {
        return ['add'];
    }

    const filtered = value.filter((item): item is CourseType => {
        return isCourseType(item);
    });

    return (filtered.length > 0 ? filtered : ['add']);
}

function normalizeInputMethod (value: unknown): InputMethodType {
    if (isInputMethodType(value) === true) {
        return value;
    }

    return 'auto';
}

function isCourseType (value: unknown): value is CourseType {
    return (
        (value === 'add') ||
        (value === 'sub') ||
        (value === 'mul') ||
        (value === 'div')
    );
}

function isInputMethodType (value: unknown): value is InputMethodType {
    return (
        (value === 'auto') ||
        (value === 'keyboard') ||
        (value === 'tile')
    );
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