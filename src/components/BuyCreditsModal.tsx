import { motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Coins, Sparkles, Zap, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreditPackage {
  credits: number;
  price: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  popular?: boolean;
  label: string;
}

const packages: CreditPackage[] = [
  {
    credits: 500,
    price: 'R$ 29,90',
    url: 'https://payment.ticto.app/O7EB601F4',
    icon: Coins,
    label: '50 imagens',
  },
  {
    credits: 1200,
    price: 'R$ 59,90',
    url: 'https://payment.ticto.app/O37CE7121',
    icon: Zap,
    popular: true,
    label: '120 imagens',
  },
  {
    credits: 4000,
    price: 'R$ 149,90',
    url: 'https://payment.ticto.app/OD5F04218',
    icon: Crown,
    label: '400 imagens',
  },
];

interface BuyCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BuyCreditsModal({ open, onOpenChange }: BuyCreditsModalProps) {
  const handleBuy = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            Comprar Créditos
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {packages.map((pkg, index) => {
            const Icon = pkg.icon;
            return (
              <motion.div
                key={pkg.credits}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <button
                  onClick={() => handleBuy(pkg.url)}
                  className={cn(
                    "w-full p-4 rounded-xl border transition-all text-left",
                    "hover:border-primary/50 hover:bg-primary/5",
                    "flex items-center justify-between gap-4",
                    pkg.popular
                      ? "border-primary bg-primary/10"
                      : "border-border bg-muted/30"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center",
                        pkg.popular
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">
                          {pkg.credits} créditos
                        </span>
                        {pkg.popular && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-medium">
                            Mais popular
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{pkg.label}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg text-foreground">{pkg.price}</p>
                    <p className="text-xs text-muted-foreground">
                      R$ {(parseFloat(pkg.price.replace('R$ ', '').replace(',', '.')) / pkg.credits).toFixed(2).replace('.', ',')}/crédito
                    </p>
                  </div>
                </button>
              </motion.div>
            );
          })}
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Os créditos são adicionados automaticamente após a confirmação do pagamento.
        </p>
      </DialogContent>
    </Dialog>
  );
}