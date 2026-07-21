import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useAuth } from './lib/auth';
import { CoachPage } from './pages/CoachPage';
import { DashboardPage } from './pages/DashboardPage';
import { GamePage } from './pages/GamePage';
import { GameReportPage } from './pages/GameReportPage';
import { GamesPage } from './pages/GamesPage';
import { LearnPage } from './pages/LearnPage';
import { StudyPage } from './pages/StudyPage';
import { LoginPage } from './pages/LoginPage';
import { OpeningsPage } from './pages/OpeningsPage';
import { ChampionshipsPage } from './pages/ChampionshipsPage';
import { PlayBotPage } from './pages/PlayBotPage';
import { PuzzlesPage } from './pages/PuzzlesPage';
import { SettingsPage } from './pages/SettingsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Загрузка...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="puzzles" element={<PuzzlesPage />} />
        <Route path="play" element={<PlayBotPage />} />
        <Route path="play/:id" element={<GamePage mode="bot" />} />
        <Route path="coach" element={<CoachPage />} />
        <Route path="coach/:id" element={<GamePage mode="coach" />} />
        <Route path="openings" element={<OpeningsPage />} />
        <Route path="championships" element={<ChampionshipsPage />} />
        <Route path="learn" element={<LearnPage />} />
        <Route path="study" element={<StudyPage />} />
        <Route path="games" element={<GamesPage />} />
        <Route path="games/:id" element={<GameReportPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
