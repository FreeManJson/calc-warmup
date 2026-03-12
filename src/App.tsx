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