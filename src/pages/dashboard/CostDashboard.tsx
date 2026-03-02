import { DollarSign } from 'lucide-react';
import DashboardLayout from './DashboardLayout';

export default function CostDashboard() {
  return <DashboardLayout module="cost" label="Cost" icon={DollarSign} iconColor="text-[#FF6A00]" />;
}
