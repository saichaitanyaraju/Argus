import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import DashboardLayout from './DashboardLayout';

export default function ProgressDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('module') !== 'progress') {
      setSearchParams({ module: 'progress' });
    }
  }, [searchParams, setSearchParams]);

  return (
    <DashboardLayout
      module="progress"
      label="Work Progress"
      icon={BarChart3}
      iconColor="text-green-400"
    />
  );
}
