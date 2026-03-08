import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { SettingSection } from "../shared/setting-section";
import { SettingRow } from "../shared/setting-row";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { useGitHubSettingsStore } from "@/stores";
import { DEFAULT_GITHUB_PROJECT_KEY } from "@shared";

export function GitHubTab() {
  const { t } = useTranslation("common");
  const {
    owner,
    repo,
    token,
    projectConfigs,
    activeProjectKey,
    isLoaded,
    load,
    update,
    setActiveProject,
    createProject,
    removeProject
  } = useGitHubSettingsStore();
  const [localOwner, setLocalOwner] = useState("");
  const [localRepo, setLocalRepo] = useState("");
  const [localToken, setLocalToken] = useState("");
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);

  useEffect(() => {
    if (!isLoaded) {
      load();
    }
  }, [isLoaded, load]);

  useEffect(() => {
    setLocalOwner(owner);
    setLocalRepo(repo);
    setLocalToken(token);
  }, [owner, repo, token, activeProjectKey]);

  const projectKeys = Array.from(
    new Set([...Object.keys(projectConfigs), activeProjectKey, DEFAULT_GITHUB_PROJECT_KEY])
  );

  const handleReset = () => {
    setLocalOwner(owner);
    setLocalRepo(repo);
    setLocalToken(token);
  };

  const handleBlur = async () => {
    if (localOwner !== owner || localRepo !== repo || localToken !== token) {
      await update({ owner: localOwner.trim(), repo: localRepo.trim(), token: localToken.trim() });
    }
  };

  const formatProjectLabel = (projectKey: string, index: number) => {
    const config = projectConfigs[projectKey];
    const ownerText = config?.owner?.trim();
    const repoText = config?.repo?.trim();
    if (ownerText && repoText) return `${ownerText}/${repoText}`;
    if (projectKey === DEFAULT_GITHUB_PROJECT_KEY) return t("settings.githubProjectDefault");
    return `${t("settings.githubProjectCurrent")} ${index + 1}`;
  };
  const activeProjectIndex = projectKeys.findIndex((key) => key === activeProjectKey);
  const activeProjectLabel = formatProjectLabel(activeProjectKey, activeProjectIndex >= 0 ? activeProjectIndex : 0);
  const handleCreateProject = async () => {
    let nextIndex = 1;
    let nextKey = `config-${nextIndex}`;
    while (projectConfigs[nextKey]) {
      nextIndex += 1;
      nextKey = `config-${nextIndex}`;
    }
    const created = await createProject(nextKey);
    if (created) {
      toast.success(t("settings.githubProjectCreated"));
    } else {
      toast.success(t("settings.githubProjectSwitched"));
    }
  };

  const handleSwitchProject = async (projectKey: string) => {
    await setActiveProject(projectKey);
  };

  const canRemoveCurrent = activeProjectKey !== DEFAULT_GITHUB_PROJECT_KEY && projectKeys.length > 1;

  return (
    <div>
      <SettingSection title={t("settings.githubSectionTitle")} description={t("settings.githubSectionDesc")}>
        <SettingRow label={t("settings.githubProject")} description={t("settings.githubProjectSelectDesc")}>
          <div className="flex w-full items-center justify-end">
            <Select
              value={activeProjectKey}
              onValueChange={(value) => {
                if (!value) return;
                void handleSwitchProject(value);
              }}
            >
              <SelectTrigger className="w-full" aria-label={t("settings.githubProject")}>
                <SelectValue>{activeProjectLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent align="end">
                <SelectGroup>
                  <SelectLabel>{t("settings.githubProjectSelectTitle")}</SelectLabel>
                  {projectKeys.map((projectKey, index) => (
                    <SelectItem key={projectKey} value={projectKey}>
                      {formatProjectLabel(projectKey, index)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </SettingRow>
        <SettingRow label={t("settings.githubProjectAdd")} description={t("settings.githubProjectAddDesc")}>
          <div className="flex w-full items-center justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={handleCreateProject}>
              {t("settings.githubProjectCreate")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={!canRemoveCurrent}
              onClick={() => setRemoveDialogOpen(true)}
            >
              {t("settings.githubProjectRemoveAction")}
            </Button>
          </div>
        </SettingRow>
        <SettingRow label={t("settings.githubOwner")}>
          <Input
            value={localOwner}
            onChange={(event) => setLocalOwner(event.target.value)}
            onBlur={handleBlur}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                handleReset();
              }
            }}
            placeholder={t("settings.githubOwnerPlaceholder")}
          />
        </SettingRow>
        <SettingRow label={t("settings.githubRepo")}>
          <Input
            value={localRepo}
            onChange={(event) => setLocalRepo(event.target.value)}
            onBlur={handleBlur}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                handleReset();
              }
            }}
            placeholder={t("settings.githubRepoPlaceholder")}
          />
        </SettingRow>
        <SettingRow label={t("settings.githubToken")}>
          <Input
            type="password"
            value={localToken}
            onChange={(event) => setLocalToken(event.target.value)}
            onBlur={handleBlur}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                handleReset();
              }
            }}
            placeholder={t("settings.githubTokenPlaceholder")}
          />
        </SettingRow>
      </SettingSection>
      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings.githubProjectRemoveAction")}</AlertDialogTitle>
            <AlertDialogDescription>{t("settings.githubProjectRemoveConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("settings.githubProjectRemoveCancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                if (!canRemoveCurrent) return;
                await removeProject(activeProjectKey);
                setRemoveDialogOpen(false);
                toast.success(t("settings.githubProjectRemoved"));
              }}
            >
              {t("settings.githubProjectRemoveConfirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
