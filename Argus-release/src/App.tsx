import { Routes, Route } from 'react-router-dom';
import { ProjectProvider } from './context/ProjectContext';
import Landing from './pages/Landing';
import OverviewDashboard from './pages/dashboard/OverviewDashboard';
import ManpowerDashboard from './pages/dashboard/ManpowerDashboard';
import EquipmentDashboard from './pages/dashboard/EquipmentDashboard';
import ProgressDashboard from './pages/dashboard/ProgressDashboard';
import CostDashboard from './pages/dashboard/CostDashboard';

function App() {
  return (
    <ProjectProvider>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<OverviewDashboard />} />
        <Route path="/dashboard/manpower" element={<ManpowerDashboard />} />
        <Route path="/dashboard/equipment" element={<EquipmentDashboard />} />
        <Route path="/dashboard/progress" element={<ProgressDashboard />} />
        <Route path="/dashboard/cost" element={<CostDashboard />} />
      </Routes>
    </ProjectProvider>
  );
}

export default App;
