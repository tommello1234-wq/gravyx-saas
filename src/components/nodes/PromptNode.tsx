import { memo, useState } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { Textarea } from '@/components/ui/textarea';
import { Type, Pencil, Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PromptNodeData {
  label: string;
  value: string;
}

export const PromptNode = memo(({ data, id }: NodeProps) => {
  const nodeData = data as unknown as PromptNodeData;
  const [value, setValue] = useState(nodeData.value || '');
  const { deleteElements, setNodes, getNodes } = useReactFlow();

  const handleDelete = () => {
    deleteElements({ nodes: [{ id }] });
  };

  const handleDuplicate = () => {
    const nodes = getNodes();
    const currentNode = nodes.find(n => n.id === id);
    if (currentNode) {
      const newNode = {
        ...currentNode,
        id: `prompt-${Date.now()}`,
        position: {
          x: currentNode.position.x + 50,
          y: currentNode.position.y + 50,
        },
        data: { ...currentNode.data },
      };
      setNodes([...nodes, newNode]);
    }
  };

  return (
    <div className="bg-card/95 backdrop-blur-sm border border-border/50 rounded-2xl min-w-[320px] shadow-xl nodrag-content">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
            <Type className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Seu Prompt</h3>
            <p className="text-xs text-muted-foreground">Descreva sua imagem</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={handleDuplicate}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4 space-y-3">
        <label className="text-sm text-muted-foreground">Prompt</label>
        <Textarea
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            (data as Record<string, unknown>).value = e.target.value;
          }}
          placeholder="Crie um cachorro voador..."
          className="min-h-[100px] bg-muted/30 border-border/50 resize-none text-sm rounded-xl focus:ring-violet-500/50 nodrag"
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        />
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        className="!w-4 !h-4 !bg-violet-500 !border-4 !border-background !-right-2"
      />
    </div>
  );
});

PromptNode.displayName = 'PromptNode';
