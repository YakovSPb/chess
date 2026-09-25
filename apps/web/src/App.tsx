import { Route, Routes } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { ReviewPage } from './pages/ReviewPage';
import { TrainerPage } from './pages/TrainerPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/review" element={<ReviewPage />} />
      <Route path="/openings/:openingId" element={<TrainerPage />} />
    </Routes>
  );
}
