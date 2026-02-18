import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, FileText, LayoutTemplate, ArrowLeft, Check, Lock } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { BuyCreditsModal } from '@/components/BuyCreditsModal';

interface Template { id: string; name: string; description: string | null; thumbnail_url: string | null; allowed_tiers: string[]; }

interface CreateProjectModalProps {
  open: boolean; onOpenChange: (open: boolean) => void;
  onCreateFromScratch: (name: string) => void; onCreateFromTemplate: (name: string, templateId: string) => void;
  isCreating?: boolean; userTier?: string; isAdmin?: boolean;
}

export function CreateProjectModal({ open, onOpenChange, onCreateFromScratch, onCreateFromTemplate, isCreating = false, userTier = 'free', isAdmin = false }: CreateProjectModalProps) {
  const [step, setStep] = useState<'choose' | 'name'>('choose');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [projectName, setProjectName] = useState('');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const { t } = useLanguage();

  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['project-templates-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('project_templates').select('id, name, description, thumbnail_url, allowed_tiers').order('created_at', { ascending: false });
      if (error) throw error;
      return data as Template[];
    },
    enabled: open,
  });

  const isTemplateLocked = (template: Template) => { if (isAdmin) return false; return !template.allowed_tiers.includes(userTier); };
  const handleReset = () => { setStep('choose'); setSelectedTemplate(null); setProjectName(''); };
  const handleClose = () => { handleReset(); onOpenChange(false); };
  const handleSelectFromScratch = () => { setSelectedTemplate(null); setStep('name'); };
  const handleSelectTemplate = (template: Template) => { if (isTemplateLocked(template)) { setShowUpgradeModal(true); return; } setSelectedTemplate(template); setStep('name'); };
  const handleCreate = () => { if (!projectName.trim()) return; if (selectedTemplate) { onCreateFromTemplate(projectName, selectedTemplate.id); } else { onCreateFromScratch(projectName); } };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="glass-card sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{step === 'choose' ? t('create.how_to_start') : t('create.project_name')}</DialogTitle>
            {step === 'choose' && <DialogDescription>{t('create.from_scratch_desc')}</DialogDescription>}
          </DialogHeader>
          {step === 'choose' ? (
            <div className="space-y-6">
              <Button variant="outline" className="w-full h-auto p-6 justify-start gap-4 hover:bg-accent/50 hover:border-primary/50" onClick={handleSelectFromScratch}>
                <div className="p-3 rounded-lg bg-primary/10"><FileText className="h-6 w-6 text-primary" /></div>
                <div className="text-left">
                  <div className="font-semibold">{t('create.from_scratch')}</div>
                  <div className="text-sm text-muted-foreground">{t('create.from_scratch_desc')}</div>
                </div>
              </Button>
              {templatesLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : templates && templates.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <div className="h-px flex-1 bg-border" /><span>{t('create.or_use_template')}</span><div className="h-px flex-1 bg-border" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                    {templates.map((template) => {
                      const locked = isTemplateLocked(template);
                      return (
                        <Card key={template.id} className={`cursor-pointer transition-all group overflow-hidden relative ${locked ? 'opacity-80 hover:border-muted-foreground/50' : 'hover:border-primary/50'}`} onClick={() => handleSelectTemplate(template)}>
                          <div className="aspect-video bg-muted relative overflow-hidden">
                            {template.thumbnail_url ? (
                              <img src={template.thumbnail_url} alt={template.name} className={`w-full h-full object-cover transition-transform ${locked ? 'blur-[2px] brightness-75' : 'group-hover:scale-105'}`} />
                            ) : (
                              <div className={`w-full h-full flex items-center justify-center ${locked ? 'opacity-50' : ''}`}><LayoutTemplate className="h-8 w-8 text-muted-foreground" /></div>
                            )}
                            {locked && <div className="absolute inset-0 flex items-center justify-center"><div className="p-2 rounded-full bg-background/80 backdrop-blur-sm"><Lock className="h-5 w-5 text-muted-foreground" /></div></div>}
                          </div>
                          <CardContent className="p-3">
                            <div className="font-medium text-sm truncate flex items-center gap-1.5">{template.name}{locked && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}</div>
                            {template.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{template.description}</p>}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-4">
              <Button variant="ghost" size="sm" className="gap-2 -ml-2" onClick={() => setStep('choose')}>
                <ArrowLeft className="h-4 w-4" />{t('create.back')}
              </Button>
              {selectedTemplate && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/50 border">
                  <div className="p-2 rounded bg-primary/10"><LayoutTemplate className="h-5 w-5 text-primary" /></div>
                  <div><div className="text-sm font-medium">{t('create.selected_template')}</div><div className="text-xs text-muted-foreground">{selectedTemplate.name}</div></div>
                  <Check className="h-4 w-4 text-primary ml-auto" />
                </div>
              )}
              <Input placeholder={t('create.project_name')} value={projectName} onChange={(e) => setProjectName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreate()} autoFocus />
            </div>
          )}
          {step === 'name' && (
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>{t('common.cancel')}</Button>
              <Button onClick={handleCreate} disabled={isCreating || !projectName.trim()}>
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('create.create')}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
      <BuyCreditsModal open={showUpgradeModal} onOpenChange={setShowUpgradeModal} />
    </>
  );
}
