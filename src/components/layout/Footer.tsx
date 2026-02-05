import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-border/40 bg-background/50 backdrop-blur-sm">
      <div className="container py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold gradient-text">Avion</span>
          </div>

          {/* Links */}
          <nav className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">
              Início
            </Link>
            <Link to="/library" className="hover:text-foreground transition-colors">
              Biblioteca
            </Link>
            <a href="#" className="hover:text-foreground transition-colors">
              Termos
            </a>
            <a href="#" className="hover:text-foreground transition-colors">
              Privacidade
            </a>
          </nav>

          {/* Copyright */}
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Avion. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
