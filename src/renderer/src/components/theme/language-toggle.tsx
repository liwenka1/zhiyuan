import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useState } from "react";

export function LanguageToggle() {
  const [language, setLanguage] = useState("zh");

  const handleToggle = () => {
    setLanguage((prevLanguage) => (prevLanguage === "zh" ? "en" : "zh"));
  };

  // 提示文本
  const tooltipText = language === "zh" ? "中文" : "English";

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleToggle} aria-label="切换语言">
            <Languages className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
