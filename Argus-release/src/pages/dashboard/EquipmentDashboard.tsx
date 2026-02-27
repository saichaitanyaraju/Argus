import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Wrench } from 'lucide-react';
import DashboardLayout from './DashboardLayout';

export default function EquipmentDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('module') !== 'equipment') {
      setSearchParams({ module: 'equipment' });
    }
  }, [searchParams, setSearchParams]);

  return (
    <DashboardLayout
      module="equipment"
      label="Equipment"
      icon={Wrench}
      iconColor="text-yellow-400"
    />
  );
}
