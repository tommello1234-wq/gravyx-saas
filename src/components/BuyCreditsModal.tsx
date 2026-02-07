import { motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Coins, Sparkles, Zap, Crown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreditPackage {
  name: string;
  credits: number;
  price: string;
  priceValue: number;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  popular?: boolean;
  benefits: string[];
  cta: string;
}

const packages: CreditPackage[] = [
  {
    name: 'Starter',
    credits: 50,
    price: 'R$ 29,90',
    priceValue: 29.90,
    url: 'https://payment.ticto.app/O7EB601F4',
    icon: Coins,
    benefits: [
      '50 imagens em alta qualidade',
      'Acesso a todos os modelos',
      'Suporte por email',
    ],
    cta: 'Começar agora',
  },
  {
    name: 'Pro',
    credits: 120,
    price: 'R$ 59,90',
    priceValue: 59.90,
    url: 'https://payment.ticto.app/O37CE7121',
    icon: Zap,
    popular: true,
    benefits: [
      '120 imagens em alta qualidade',
      'Acesso a todos os modelos',
      'Prioridade na fila de geração',
      'Suporte prioritário',
    ],
    cta: 'Escolher Pro',
  },
  {
    name: 'Business',
    credits: 400,
    price: 'R$ 149,90',
    priceValue: 149.90,
    url: 'https://payment.ticto.app/OD5F04218',
    icon: Crown,
    benefits: [
      '400 imagens em alta qualidade',
      'Acesso a todos os modelos',
      'Máxima prioridade na geração',
      'Suporte VIP dedicado',
      'Uso comercial liberado',
    ],
    cta: 'Quero ser Business',
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
      <DialogContent className="max-w-4xl bg-card border-border p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            Escolha seu plano
          </DialogTitle>
        </DialogHeader>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {packages.map((pkg, index) => {
              const Icon = pkg.icon;
              return (
                <motion.div
                  key={pkg.credits}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    "relative flex flex-col rounded-2xl border-2 p-6 transition-all",
                    pkg.popular
                      ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                      : "border-border bg-muted/20 hover:border-primary/50"
                  )}
                >
                  {/* Popular badge */}
                  {pkg.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="px-3 py-1 text-xs font-bold rounded-full bg-primary text-primary-foreground">
                        MAIS POPULAR
                      </span>
                    </div>
                  )}

                  {/* Header */}
                  <div className="text-center mb-6">
                    <div
                      className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4",
                        pkg.popular
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Icon className="h-7 w-7" />
                    </div>
                    <h3 className={cn(
                      "text-xl font-bold mb-1",
                      pkg.popular ? "text-primary" : "text-foreground"
                    )}>
                      {pkg.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {pkg.credits} créditos
                    </p>
                  </div>

                  {/* Benefits */}
                  <div className="flex-1 space-y-3 mb-6">
                    {pkg.benefits.map((benefit, i) => (
                      <div key={i} className="flex items-start gap-3">
                        <div className={cn(
                          "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                          pkg.popular ? "bg-primary/20" : "bg-muted"
                        )}>
                          <Check className={cn(
                            "h-3 w-3",
                            pkg.popular ? "text-primary" : "text-muted-foreground"
                          )} />
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {benefit}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Price */}
                  <div className="text-center mb-6">
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-sm text-muted-foreground">R$</span>
                      <span className="text-4xl font-bold text-foreground">
                        {pkg.price.replace('R$ ', '').split(',')[0]}
                      </span>
                      <span className="text-lg text-muted-foreground">
                        ,{pkg.price.split(',')[1]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      R$ {(pkg.priceValue / pkg.credits).toFixed(2).replace('.', ',')} por imagem
                    </p>
                  </div>

                  {/* CTA */}
                  <Button
                    onClick={() => handleBuy(pkg.url)}
                    className={cn(
                      "w-full rounded-xl font-semibold h-12",
                      pkg.popular
                        ? "bg-primary hover:bg-primary/90 text-primary-foreground glow-primary"
                        : "bg-muted hover:bg-muted/80 text-foreground"
                    )}
                  >
                    {pkg.cta}
                  </Button>
                </motion.div>
              );
            })}
          </div>

          <p className="text-xs text-center text-muted-foreground mt-6">
            Pagamento seguro via Ticto. Créditos adicionados automaticamente após confirmação.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
