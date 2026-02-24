import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Loader2, Mail, Lock, ShieldCheck } from 'lucide-react';
import gravyxLogo from '@/assets/gravyx-logo.webp';
import { useToast } from '@/hooks/use-toast';
import { PLAN_LIMITS, type TierKey } from '@/lib/plan-limits';

const VALID_PLANS: TierKey[] = ['starter', 'premium', 'enterprise'];
const VALID_CYCLES = ['monthly', 'annual'] as const;

export default function Signup() {
  const [isLoading, setIsLoading] = useState(false);
  const { signUp, user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const plan = searchParams.get('plan') as TierKey | null;
  const cycle = searchParams.get('cycle') as string | null;

  const hasPlan = plan && cycle && VALID_PLANS.includes(plan) && VALID_CYCLES.includes(cycle as any);
  const planLabel = hasPlan ? PLAN_LIMITS[plan].label : null;

  const checkoutUrl = hasPlan ? `/checkout?plan=${plan}&cycle=${cycle}` : '/home';

  // If already logged in, go to checkout or home
  useEffect(() => {
    if (user) {
      navigate(checkoutUrl, { replace: true });
    }
  }, [user, navigate, checkoutUrl]);

  const signupSchema = z.object({
    email: z.string().trim().email(t('auth.invalid_email')),
    password: z.string().min(6, t('auth.password_min')),
    confirmPassword: z.string().min(6, t('auth.password_min')),
  }).refine((data) => data.password === data.confirmPassword, {
    message: t('auth.passwords_dont_match') || 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

  type SignupFormData = z.infer<typeof signupSchema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    try {
      const { error } = await signUp(data.email, data.password);
      if (error) {
        if (error.message.includes('already registered') || error.message.includes('User already registered')) {
          toast({
            title: t('auth.email_already_registered'),
            description: t('auth.email_already_registered_desc'),
            variant: 'destructive',
          });
        } else {
          toast({
            title: t('auth.error_create_account'),
            description: error.message,
            variant: 'destructive',
          });
        }
      } else {
        toast({
          title: t('auth.account_created'),
          description: t('auth.check_email'),
        });
        // After signup, user will be auto-logged in (if email confirm is off)
        // or redirected via useEffect when user state updates
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loginUrl = hasPlan
    ? `/auth?redirect=${encodeURIComponent(checkoutUrl)}`
    : '/auth';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background grid-pattern relative overflow-hidden">
      <div className="orb w-96 h-96 bg-primary/30 -top-48 -left-48" />
      <div className="orb w-80 h-80 bg-secondary/30 -bottom-40 -right-40" style={{ animationDelay: '2s' }} />

      <Card className="w-full max-w-md mx-4 glass-card">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={gravyxLogo} alt="Gravyx" className="h-10" />
          </div>
          <CardTitle className="text-2xl gradient-text">
            {t('auth.create_account')}
          </CardTitle>
          <CardDescription>
            {planLabel
              ? `Crie sua conta para assinar o plano ${planLabel}`
              : t('auth.signup_subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder={t('auth.email_placeholder')}
                  className="pl-10"
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-10"
                  {...register('password')}
                />
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  className="pl-10"
                  {...register('confirmPassword')}
                />
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
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
                  {t('auth.creating_account')}
                </>
              ) : (
                t('auth.sign_up')
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link
              to={loginUrl}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('auth.has_account')} <span className="text-primary">{t('auth.sign_in')}</span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
