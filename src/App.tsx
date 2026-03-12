import { Routes, Route } from 'react-router-dom';
import { TopPage } from './pages/TopPage';
import { SettingsPage } from './pages/SettingsPage';
import { QuizPage } from './pages/QuizPage';
import { ResultPage } from './pages/ResultPage';
import { RankingPage } from './pages/RankingPage';

export default function App () {
    return (
        <Routes>
            <Route path="/" element={<TopPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/quiz" element={<QuizPage />} />
            <Route path="/result" element={<ResultPage />} />
            <Route path="/ranking" element={<RankingPage />} />
        </Routes>
    );
}