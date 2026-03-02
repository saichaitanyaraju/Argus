import { Wrench } from 'lucide-react';
import DashboardLayout from './DashboardLayout';

export default function EquipmentDashboard() {
  return <DashboardLayout module="equipment" label="Equipment" icon={Wrench} iconColor="text-yellow-400" />;
}
