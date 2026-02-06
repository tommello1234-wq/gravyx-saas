import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles, Loader2, Lock, ArrowLeft, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const resetSchema = z.object({
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
});

const emailSchema = z.object({
  email: z.string().email('Email inválido'),
});

type ResetFormData = z.infer<typeof resetSchema>;
type EmailFormData = z.infer<typeof emailSchema>;

export default function ResetPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if there's a recovery token in the URL
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      setHasToken(true);
    }
  }, []);

  const resetForm = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
  });

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
  });

  const onRequestReset = async (data: EmailFormData) => {
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        // Handle rate limit error with a friendly message
        if (error.message.includes('rate limit') || error.message.includes('429')) {
          toast({
            title: 'Muitas tentativas',
            description: 'Você já solicitou a redefinição recentemente. Aguarde alguns minutos antes de tentar novamente.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Erro',
            description: error.message,
            variant: 'destructive',
          });
        }
      } else {
        setEmailSent(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onResetPassword = async (data: ResetFormData) => {
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (error) {
        toast({
          title: 'Erro',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        setResetComplete(true);
        setTimeout(() => navigate('/auth'), 2000);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (resetComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background grid-pattern">
        <Card className="w-full max-w-md mx-4 glass-card">
          <CardContent className="pt-8 text-center">
            <CheckCircle className="h-16 w-16 text-success mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Senha alterada!</h2>
            <p className="text-muted-foreground">Redirecionando para o login...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background grid-pattern">
        <Card className="w-full max-w-md mx-4 glass-card">
          <CardContent className="pt-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 mx-auto mb-4">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Email enviado!</h2>
            <p className="text-muted-foreground mb-6">
              Verifique sua caixa de entrada para redefinir sua senha.
            </p>
            <Link to="/auth">
              <Button variant="outline" className="rounded-full">
                Voltar ao login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background grid-pattern relative overflow-hidden">
      {/* Animated orbs */}
      <div className="orb w-96 h-96 bg-primary/30 -top-48 -left-48" />
      <div className="orb w-80 h-80 bg-secondary/30 -bottom-40 -right-40" style={{ animationDelay: '2s' }} />

      {/* Back link */}
      <Link 
        to="/auth" 
        className="absolute top-6 left-6 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao login
      </Link>

      <Card className="w-full max-w-md mx-4 glass-card">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary glow-primary">
              <Lock className="h-6 w-6 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl gradient-text">
            {hasToken ? 'Nova senha' : 'Redefinir senha'}
          </CardTitle>
          <CardDescription>
            {hasToken 
              ? 'Digite sua nova senha abaixo' 
              : 'Digite seu email para receber o link de redefinição'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasToken ? (
            <form onSubmit={resetForm.handleSubmit(onResetPassword)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nova senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  {...resetForm.register('password')}
                />
                {resetForm.formState.errors.password && (
                  <p className="text-sm text-destructive">
                    {resetForm.formState.errors.password.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  {...resetForm.register('confirmPassword')}
                />
                {resetForm.formState.errors.confirmPassword && (
                  <p className="text-sm text-destructive">
                    {resetForm.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full rounded-full glow-primary" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Alterando...
                  </>
                ) : (
                  'Alterar senha'
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={emailForm.handleSubmit(onRequestReset)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  {...emailForm.register('email')}
                />
                {emailForm.formState.errors.email && (
                  <p className="text-sm text-destructive">
                    {emailForm.formState.errors.email.message}
                  </p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full rounded-full glow-primary" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Enviar link'
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
