import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DollarSign } from 'lucide-react';
import DashboardLayout from './DashboardLayout';

export default function CostDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('module') !== 'cost') {
      setSearchParams({ module: 'cost' });
    }
  }, [searchParams, setSearchParams]);

  return (
    <DashboardLayout
      module="cost"
      label="Cost"
      icon={DollarSign}
      iconColor="text-[#FF6A00]"
    />
  );
}
