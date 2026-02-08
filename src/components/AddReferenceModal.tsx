import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Upload, X, Loader2, Plus, Pencil, Trash2, ChevronDown } from 'lucide-react';

interface ReferenceCategory {
  id: string;
  slug: string;
  label: string;
}

interface AddReferenceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddReferenceModal({ open, onOpenChange }: AddReferenceModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newRef, setNewRef] = useState({ title: '', prompt: '', category: '', image_url: '' });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<ReferenceCategory | null>(null);
  const [editCategoryLabel, setEditCategoryLabel] = useState('');

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['reference-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reference_categories')
        .select('*')
        .order('label', { ascending: true });
      if (error) throw error;
      return data as ReferenceCategory[];
    },
    enabled: open,
  });

  // Create reference mutation
  const createRefMutation = useMutation({
    mutationFn: async (ref: typeof newRef) => {
      const { error } = await supabase
        .from('reference_images')
        .insert({
          title: ref.title,
          prompt: ref.prompt,
          category: ref.category,
          image_url: ref.image_url,
          created_by: user?.id,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['references'] });
      queryClient.invalidateQueries({ queryKey: ['library-images'] });
      onOpenChange(false);
      resetForm();
      toast({ title: 'Referência adicionada!' });
    },
    onError: (error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  // Category mutations
  const createCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const { error } = await supabase
        .from('reference_categories')
        .insert({ slug, label: name });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reference-categories'] });
      setNewCategoryName('');
      toast({ title: 'Categoria criada!' });
    },
    onError: (error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, label }: { id: string; label: string }) => {
      const { error } = await supabase
        .from('reference_categories')
        .update({ label })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reference-categories'] });
      setEditingCategory(null);
      setEditCategoryLabel('');
      toast({ title: 'Categoria atualizada!' });
    },
    onError: (error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reference_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reference-categories'] });
      toast({ title: 'Categoria excluída!' });
    },
    onError: (error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const handleImageUpload = async (file: File) => {
    if (!user) return;
    setUploadingImage(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('reference-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('reference-images')
        .getPublicUrl(fileName);

      setNewRef({ ...newRef, image_url: urlData.publicUrl });
      setPreviewUrl(urlData.publicUrl);
      toast({ title: 'Imagem enviada!' });
    } catch (error) {
      toast({
        title: 'Erro no upload',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
  };

  const clearImage = () => {
    setNewRef({ ...newRef, image_url: '' });
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const resetForm = () => {
    setNewRef({ title: '', prompt: '', category: '', image_url: '' });
    setPreviewUrl(null);
    setCategoriesOpen(false);
    setNewCategoryName('');
    setEditingCategory(null);
  };

  const handleCreateCategory = () => {
    if (newCategoryName.trim()) {
      createCategoryMutation.mutate(newCategoryName.trim());
    }
  };

  const startEditCategory = (cat: ReferenceCategory) => {
    setEditingCategory(cat);
    setEditCategoryLabel(cat.label);
  };

  const handleSaveCategory = () => {
    if (editingCategory && editCategoryLabel.trim()) {
      updateCategoryMutation.mutate({ id: editingCategory.id, label: editCategoryLabel.trim() });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetForm();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar Referência</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Título</Label>
            <Input
              value={newRef.title}
              onChange={(e) => setNewRef({ ...newRef, title: e.target.value })}
              placeholder="Nome da referência"
            />
          </div>

          <div>
            <Label>Prompt</Label>
            <Textarea
              value={newRef.prompt}
              onChange={(e) => setNewRef({ ...newRef, prompt: e.target.value })}
              placeholder="Prompt usado para gerar a imagem"
              rows={3}
            />
          </div>

          <div>
            <Label>Categoria</Label>
            <Select
              value={newRef.category}
              onValueChange={(v) => setNewRef({ ...newRef, category: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.slug}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category Management Collapsible */}
          <Collapsible open={categoriesOpen} onOpenChange={setCategoriesOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground">
                Gerenciar Categorias
                <ChevronDown className={`h-4 w-4 transition-transform ${categoriesOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              {/* Add new category */}
              <div className="flex gap-2">
                <Input
                  placeholder="Nova categoria..."
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateCategory()}
                />
                <Button
                  size="icon"
                  onClick={handleCreateCategory}
                  disabled={!newCategoryName.trim() || createCategoryMutation.isPending}
                >
                  {createCategoryMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Existing categories */}
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => (
                  <div key={cat.id} className="flex items-center gap-1">
                    {editingCategory?.id === cat.id ? (
                      <>
                        <Input
                          className="h-7 w-32 text-sm"
                          value={editCategoryLabel}
                          onChange={(e) => setEditCategoryLabel(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveCategory();
                            if (e.key === 'Escape') setEditingCategory(null);
                          }}
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={handleSaveCategory}
                          disabled={updateCategoryMutation.isPending}
                        >
                          {updateCategoryMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Plus className="h-3 w-3" />
                          )}
                        </Button>
                      </>
                    ) : (
                      <Badge variant="secondary" className="pr-1 gap-1">
                        {cat.label}
                        <button
                          onClick={() => startEditCategory(cat)}
                          className="p-0.5 hover:bg-muted rounded"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => deleteCategoryMutation.mutate(cat.id)}
                          className="p-0.5 hover:bg-destructive/20 rounded text-destructive"
                          disabled={deleteCategoryMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div>
            <Label>Imagem</Label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
            {previewUrl ? (
              <div className="relative mt-2">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-48 object-cover rounded-lg"
                />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8"
                  onClick={clearImage}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="w-full mt-2 border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors"
              >
                <Upload className={`h-8 w-8 mx-auto text-muted-foreground mb-2 ${uploadingImage ? 'animate-pulse' : ''}`} />
                <p className="text-sm text-muted-foreground">
                  {uploadingImage ? 'Enviando...' : 'Clique para upload'}
                </p>
              </button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => createRefMutation.mutate(newRef)}
            disabled={createRefMutation.isPending || !newRef.image_url || !newRef.title || !newRef.category}
          >
            {createRefMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
