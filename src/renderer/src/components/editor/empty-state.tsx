import { FileText } from "lucide-react";
import { motion } from "motion/react";

export function EmptyEditor() {
  return (
    <motion.div
      className="empty-state text-muted-foreground flex h-full flex-col items-center justify-center"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
      >
        <FileText className="empty-state-icon mb-4 h-16 w-16" />
      </motion.div>
      <motion.h2
        className="text-foreground mb-2 text-3xl font-light tracking-wide"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.15 }}
      >
        纸鸢
      </motion.h2>
      <motion.p
        className="text-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        选择或创建一篇笔记开始写作
      </motion.p>
    </motion.div>
  );
}
