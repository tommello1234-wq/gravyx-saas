import { memo, useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Textarea } from '@/components/ui/textarea';
import { Type } from 'lucide-react';

interface PromptNodeData {
  label: string;
  value: string;
}

export const PromptNode = memo(({ data, id }: NodeProps) => {
  const nodeData = data as unknown as PromptNodeData;
  const [value, setValue] = useState(nodeData.value || '');

  return (
    <div className="glass-card node-prompt min-w-[280px] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Type className="h-4 w-4 text-node-prompt" />
        <span className="font-medium text-sm">Prompt</span>
      </div>
      
      <Textarea
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          (data as Record<string, unknown>).value = e.target.value;
        }}
        placeholder="Descreva a imagem que deseja gerar..."
        className="min-h-[100px] bg-muted/50 border-muted resize-none text-sm"
      />
      
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-node-prompt !border-2 !border-background"
      />
    </div>
  );
});

PromptNode.displayName = 'PromptNode';
