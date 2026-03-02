import { BarChart3 } from 'lucide-react';
import DashboardLayout from './DashboardLayout';

export default function ProgressDashboard() {
  return <DashboardLayout module="progress" label="Work Progress" icon={BarChart3} iconColor="text-green-400" />;
}
