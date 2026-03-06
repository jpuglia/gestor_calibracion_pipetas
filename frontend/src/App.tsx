import './App.css';

import { Route, Routes } from 'react-router-dom';

import Layout from './components/Layout';
import CalibrationForm from './pages/CalibrationForm';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import PipetteCreateForm from './pages/PipetteCreateForm';
import PipetteDetails from './pages/PipetteDetails';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="pipette/new" element={<PipetteCreateForm />} />
        <Route path="pipette/:id" element={<PipetteDetails />} />
        <Route path="calibration" element={<CalibrationForm />} />
      </Route>
    </Routes>
  );
}

export default App;
