import { useEffect, useId, useRef } from "react";
import { Tabs } from "@base-ui/react/tabs";
import { ArrowLeft, Github, Info, Keyboard, Share2, SlidersHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AboutTab } from "./tabs/about-tab";
import { ExportTab } from "./tabs/export/export-tab";
import { GeneralTab } from "./tabs/general-tab";
import { GitHubTab } from "./tabs/github-tab";
import { ShortcutsTab } from "./tabs/shortcuts";

const tabs = [
  { id: "general", icon: SlidersHorizontal, Content: GeneralTab },
  { id: "export", icon: Share2, Content: ExportTab },
  { id: "shortcuts", icon: Keyboard, Content: ShortcutsTab },
  { id: "github", icon: Github, Content: GitHubTab },
  { id: "about", icon: Info, Content: AboutTab }
] as const;

export function SettingsPage({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation("common");
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <section
      data-settings-page
      aria-labelledby={titleId}
      className="bg-background @container flex h-full min-h-0 min-w-0 flex-col"
      onKeyDown={(event) => {
        if (
          event.key !== "Escape" ||
          event.defaultPrevented ||
          event.repeat ||
          event.nativeEvent.isComposing ||
          event.nativeEvent.keyCode === 229
        ) {
          return;
        }
        // Portaled dialogs and popups handle Escape themselves.
        if (!event.currentTarget.contains(event.target as Node)) return;
        event.preventDefault();
        event.stopPropagation();
        onBack();
      }}
    >
      <header className="border-border shrink-0 border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 @lg:px-6">
          <h1
            id={titleId}
            ref={titleRef}
            tabIndex={-1}
            className="text-foreground text-base font-semibold outline-none"
          >
            {t("settings.title")}
          </h1>
          <Button type="button" variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft aria-hidden="true" />
            {t("settings.backToNotes")}
          </Button>
        </div>
      </header>

      <Tabs.Root defaultValue="general" className="flex min-h-0 flex-1 flex-col">
        <div className="border-border shrink-0 border-b">
          <Tabs.List
            aria-labelledby={titleId}
            className="mx-auto flex max-w-3xl flex-wrap items-center gap-1 px-4 py-2 @lg:px-6"
          >
            {tabs.map(({ id, icon: Icon }) => (
              <Tabs.Tab
                key={id}
                value={id}
                className="text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:ring-ring/50 data-active:bg-accent data-active:text-accent-foreground inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-sm whitespace-nowrap outline-none focus-visible:ring-2"
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                {t(`settings.${id}`)}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </div>

        {tabs.map(({ id, Content }) => (
          <Tabs.Panel
            key={id}
            value={id}
            className="focus-visible:ring-ring/50 min-h-0 flex-1 outline-none focus-visible:ring-2 focus-visible:ring-inset"
          >
            <ScrollArea className="h-full">
              <div className="mx-auto max-w-3xl px-4 py-5 @lg:px-6">
                <Content />
              </div>
            </ScrollArea>
          </Tabs.Panel>
        ))}
      </Tabs.Root>
    </section>
  );
}
