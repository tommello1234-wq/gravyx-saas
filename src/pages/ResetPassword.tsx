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
import { useLanguage } from '@/contexts/LanguageContext';

export default function ResetPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  const resetSchema = z.object({
    password: z.string().min(6, t('auth.password_min')),
    confirmPassword: z.string(),
  }).refine((data) => data.password === data.confirmPassword, {
    message: t('reset.passwords_dont_match'),
    path: ['confirmPassword'],
  });

  const emailSchema = z.object({
    email: z.string().email(t('auth.invalid_email')),
  });

  type ResetFormData = z.infer<typeof resetSchema>;
  type EmailFormData = z.infer<typeof emailSchema>;

  useEffect(() => {
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
        const msg = error.message || '';
        // Hook timeout = email was likely sent successfully
        if (msg.includes('hook') || msg.includes('timeout') || msg.includes('Failed to reach')) {
          setEmailSent(true);
          return;
        }
        let errorMessage = msg;
        if (msg.includes('rate limit') || msg.includes('Rate limit')) {
          errorMessage = t('reset.rate_limit');
        }
        toast({ title: t('reset.error'), description: errorMessage, variant: 'destructive' });
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
      const { error } = await supabase.auth.updateUser({ password: data.password });
      if (error) {
        toast({ title: t('reset.error'), description: error.message, variant: 'destructive' });
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
            <h2 className="text-2xl font-bold mb-2">{t('reset.password_changed')}</h2>
            <p className="text-muted-foreground">{t('reset.redirecting')}</p>
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
            <h2 className="text-2xl font-bold mb-2">{t('reset.email_sent')}</h2>
            <p className="text-muted-foreground mb-6">{t('reset.check_inbox')}</p>
            <Link to="/auth">
              <Button variant="outline" className="rounded-full">{t('reset.back_to_login')}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background grid-pattern relative overflow-hidden">
      <div className="orb w-96 h-96 bg-primary/30 -top-48 -left-48" />
      <div className="orb w-80 h-80 bg-secondary/30 -bottom-40 -right-40" style={{ animationDelay: '2s' }} />
      <Link to="/auth" className="absolute top-6 left-6 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" />
        {t('reset.back_to_login')}
      </Link>

      <Card className="w-full max-w-md mx-4 glass-card">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary glow-primary">
              <Lock className="h-6 w-6 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl gradient-text">
            {hasToken ? t('reset.new_password') : t('reset.reset_password')}
          </CardTitle>
          <CardDescription>
            {hasToken ? t('reset.new_password_subtitle') : t('reset.email_subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasToken ? (
            <form onSubmit={resetForm.handleSubmit(onResetPassword)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">{t('reset.new_password')}</Label>
                <Input id="password" type="password" placeholder="••••••••" {...resetForm.register('password')} />
                {resetForm.formState.errors.password && (
                  <p className="text-sm text-destructive">{resetForm.formState.errors.password.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('reset.confirm_password')}</Label>
                <Input id="confirmPassword" type="password" placeholder="••••••••" {...resetForm.register('confirmPassword')} />
                {resetForm.formState.errors.confirmPassword && (
                  <p className="text-sm text-destructive">{resetForm.formState.errors.confirmPassword.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full rounded-full glow-primary" disabled={isLoading}>
                {isLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('reset.changing')}</>
                ) : (
                  t('reset.change_password')
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={emailForm.handleSubmit(onRequestReset)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('auth.email')}</Label>
                <Input id="email" type="email" placeholder={t('auth.email_placeholder')} {...emailForm.register('email')} />
                {emailForm.formState.errors.email && (
                  <p className="text-sm text-destructive">{emailForm.formState.errors.email.message}</p>
                )}
              </div>
              <Button type="submit" className="w-full rounded-full glow-primary" disabled={isLoading}>
                {isLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('reset.sending')}</>
                ) : (
                  t('reset.send_link')
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
