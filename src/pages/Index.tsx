import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Sparkles, Wand2, Images, Layers, ArrowRight, Zap, Users, ImagePlus } from 'lucide-react';
const stats = [{
  label: 'Imagens geradas',
  value: '10K+',
  icon: Images
}, {
  label: 'Usuários ativos',
  value: '500+',
  icon: Users
}, {
  label: 'Tempo médio',
  value: '<10s',
  icon: Zap
}];
const steps = [{
  icon: Layers,
  title: 'Monte seu fluxo',
  description: 'Arraste e conecte nós para criar seu workflow de geração de imagens.'
}, {
  icon: Wand2,
  title: 'Configure os prompts',
  description: 'Adicione prompts, imagens de referência e ajuste as configurações.'
}, {
  icon: ImagePlus,
  title: 'Gere suas imagens',
  description: 'Clique em gerar e veja a magia acontecer em segundos.'
}];
export default function Index() {
  return <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-32">
        {/* Background effects */}
        <div className="absolute inset-0 grid-pattern opacity-50" />
        <div className="orb w-[600px] h-[600px] bg-primary/20 -top-64 -right-64" />
        <div className="orb w-[500px] h-[500px] bg-secondary/20 -bottom-32 -left-32" style={{
        animationDelay: '3s'
      }} />
        
        <div className="container relative">
          <motion.div initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          duration: 0.6
        }} className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <motion.div initial={{
            opacity: 0,
            scale: 0.9
          }} animate={{
            opacity: 1,
            scale: 1
          }} transition={{
            delay: 0.2
          }} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Alimentado por IA</span>
            </motion.div>

            {/* Title */}
            <h1 className="text-5xl md:text-7xl font-bold mb-6">
              Crie imagens incríveis com{' '}
              <span className="gradient-text">inteligência artificial</span>
            </h1>

            {/* Subtitle */}
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Editor visual baseado em nós para geração de imagens. 
              Monte seu fluxo, configure prompts e gere imagens profissionais em segundos.
            </p>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/auth">
                <Button size="lg" className="rounded-full glow-primary text-lg px-8">
                  Começar agora
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/library">
                <Button size="lg" variant="outline" className="rounded-full text-lg px-8">
                  Ver galeria
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Stats */}
          
        </div>
      </section>

      {/* How it Works */}
      <section className="py-24 relative">
        <div className="container">
          <motion.div initial={{
          opacity: 0,
          y: 20
        }} whileInView={{
          opacity: 1,
          y: 0
        }} viewport={{
          once: true
        }} className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">
              Como <span className="gradient-text">funciona</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Em apenas 3 passos simples, você cria imagens profissionais com IA
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, index) => {
            const Icon = step.icon;
            return <motion.div key={step.title} initial={{
              opacity: 0,
              y: 30
            }} whileInView={{
              opacity: 1,
              y: 0
            }} viewport={{
              once: true
            }} transition={{
              delay: index * 0.2
            }} className="glass-card p-8 text-center relative group">
                  {/* Step number */}
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center text-sm font-bold text-white">
                    {index + 1}
                  </div>
                  
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                    <Icon className="h-8 w-8 text-primary" />
                  </div>
                  
                  <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </motion.div>;
          })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="orb w-[400px] h-[400px] bg-accent/20 top-0 right-0" />
        
        <div className="container relative">
          <motion.div initial={{
          opacity: 0,
          scale: 0.95
        }} whileInView={{
          opacity: 1,
          scale: 1
        }} viewport={{
          once: true
        }} className="glass-card p-12 text-center max-w-3xl mx-auto gradient-border">
            <Sparkles className="h-12 w-12 text-primary mx-auto mb-6" />
            <h2 className="text-4xl font-bold mb-4">
              Pronto para começar?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Assine um plano e comece a criar com 7 dias grátis
            </p>
            <Link to="/auth">
              <Button size="lg" className="rounded-full glow-primary text-lg px-10">
                Começar agora
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>;
}