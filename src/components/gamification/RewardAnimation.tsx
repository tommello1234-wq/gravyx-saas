import { motion, AnimatePresence } from 'framer-motion';

interface RewardAnimationProps {
  show: boolean;
  text: string;
  onComplete?: () => void;
}

export function RewardAnimation({ show, text, onComplete }: RewardAnimationProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1, y: 0, scale: 1 }}
          animate={{ opacity: 0, y: -40, scale: 1.3 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          onAnimationComplete={onComplete}
          className="absolute -top-2 left-1/2 -translate-x-1/2 pointer-events-none z-50"
        >
          <span className="text-sm font-bold text-primary whitespace-nowrap">
            {text}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
