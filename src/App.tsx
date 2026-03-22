import { Route, Routes } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { AdventureHubPage } from './pages/AdventureHubPage';
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
                    <Route path="/adventure" element={<AdventureHubPage />} />
                    <Route path="/result" element={<ResultPage />} />
                    <Route path="/ranking" element={<RankingPage />} />
                </Routes>
            </div>
        </AppProvider>
    );
}
