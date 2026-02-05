import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { Sparkles, User, LogOut, Settings, LayoutGrid, Images, Library, Shield, Coins } from 'lucide-react';

const navItems = [
  { path: '/projects', label: 'Projetos', icon: LayoutGrid },
  { path: '/gallery', label: 'Galeria', icon: Images },
  { path: '/library', label: 'Biblioteca', icon: Library },
];

export function Header() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold gradient-text">Avion</span>
        </Link>

        {/* Navigation */}
        {user && (
          <nav className="flex items-center gap-1 rounded-full bg-muted/50 p-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    size="sm"
                    className={`rounded-full gap-2 ${
                      isActive ? 'bg-primary text-primary-foreground' : ''
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>
        )}

        {/* Right side */}
        <div className="flex items-center gap-4">
          {user ? (
            <>
              {/* Credits */}
              <div className="flex items-center gap-2 rounded-full bg-muted/50 px-4 py-2">
                <Coins className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{profile?.credits ?? 0}</span>
              </div>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {profile?.email?.charAt(0).toUpperCase() ?? 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                  <div className="flex items-center gap-2 p-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                        {profile?.email?.charAt(0).toUpperCase() ?? 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium truncate max-w-[160px]">
                        {profile?.email}
                      </span>
                      <span className="text-xs text-muted-foreground capitalize">
                        {profile?.tier ?? 'free'}
                      </span>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/projects" className="cursor-pointer">
                      <LayoutGrid className="mr-2 h-4 w-4" />
                      Meus Projetos
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/gallery" className="cursor-pointer">
                      <Images className="mr-2 h-4 w-4" />
                      Galeria
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    Configurações
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to="/admin" className="cursor-pointer">
                          <Shield className="mr-2 h-4 w-4" />
                          Admin
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Link to="/auth">
              <Button className="rounded-full glow-primary">
                <User className="mr-2 h-4 w-4" />
                Entrar
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
