import { memo, useState, useRef, useCallback, useEffect } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Image, Upload, X, Pencil, RotateCcw, Library, Loader2, Copy, MoreVertical, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { LibraryModal } from './LibraryModal';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface MediaNodeData { label: string; url: string | null; libraryPrompt?: string | null; }

export const MediaNode = memo(({ data, id }: NodeProps) => {
  const nodeData = data as unknown as MediaNodeData;
  const [url, setUrl] = useState(nodeData.url || null);
  const [label, setLabel] = useState(nodeData.label || 'Mídia');
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [activeTab, setActiveTab] = useState<'upload' | 'library'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const { setNodes, setEdges, getNode, getEdges } = useReactFlow();

  useEffect(() => { if (isEditing && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); } }, [isEditing]);

  const handleUrlChange = useCallback((newUrl: string | null, libraryPrompt?: string | null) => {
    setUrl(newUrl);
    setNodes((nodes) => nodes.map((node) => node.id === id ? { ...node, data: { ...node.data, url: newUrl, libraryPrompt: libraryPrompt || null } } : node));
  }, [id, setNodes]);

  const handleReset = useCallback(() => { setUrl(null); setNodes(nodes => nodes.map(n => n.id === id ? { ...n, data: { ...n.data, url: null, libraryPrompt: null } } : n)); setEdges(edges => edges.filter(e => e.source !== id && e.target !== id)); }, [id, setNodes, setEdges]);
  const handleDuplicate = useCallback(() => { const currentNode = getNode(id); if (!currentNode) return; const currentEdges = getEdges(); const newId = `${currentNode.type}-${Date.now()}`; const newNode = { ...currentNode, id: newId, position: { x: currentNode.position.x + 50, y: currentNode.position.y + 50 }, selected: false, data: { ...currentNode.data } }; const connectedEdges = currentEdges.filter(e => e.source === id || e.target === id); const newEdges = connectedEdges.map((edge, i) => ({ ...edge, id: `edge-dup-${Date.now()}-${i}`, source: edge.source === id ? newId : edge.source, target: edge.target === id ? newId : edge.target })); setNodes(nds => [...nds, newNode]); setEdges(eds => [...eds, ...newEdges]); }, [id, getNode, getEdges, setNodes, setEdges]);
  const handleDelete = useCallback(() => { setNodes(nds => nds.filter(n => n.id !== id)); setEdges(eds => eds.filter(e => e.source !== id && e.target !== id)); }, [id, setNodes, setEdges]);
  const handleLabelChange = useCallback((newLabel: string) => { setLabel(newLabel); setNodes(nodes => nodes.map(n => n.id === id ? { ...n, data: { ...n.data, label: newLabel } } : n)); }, [id, setNodes]);
  const handleLabelKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') setIsEditing(false); else if (e.key === 'Escape') { setLabel(nodeData.label || t('editor.media')); setIsEditing(false); } };

  const handleSelectFromLibrary = (image: { image_url: string; prompt: string }) => {
    handleUrlChange(image.image_url, image.prompt); setShowLibrary(false);
    toast({ title: t('editor.image_selected'), description: t('editor.use_copy_button') });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !user) return;
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (fileExt === 'svg') { toast({ title: t('editor.format_not_supported'), description: t('editor.svg_not_supported'), variant: 'destructive' }); return; }
    const MAX_FILE_SIZE = 20 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) { toast({ title: t('editor.file_too_large') || 'Arquivo muito grande', description: `${(file.size / 1024 / 1024).toFixed(1)}MB — máximo permitido: 20MB`, variant: 'destructive' }); return; }
    setIsUploading(true);
    try {
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('reference-images').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('reference-images').getPublicUrl(fileName);
      handleUrlChange(urlData.publicUrl);
      toast({ title: t('editor.image_uploaded') });
    } catch (error) { toast({ title: t('editor.upload_error'), description: (error as Error).message, variant: 'destructive' }); }
    finally { setIsUploading(false); }
  };

  return <div className="bg-card border border-blue-500/30 rounded-2xl min-w-[280px] shadow-2xl shadow-blue-500/10">
    <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" />
    <div className="flex items-center justify-between p-4 border-b border-border/30 bg-gradient-to-r from-blue-500/10 to-transparent rounded-t-2xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-blue-500/30"><Image className="h-5 w-5 text-white" /></div>
        <div>
          {isEditing ? <Input ref={inputRef} value={label} onChange={e => handleLabelChange(e.target.value)} onBlur={() => setIsEditing(false)} onKeyDown={handleLabelKeyDown} className="h-7 w-32 text-sm font-semibold bg-muted/50 border-border/50" onMouseDown={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()} /> : <h3 className="font-semibold text-primary-foreground">{label}</h3>}
          <p className="text-xs text-muted-foreground">{t('editor.reference_image')}</p>
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={handleDuplicate}><Copy className="h-4 w-4 mr-2" />{t('editor.duplicate')}</DropdownMenuItem>
          <DropdownMenuItem onClick={handleReset}><RotateCcw className="h-4 w-4 mr-2" />{t('editor.reset')}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsEditing(true)}><Pencil className="h-4 w-4 mr-2" />{t('editor.rename')}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive"><Trash2 className="h-4 w-4 mr-2" />{t('editor.delete')}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    <div className="p-4 nowheel" onWheel={(e) => e.stopPropagation()}>
      {url ? <div className="relative group rounded-xl overflow-hidden">
        <img src={url} alt="Reference" className="w-full h-40 object-cover" />
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          {nodeData.libraryPrompt && <Button variant="secondary" size="icon" className="h-9 w-9" onClick={() => { navigator.clipboard.writeText(nodeData.libraryPrompt || ''); toast({ title: t('viewer.prompt_copied') }); }}><Copy className="h-4 w-4" /></Button>}
          <Button variant="destructive" size="icon" className="h-9 w-9" onClick={() => handleUrlChange(null)}><X className="h-4 w-4" /></Button>
        </div>
      </div> : <div className="space-y-3 nowheel" onWheel={(e) => e.stopPropagation()}>
        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'upload' | 'library')}>
          <TabsList className="w-full bg-muted/30">
            <TabsTrigger value="upload" className="flex-1 gap-2 data-[state=active]:bg-blue-500/20"><Upload className="h-4 w-4" />{t('editor.upload')}</TabsTrigger>
            <TabsTrigger value="library" className="flex-1 gap-2 data-[state=active]:bg-blue-500/20"><Library className="h-4 w-4" />{t('editor.library')}</TabsTrigger>
          </TabsList>
        </Tabs>
        {activeTab === 'upload' ? <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="w-full border-2 border-dashed border-border/50 rounded-xl p-6 text-center hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group">
          {isUploading ? <Loader2 className="h-8 w-8 mx-auto text-blue-500 animate-spin mb-2" /> : <Upload className="h-8 w-8 mx-auto text-muted-foreground/50 group-hover:text-blue-500 mb-2 transition-colors" />}
          <p className="text-sm text-muted-foreground">{isUploading ? t('editor.sending') : t('editor.click_to_upload')}</p>
        </button> : <button onClick={() => setShowLibrary(true)} className="w-full border-2 border-dashed border-border/50 rounded-xl p-6 text-center hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group">
          <Library className="h-8 w-8 mx-auto text-muted-foreground/50 group-hover:text-blue-500 mb-2 transition-colors" />
          <p className="text-sm text-muted-foreground">{t('editor.choose_from_library')}</p>
        </button>}
      </div>}
    </div>
    <Handle type="source" position={Position.Right} className="!w-4 !h-4 !bg-gradient-to-br !from-blue-500 !to-cyan-600 !border-4 !border-card !-right-2 !shadow-lg" />
    <LibraryModal open={showLibrary} onOpenChange={setShowLibrary} onSelect={handleSelectFromLibrary} />
  </div>;
});
MediaNode.displayName = 'MediaNode';
