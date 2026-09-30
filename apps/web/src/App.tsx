import { Route, Routes } from 'react-router-dom';
import { GamesPage } from './pages/GamesPage';
import { HomePage } from './pages/HomePage';
import { MistakeDrillPage } from './pages/MistakeDrillPage';
import { ReviewPage } from './pages/ReviewPage';
import { TrainerPage } from './pages/TrainerPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/review" element={<ReviewPage />} />
      <Route path="/games" element={<GamesPage />} />
      <Route path="/games/drill/:mistakeId" element={<MistakeDrillPage />} />
      <Route path="/openings/:openingId" element={<TrainerPage />} />
    </Routes>
  );
}
