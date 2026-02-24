import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Loader2, Mail, Lock } from 'lucide-react';
import gravyxLogo from '@/assets/gravyx-logo.webp';
import { useToast } from '@/hooks/use-toast';

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const urlParams = new URLSearchParams(location.search);
  const redirectParam = urlParams.get('redirect');
  const defaultToSignup = urlParams.get('mode') === 'signup';
  const [isLogin, setIsLogin] = useState(!defaultToSignup);

  const fromLocation = (location.state as { from?: { pathname: string; search?: string } })?.from;
  const from = redirectParam || (fromLocation ? (fromLocation.pathname + (fromLocation.search || '')) : '/home');

  const authSchema = z.object({
    email: z.string().email(t('auth.invalid_email')),
    password: z.string().min(6, t('auth.password_min')),
  });

  type AuthFormData = z.infer<typeof authSchema>;

  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AuthFormData>({
    resolver: zodResolver(authSchema),
  });

  const onSubmit = async (data: AuthFormData) => {
    setIsLoading(true);
    try {
      if (isLogin) {
        const { error } = await signIn(data.email, data.password);
        if (error) {
          toast({
            title: t('auth.error_login'),
            description: error.message === 'Invalid login credentials' 
              ? t('auth.wrong_credentials') 
              : error.message,
            variant: 'destructive',
          });
        } else {
          navigate(from, { replace: true });
        }
      } else {
        const { error } = await signUp(data.email, data.password);
        if (error) {
          if (error.message.includes('already registered') || error.message.includes('User already registered')) {
            toast({
              title: t('auth.email_already_registered'),
              description: t('auth.email_already_registered_desc'),
              variant: 'destructive',
            });
            setIsLogin(true);
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
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

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
            {isLogin ? t('auth.welcome_back') : t('auth.create_account')}
          </CardTitle>
          <CardDescription>
            {isLogin ? t('auth.login_subtitle') : t('auth.signup_subtitle')}
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

            {isLogin && (
              <Link 
                to="/reset-password" 
                className="text-sm text-primary hover:underline block text-right"
              >
                {t('auth.forgot_password')}
              </Link>
            )}

            <Button 
              type="submit" 
              className="w-full rounded-full glow-primary" 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isLogin ? t('auth.signing_in') : t('auth.creating_account')}
                </>
              ) : (
                isLogin ? t('auth.sign_in') : t('auth.sign_up')
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {isLogin ? (
                <>{t('auth.no_account')} <span className="text-primary">{t('auth.create_now')}</span></>
              ) : (
                <>{t('auth.has_account')} <span className="text-primary">{t('auth.sign_in')}</span></>
              )}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
