import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreditCard, QrCode, Copy, Check, Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { TierKey } from '@/lib/plan-limits';

interface AsaasTransparentCheckoutProps {
  tier: TierKey;
  cycle: 'monthly' | 'annual';
  price: number;
  credits: number;
  planLabel: string;
  onSuccess: () => void;
}

type CheckoutState = 'form' | 'processing' | 'pix-waiting' | 'success' | 'error';

// Masks
const maskCard = (v: string) => v.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ');
const maskCpfCnpj = (v: string) => {
  const d = v.replace(/\D/g, '');
  if (d.length <= 11) return d.replace(/(\d{3})(\d{3})?(\d{3})?(\d{2})?/, (_m, a, b, c, e) => [a, b, c].filter(Boolean).join('.') + (e ? `-${e}` : ''));
  return d.slice(0, 14).replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};
const maskCep = (v: string) => v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d{1,3})/, '$1-$2');
const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
};
const maskExpiry = (v: string) => v.replace(/\D/g, '').slice(0, 4).replace(/(\d{2})(\d{0,2})/, '$1/$2');

export function AsaasTransparentCheckout({ tier, cycle, price, credits, planLabel, onSuccess }: AsaasTransparentCheckoutProps) {
  const { refreshProfile } = useAuth();
  const [state, setState] = useState<CheckoutState>('form');
  const [tab, setTab] = useState<'pix' | 'card'>('pix');
  const [errorMsg, setErrorMsg] = useState('');

  // PIX state
  const [pixQrCode, setPixQrCode] = useState('');
  const [pixCopyPaste, setPixCopyPaste] = useState('');
  const [pixPaymentId, setPixPaymentId] = useState('');
  const [pixTimer, setPixTimer] = useState(900);
  const [copied, setCopied] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Card form state
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [holderName, setHolderName] = useState('');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [cep, setCep] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [installments, setInstallments] = useState('1');

  // Remote IP
  const [remoteIp, setRemoteIp] = useState('');
  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then(r => r.json())
      .then(d => setRemoteIp(d.ip))
      .catch(() => {});
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // PIX timer
  useEffect(() => {
    if (state !== 'pix-waiting') return;
    timerRef.current = setInterval(() => {
      setPixTimer(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          if (pollingRef.current) clearInterval(pollingRef.current);
          setState('error');
          setErrorMsg('O QR Code PIX expirou. Tente novamente.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [state]);

  // PIX polling
  const startPixPolling = useCallback((paymentId: string) => {
    pollingRef.current = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('credit_purchases')
          .select('id')
          .eq('transaction_id', paymentId)
          .maybeSingle();

        if (!error && data) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          if (timerRef.current) clearInterval(timerRef.current);
          setState('success');
          await refreshProfile();
          setTimeout(() => onSuccess(), 2000);
        }
      } catch {}
    }, 5000);
  }, [refreshProfile, onSuccess]);

  const handlePixPayment = async () => {
    setState('processing');
    setErrorMsg('');
    try {
      const { data, error } = await supabase.functions.invoke('process-asaas-payment', {
        body: { tier, cycle, paymentMethod: 'PIX', cpfCnpj: cpfCnpj.replace(/\D/g, '') },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Erro ao gerar PIX');

      setPixQrCode(data.pixQrCode);
      setPixCopyPaste(data.pixCopyPaste);
      setPixPaymentId(data.paymentId);
      setPixTimer(900);
      setState('pix-waiting');
      startPixPolling(data.paymentId);
    } catch (err: any) {
      setState('error');
      setErrorMsg(err.message || 'Erro ao processar pagamento');
    }
  };

  const handleCardPayment = async () => {
    const cardDigits = cardNumber.replace(/\s/g, '');
    const cpfDigits = cpfCnpj.replace(/\D/g, '');
    const expiryParts = cardExpiry.split('/');

    if (cardDigits.length < 13 || cardDigits.length > 16) { toast.error('Número do cartão inválido'); return; }
    if (expiryParts.length !== 2 || expiryParts[0].length !== 2 || expiryParts[1].length !== 2) { toast.error('Validade inválida'); return; }
    if (cardCvv.length < 3) { toast.error('CVV inválido'); return; }
    if (!cardName.trim()) { toast.error('Nome no cartão obrigatório'); return; }
    if (cpfDigits.length < 11) { toast.error('CPF/CNPJ inválido'); return; }
    if (cep.replace(/\D/g, '').length < 8) { toast.error('CEP inválido'); return; }
    if (!phone.replace(/\D/g, '')) { toast.error('Telefone obrigatório'); return; }

    setState('processing');
    setErrorMsg('');

    try {
      const { data, error } = await supabase.functions.invoke('process-asaas-payment', {
        body: {
          tier, cycle, paymentMethod: 'CREDIT_CARD',
          installmentCount: parseInt(installments),
          creditCard: {
            holderName: cardName,
            number: cardDigits,
            expiryMonth: expiryParts[0],
            expiryYear: `20${expiryParts[1]}`,
            ccv: cardCvv,
          },
          creditCardHolderInfo: {
            name: holderName || cardName,
            cpfCnpj: cpfDigits,
            postalCode: cep.replace(/\D/g, ''),
            addressNumber: addressNumber || 'S/N',
            phone: phone.replace(/\D/g, ''),
          },
          remoteIp,
        },
      });

      if (error) throw new Error(error.message);

      if (data?.success && data?.status === 'CONFIRMED') {
        setState('success');
        await refreshProfile();
        setTimeout(() => onSuccess(), 2000);
      } else {
        setState('error');
        setErrorMsg(data?.message || 'Pagamento não aprovado. Verifique os dados do cartão.');
      }
    } catch (err: any) {
      setState('error');
      setErrorMsg(err.message || 'Erro ao processar pagamento');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(pixCopyPaste);
    setCopied(true);
    toast.success('Código PIX copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTimer = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  // Installments only available for annual plans
  const showInstallments = cycle === 'annual';
  const installmentOptions = showInstallments
    ? Array.from({ length: 12 }, (_, i) => {
        const n = i + 1;
        const v = (price / n).toFixed(2).replace('.', ',');
        return { value: String(n), label: n === 1 ? `1x de R$ ${v} (à vista)` : `${n}x de R$ ${v}` };
      })
    : [{ value: '1', label: `1x de R$ ${price.toFixed(2).replace('.', ',')}` }];

  // --- SUCCESS ---
  if (state === 'success') {
    return (
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center justify-center py-12 gap-4">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.2 }}
          className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center">
          <Check className="h-10 w-10 text-green-400" />
        </motion.div>
        <h3 className="text-xl font-bold text-foreground">Pagamento confirmado!</h3>
        <p className="text-sm text-muted-foreground text-center">
          Seu plano {planLabel} foi ativado com {credits.toLocaleString('pt-BR')} créditos.
        </p>
      </motion.div>
    );
  }

  // --- ERROR ---
  if (state === 'error') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-10 gap-4">
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-red-400" />
        </div>
        <h3 className="text-lg font-bold text-foreground">Erro no pagamento</h3>
        <p className="text-sm text-muted-foreground text-center max-w-sm">{errorMsg}</p>
        <Button onClick={() => { setState('form'); setErrorMsg(''); }} variant="outline" className="mt-2">
          Tentar novamente
        </Button>
      </motion.div>
    );
  }

  // --- PROCESSING ---
  if (state === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Processando pagamento...</p>
      </div>
    );
  }

  // --- PIX WAITING ---
  if (state === 'pix-waiting') {
    return (
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-5 py-4">
        <div className="text-center">
          <h3 className="text-lg font-bold text-foreground mb-1">Pague com PIX</h3>
          <p className="text-2xl font-bold text-primary">R$ {price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>

        {pixQrCode && (
          <div className="bg-white p-4 rounded-xl">
            <img src={`data:image/png;base64,${pixQrCode}`} alt="QR Code PIX" className="w-48 h-48" />
          </div>
        )}

        <div className="w-full space-y-2">
          <Label className="text-xs text-muted-foreground">Código copia e cola</Label>
          <div className="flex gap-2">
            <Input value={pixCopyPaste} readOnly className="bg-muted/30 border-border/40 text-xs font-mono" />
            <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
              {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Expira em</span>
          <span className={`font-mono font-bold ${pixTimer < 120 ? 'text-red-400' : 'text-foreground'}`}>{formatTimer(pixTimer)}</span>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Aguardando confirmação do pagamento...
        </p>
      </motion.div>
    );
  }

  // --- FORM ---
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">{planLabel} — {cycle === 'monthly' ? 'Mensal' : 'Anual'}</p>
          <p className="text-xs text-muted-foreground">{credits.toLocaleString('pt-BR')} créditos</p>
        </div>
        <p className="text-xl font-bold text-primary">R$ {price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'pix' | 'card')} className="w-full">
        <TabsList className="w-full grid grid-cols-2 bg-muted/30 border border-border/40">
          <TabsTrigger value="pix" className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <QrCode className="h-4 w-4" /> PIX
          </TabsTrigger>
          <TabsTrigger value="card" className="gap-2 data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
            <CreditCard className="h-4 w-4" /> Cartão
          </TabsTrigger>
        </TabsList>

        {/* PIX TAB */}
        <TabsContent value="pix" className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">CPF/CNPJ</Label>
            <Input placeholder="000.000.000-00" value={cpfCnpj} onChange={e => setCpfCnpj(maskCpfCnpj(e.target.value))}
              className="bg-muted/30 border-border/40" />
          </div>
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 text-center">
            <p className="text-sm text-muted-foreground mb-1">Valor à vista</p>
            <p className="text-3xl font-bold text-primary">R$ {price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          <Button onClick={handlePixPayment} disabled={cpfCnpj.replace(/\D/g, '').length < 11}
            className="w-full h-12 rounded-xl font-semibold bg-gradient-to-r from-primary to-blue-400 hover:from-primary/90 hover:to-blue-400/90 text-white shadow-lg shadow-primary/20">
            <QrCode className="h-5 w-5 mr-2" />
            Gerar QR Code PIX
          </Button>
        </TabsContent>

        {/* CARD TAB */}
        <TabsContent value="card" className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome no cartão</Label>
            <Input placeholder="NOME COMO NO CARTÃO" value={cardName} onChange={e => setCardName(e.target.value.toUpperCase())}
              className="bg-muted/30 border-border/40" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Número do cartão</Label>
            <Input placeholder="0000 0000 0000 0000" value={cardNumber} onChange={e => setCardNumber(maskCard(e.target.value))}
              className="bg-muted/30 border-border/40 font-mono" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Validade</Label>
              <Input placeholder="MM/AA" value={cardExpiry} onChange={e => setCardExpiry(maskExpiry(e.target.value))}
                className="bg-muted/30 border-border/40 font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">CVV</Label>
              <Input placeholder="000" value={cardCvv} onChange={e => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="bg-muted/30 border-border/40 font-mono" type="password" />
            </div>
          </div>

          <div className="border-t border-border/30 pt-3 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dados do titular</p>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nome completo</Label>
              <Input placeholder="Nome completo do titular" value={holderName} onChange={e => setHolderName(e.target.value)}
                className="bg-muted/30 border-border/40" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">CPF/CNPJ</Label>
              <Input placeholder="000.000.000-00" value={cpfCnpj} onChange={e => setCpfCnpj(maskCpfCnpj(e.target.value))}
                className="bg-muted/30 border-border/40" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs text-muted-foreground">CEP</Label>
                <Input placeholder="00000-000" value={cep} onChange={e => setCep(maskCep(e.target.value))}
                  className="bg-muted/30 border-border/40 font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Nº</Label>
                <Input placeholder="123" value={addressNumber} onChange={e => setAddressNumber(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="bg-muted/30 border-border/40" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Telefone</Label>
              <Input placeholder="(00) 00000-0000" value={phone} onChange={e => setPhone(maskPhone(e.target.value))}
                className="bg-muted/30 border-border/40" />
            </div>
          </div>

          {showInstallments && (
            <div className="border-t border-border/30 pt-3 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Parcelas</Label>
              <Select value={installments} onValueChange={setInstallments}>
                <SelectTrigger className="bg-muted/30 border-border/40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {installmentOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button onClick={handleCardPayment}
            className="w-full h-12 rounded-xl font-semibold bg-gradient-to-r from-primary to-blue-400 hover:from-primary/90 hover:to-blue-400/90 text-white shadow-lg shadow-primary/20">
            <CreditCard className="h-5 w-5 mr-2" />
            Pagar R$ {installments === '1' ? price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : `${(price / parseInt(installments)).toFixed(2).replace('.', ',')} (${installments}x)`}
          </Button>
        </TabsContent>
      </Tabs>

      <div className="flex items-center justify-center gap-2 pt-2">
        <ShieldCheck className="h-4 w-4 text-green-500" />
        <p className="text-xs text-muted-foreground">Pagamento seguro processado via Asaas</p>
      </div>
    </div>
  );
}
