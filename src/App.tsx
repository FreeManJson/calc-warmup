import { Route, Routes } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AdventurePage } from './pages/AdventurePage';
import { AdventureResultPage } from './pages/AdventureResultPage';
import { RankingPage } from './pages/RankingPage';
import { QuizPage } from './pages/QuizPage';
import { ResultPage } from './pages/ResultPage';
import { SettingsPage } from './pages/SettingsPage';
import { TopPage } from './pages/TopPage';

export default function App () {
    return (
        <AppProvider>
            <div className="app-root notranslate" translate="no">
                <Routes>
                    <Route path="/" element={<TopPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/quiz" element={<QuizPage />} />
                    <Route path="/result" element={<ResultPage />} />
                    <Route path="/ranking" element={<RankingPage />} />
                    <Route path="/adventure" element={<AdventurePage />} />
                    <Route path="/adventure-result" element={<AdventureResultPage />} />
                </Routes>
            </div>
        </AppProvider>
    );
}
