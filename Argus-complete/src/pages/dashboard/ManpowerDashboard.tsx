import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users } from 'lucide-react';
import DashboardLayout from './DashboardLayout';

export default function ManpowerDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    // Ensure module param is set
    if (searchParams.get('module') !== 'manpower') {
      setSearchParams({ module: 'manpower' });
    }
  }, [searchParams, setSearchParams]);

  return (
    <DashboardLayout
      module="manpower"
      label="Man Power"
      icon={Users}
      iconColor="text-blue-400"
    />
  );
}
