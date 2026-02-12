/**
 * 设置弹窗 — 主壳 + Tab 路由
 */

import { useState } from "react";
import { Settings, Info, SlidersHorizontal, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "react-i18next";
import { GeneralTab } from "./tabs/general-tab";
import { ExportTab } from "./tabs/export/export-tab";
import { AboutTab } from "./tabs/about-tab";

type SettingsTab = "general" | "export" | "about";

export function SettingsPopover() {
  const [tab, setTab] = useState<SettingsTab>("general");
  const { t } = useTranslation("common");

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: "general", label: t("settings.general"), icon: <SlidersHorizontal className="h-4 w-4" /> },
    { id: "export", label: t("settings.export"), icon: <Share2 className="h-4 w-4" /> },
    { id: "about", label: t("settings.about"), icon: <Info className="h-4 w-4" /> }
  ];

  const activeTab = tabs.find((item) => item.id === tab);

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 focus-visible:border-transparent focus-visible:ring-0"
            aria-label={t("settings.title")}
          />
        }
      >
        <Settings className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent className="flex h-[78vh] max-h-[720px] min-h-[520px] gap-0 overflow-hidden p-0 sm:max-w-[860px]">
        <DialogTitle className="sr-only">{t("settings.title")}</DialogTitle>

        {/* 左侧导航 */}
        <nav className="border-border flex w-[200px] shrink-0 flex-col gap-0.5 border-r px-3 py-4">
          {tabs.map((item) => (
            <Button
              key={item.id}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setTab(item.id)}
              className={`h-9 justify-start gap-2.5 rounded-lg px-3 text-sm transition-colors ${
                tab === item.id
                  ? "bg-foreground/6 text-foreground hover:bg-foreground/6 font-medium"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
              aria-pressed={tab === item.id}
            >
              {item.icon}
              {item.label}
            </Button>
          ))}
        </nav>

        {/* 右侧内容 */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* 内容区标题 */}
          <div className="border-border flex shrink-0 items-center gap-2.5 border-b px-8 py-5">
            {activeTab && (
              <>
                <span className="text-muted-foreground">{activeTab.icon}</span>
                <h2 className="text-foreground text-base font-medium">{activeTab.label}</h2>
              </>
            )}
          </div>

          {/* 内容区主体 */}
          <ScrollArea className="min-h-0 flex-1">
            <div className="px-8 py-4 pb-6">
              {tab === "general" && <GeneralTab />}
              {tab === "export" && <ExportTab />}
              {tab === "about" && <AboutTab />}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
