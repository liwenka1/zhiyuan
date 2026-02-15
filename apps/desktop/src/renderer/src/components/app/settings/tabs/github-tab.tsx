import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingSection } from "../shared/setting-section";
import { SettingRow } from "../shared/setting-row";
import { Input } from "@/components/ui/input";
import { useGitHubSettingsStore } from "@/stores";

export function GitHubTab() {
  const { t } = useTranslation("common");
  const { owner, repo, token, isLoaded, load, update } = useGitHubSettingsStore();
  const [localOwner, setLocalOwner] = useState("");
  const [localRepo, setLocalRepo] = useState("");
  const [localToken, setLocalToken] = useState("");

  useEffect(() => {
    if (!isLoaded) {
      load();
    }
  }, [isLoaded, load]);

  useEffect(() => {
    setLocalOwner(owner);
    setLocalRepo(repo);
    setLocalToken(token);
  }, [owner, repo, token]);

  const handleBlur = () => {
    if (localOwner !== owner || localRepo !== repo || localToken !== token) {
      update({ owner: localOwner.trim(), repo: localRepo.trim(), token: localToken.trim() });
    }
  };

  return (
    <div>
      <SettingSection title={t("settings.githubSectionTitle")} description={t("settings.githubSectionDesc")}>
        <SettingRow label={t("settings.githubOwner")}>
          <Input
            value={localOwner}
            onChange={(event) => setLocalOwner(event.target.value)}
            onBlur={handleBlur}
            placeholder={t("settings.githubOwnerPlaceholder")}
          />
        </SettingRow>
        <SettingRow label={t("settings.githubRepo")}>
          <Input
            value={localRepo}
            onChange={(event) => setLocalRepo(event.target.value)}
            onBlur={handleBlur}
            placeholder={t("settings.githubRepoPlaceholder")}
          />
        </SettingRow>
        <SettingRow label={t("settings.githubToken")}>
          <Input
            type="password"
            value={localToken}
            onChange={(event) => setLocalToken(event.target.value)}
            onBlur={handleBlur}
            placeholder={t("settings.githubTokenPlaceholder")}
          />
        </SettingRow>
      </SettingSection>
    </div>
  );
}
