import { motion } from 'framer-motion';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Rocket, Calendar, MessageCircle } from 'lucide-react';
interface BuyCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
export function BuyCreditsModal({
  open,
  onOpenChange
}: BuyCreditsModalProps) {
  const whatsappLink = "https://chat.whatsapp.com/HlrgOxOWRPlLjr0wFXCoff";
  return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-card border-border p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Rocket className="h-5 w-5 text-primary" />
            Lançamento em breve!
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 text-center">
          <motion.div initial={{
          opacity: 0,
          scale: 0.9
        }} animate={{
          opacity: 1,
          scale: 1
        }} className="mb-6">
            {/* Data de lançamento */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-6">
              <Calendar className="h-4 w-4" />
              <span className="font-semibold">14/02/2026</span>
            </div>

            {/* Mensagem principal */}
            <p className="text-lg text-foreground mb-2">
              Lançamento oficial no dia 14/02
            </p>
            <p className="text-muted-foreground mb-6">
              Entre no grupo do WhatsApp para acompanhar as novidades 
              e ganhar mais créditos grátis pra testar!
            </p>

            {/* Botão WhatsApp */}
            <Button onClick={() => window.open(whatsappLink, '_blank')} className="w-full h-12 rounded-xl font-semibold text-white hover:opacity-90" style={{
            background: '#25D366'
          }}>
              <MessageCircle className="h-5 w-5 mr-2" />
              Entrar no Grupo WhatsApp
            </Button>
          </motion.div>

          <p className="text-sm text-muted-foreground">
            Por enquanto, você pode testar com seus 5 créditos gratuitos.
          </p>
        </div>
      </DialogContent>
    </Dialog>;
}