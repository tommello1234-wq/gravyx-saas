import { Search, Download, Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { useAdminContext, type AdminPeriod, type AdminTierFilter } from './AdminContext';
import { useState } from 'react';
import { format } from 'date-fns';

const periodOptions: { value: AdminPeriod; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
  { value: 'custom', label: 'Personalizado' },
];

const tierOptions: { value: AdminTierFilter; label: string }[] = [
  { value: 'all', label: 'Todos os planos' },
  { value: 'free', label: 'Free' },
  { value: 'starter', label: 'Starter' },
  { value: 'creator', label: 'Creator' },
  { value: 'enterprise', label: 'Enterprise' },
];

interface AdminTopbarProps {
  onExportCSV?: () => void;
  showExport?: boolean;
  title: string;
}

export function AdminTopbar({ onExportCSV, showExport, title }: AdminTopbarProps) {
  const { period, setPeriod, tierFilter, setTierFilter, searchQuery, setSearchQuery, customRange, setCustomRange } = useAdminContext();
  const [calendarOpen, setCalendarOpen] = useState(false);

  return (
    <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/50 px-6 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="text-xl font-bold">{title}</h1>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar usuário..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 w-48"
            />
          </div>

          {/* Period */}
          <Select value={period} onValueChange={(v) => setPeriod(v as AdminPeriod)}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Custom date picker */}
          {period === 'custom' && (
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-2">
                  <Calendar className="h-3.5 w-3.5" />
                  {format(customRange.start, 'dd/MM')} - {format(customRange.end, 'dd/MM')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <CalendarComponent
                  mode="range"
                  selected={{ from: customRange.start, to: customRange.end }}
                  onSelect={(range) => {
                    if (range?.from && range?.to) {
                      setCustomRange({ start: range.from, end: range.to });
                    }
                  }}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          )}

          {/* Tier filter */}
          <Select value={tierFilter} onValueChange={(v) => setTierFilter(v as AdminTierFilter)}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tierOptions.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Export */}
          {showExport && onExportCSV && (
            <Button variant="outline" size="sm" className="h-9 gap-2" onClick={onExportCSV}>
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
