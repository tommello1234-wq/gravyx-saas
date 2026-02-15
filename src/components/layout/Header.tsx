import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { User, LogOut, LayoutGrid, Images, Library, Shield, Coins, CreditCard, UserPen, GraduationCap } from 'lucide-react';
import { BuyCreditsModal } from '@/components/BuyCreditsModal';
import { EditProfileModal } from '@/components/EditProfileModal';
import gravyxLogo from '@/assets/gravyx-logo.webp';

const navItems = [
  { path: '/projects', label: 'Projetos', icon: LayoutGrid },
  { path: '/gallery', label: 'Galeria', icon: Images },
  { path: '/library', label: 'Biblioteca', icon: Library },
  { path: 'https://app.upwardacademy.com.br/', label: 'Treinamentos', icon: GraduationCap, external: true },
];

export function Header() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const displayName = profile?.display_name || profile?.email?.split('@')[0] || 'Usuário';
  const avatarUrl = profile?.avatar_url;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link to={user ? "/projects" : "/auth"} className="flex items-center gap-2">
          <img src={gravyxLogo} alt="Gravyx" className="h-8" />
        </Link>

        {/* Navigation */}
        {user && (
          <nav className="flex items-center gap-1 rounded-full bg-muted/50 p-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              if ('external' in item && item.external) {
                return (
                  <a key={item.path} href={item.path} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="sm" className="rounded-full gap-2">
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Button>
                  </a>
                );
              }
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
        <div className="flex items-center gap-3">
          {user ? (
            <>
              {/* Buy Credits Button */}
              <Button
                variant="outline"
                className="rounded-full border-primary/50 hover:bg-primary/10 gap-2"
                onClick={() => setShowBuyCredits(true)}
              >
                <CreditCard className="h-4 w-4" />
                Comprar créditos
              </Button>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                    <Avatar className="h-9 w-9">
                      {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {displayName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                  <div className="flex items-center gap-2 p-2">
                    <Avatar className="h-8 w-8">
                      {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                      <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                        {displayName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium truncate max-w-[160px]">
                        {displayName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {profile?.email}
                      </span>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowEditProfile(true)} className="cursor-pointer">
                    <UserPen className="mr-2 h-4 w-4" />
                    Editar Perfil
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <Coins className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">{profile?.credits ?? 0} créditos</span>
                    </div>
                  </div>
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

      <BuyCreditsModal open={showBuyCredits} onOpenChange={setShowBuyCredits} />
      <EditProfileModal open={showEditProfile} onOpenChange={setShowEditProfile} />
    </header>
  );
}
