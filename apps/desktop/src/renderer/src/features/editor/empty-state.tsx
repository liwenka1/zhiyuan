import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/icons";

export function EmptyEditor() {
  const { t } = useTranslation("editor");

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
        <Logo className="empty-state-icon mb-4 h-20 w-20" />
      </motion.div>
      <motion.p
        className="text-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        {t("emptyState.title")}
      </motion.p>
    </motion.div>
  );
}
