import { LayoutDashboard, Users, Images, LayoutTemplate, Settings, PanelLeftClose, PanelLeft } from 'lucide-react';
import { useAdminContext, type AdminSection } from './AdminContext';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import gravyxIcon from '@/assets/gravyx-icon.png';

const navItems: { section: AdminSection; label: string; icon: React.ElementType }[] = [
  { section: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { section: 'users', label: 'Usuários', icon: Users },
  { section: 'library', label: 'Biblioteca', icon: Images },
  { section: 'templates', label: 'Templates', icon: LayoutTemplate },
  { section: 'settings', label: 'Configurações', icon: Settings },
];

export function AdminSidebar() {
  const { activeSection, setActiveSection } = useAdminContext();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        'h-screen sticky top-0 flex flex-col border-r border-border/50 bg-sidebar-background/80 backdrop-blur-xl transition-all duration-300 z-30',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      <div className="flex items-center gap-3 px-4 h-14 border-b border-border/50">
        <img src={gravyxIcon} alt="Gravyx" className="h-7 w-7" />
        {!collapsed && <span className="font-bold text-sm tracking-wide gradient-text">ADMIN</span>}
      </div>

      <nav className="flex-1 py-3 px-2 space-y-1">
        {navItems.map(({ section, label, icon: Icon }) => {
          const active = activeSection === section;
          return (
            <button
              key={section}
              onClick={() => setActiveSection(section)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                active
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', active && 'text-primary')} />
              {!collapsed && <span>{label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="p-2 border-t border-border/50">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>
    </aside>
  );
}
