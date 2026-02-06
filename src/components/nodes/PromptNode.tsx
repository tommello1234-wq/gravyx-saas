import { memo, useState } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { Textarea } from '@/components/ui/textarea';
import { Type, Copy, Trash2 } from 'lucide-react';
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
    const currentNode = nodes.find((n) => n.id === id);
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
    <div className="bg-card border border-amber-500/30 rounded-2xl min-w-[320px] shadow-2xl shadow-amber-500/10 nodrag-content">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/30 bg-gradient-to-r from-amber-500/10 to-transparent rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
            <Type className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Prompt</h3>
            <p className="text-xs text-muted-foreground">Descreva sua imagem</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/50"
            onClick={handleDuplicate}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={handleDelete}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <Textarea
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            (data as Record<string, unknown>).value = e.target.value;
          }}
          placeholder="Descreva a imagem que você quer criar..."
          className="min-h-[120px] bg-muted/20 border-border/30 resize-none text-sm rounded-xl focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/50 placeholder:text-muted-foreground/50 nodrag"
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        />
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!w-4 !h-4 !bg-gradient-to-br !from-amber-500 !to-orange-600 !border-4 !border-card !-right-2 !shadow-lg"
      />
    </div>
  );
});

PromptNode.displayName = 'PromptNode';