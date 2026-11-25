import { Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Interview from './pages/Interview';
import HumanMap from './pages/HumanMap';
import Admin from './pages/Admin';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/interview" element={<Interview />} />
      <Route path="/interview/:id" element={<Interview />} />
      <Route path="/map/:id" element={<HumanMap />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  );
}
