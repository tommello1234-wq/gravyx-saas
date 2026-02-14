import { createContext, useContext, useState, type ReactNode } from 'react';

export type AdminPeriod = 'today' | '7d' | '30d' | '90d' | 'custom';
export type AdminTierFilter = 'all' | 'free' | 'starter' | 'creator' | 'enterprise';
export type AdminSection = 'operations' | 'financial' | 'users' | 'library' | 'templates' | 'settings';

interface AdminContextValue {
  period: AdminPeriod;
  setPeriod: (p: AdminPeriod) => void;
  customRange: { start: Date; end: Date };
  setCustomRange: (r: { start: Date; end: Date }) => void;
  tierFilter: AdminTierFilter;
  setTierFilter: (t: AdminTierFilter) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  activeSection: AdminSection;
  setActiveSection: (s: AdminSection) => void;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdminContext() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdminContext must be used within AdminProvider');
  return ctx;
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const [period, setPeriod] = useState<AdminPeriod>('30d');
  const [customRange, setCustomRange] = useState({ start: new Date(), end: new Date() });
  const [tierFilter, setTierFilter] = useState<AdminTierFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState<AdminSection>('operations');

  return (
    <AdminContext.Provider value={{
      period, setPeriod,
      customRange, setCustomRange,
      tierFilter, setTierFilter,
      searchQuery, setSearchQuery,
      activeSection, setActiveSection,
    }}>
      {children}
    </AdminContext.Provider>
  );
}
