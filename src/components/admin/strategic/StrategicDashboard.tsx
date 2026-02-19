import { useState } from 'react';
import { useAdminContext } from '../AdminContext';
import { useAdminDashboard } from '../dashboard/useAdminDashboard';
import { AdminTopbar } from '../AdminTopbar';
import { StrategicAlerts } from './StrategicAlerts';
import { GrowthBlock } from './GrowthBlock';
import { ConversionBlock } from './ConversionBlock';
import { RevenueBlock } from './RevenueBlock';
import { UsageCostBlock } from './UsageCostBlock';

export function StrategicDashboard() {
  const { period, tierFilter, customRange } = useAdminContext();
  const [costPerImage, setCostPerImage] = useState(0.30);
  const data = useAdminDashboard(period, tierFilter, customRange, costPerImage);

  return (
    <>
      <AdminTopbar title="Dashboard Estratégico" />
      <div className="p-6 space-y-6 animate-in fade-in duration-500">
        <StrategicAlerts data={data} />
        <GrowthBlock data={data} />
        <ConversionBlock data={data} />
        <RevenueBlock data={data} costPerImage={costPerImage} onCostChange={setCostPerImage} />
        <UsageCostBlock data={data} />
      </div>
    </>
  );
}
