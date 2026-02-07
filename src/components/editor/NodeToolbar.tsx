import { Type, Image, Settings, Sparkles } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface NodeToolbarProps {
  onAddNode: (type: string) => void;
}

const tools = [
  { type: 'prompt', icon: Type, label: 'Prompt', color: 'text-amber-500' },
  { type: 'media', icon: Image, label: 'Mídia', color: 'text-blue-500' },
  { type: 'settings', icon: Settings, label: 'Configurações', color: 'text-slate-400' },
  { type: 'output', icon: Sparkles, label: 'Resultado', color: 'text-emerald-500' },
];

export function NodeToolbar({ onAddNode }: NodeToolbarProps) {
  return (
    <TooltipProvider delayDuration={0}>
      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-2 bg-card/90 backdrop-blur-sm border border-border rounded-xl p-2 shadow-lg">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Tooltip key={tool.type}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onAddNode(tool.type)}
                  className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center transition-all",
                    "bg-muted/50 hover:bg-muted border border-transparent hover:border-border",
                    "hover:scale-105 active:scale-95"
                  )}
                >
                  <Icon className={cn("h-5 w-5", tool.color)} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                <p>{tool.label}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
