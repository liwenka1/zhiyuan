import { create } from "zustand";
import { configIpc } from "@/ipc";
import type { GitHubConfig, GitHubProjectConfigMap } from "@shared";

const EMPTY_GITHUB_CONFIG: GitHubConfig = { owner: "", repo: "", token: "" };

interface GitHubSettingsState extends GitHubConfig {
  projectConfigs: GitHubProjectConfigMap;
  activeProjectKey: string;
  isLoaded: boolean;
  load: (preferredProjectKey?: string) => Promise<void>;
  setActiveProject: (projectKey: string) => Promise<void>;
  createProject: (projectKey: string) => Promise<boolean>;
  removeProject: (projectKey: string) => Promise<void>;
  update: (patch: Partial<GitHubConfig>) => Promise<void>;
}

function resolveActiveConfig(state: Pick<GitHubSettingsState, "projectConfigs" | "activeProjectKey">): GitHubConfig {
  return state.projectConfigs[state.activeProjectKey] ?? EMPTY_GITHUB_CONFIG;
}

function pickActiveProjectKey(params: {
  projectConfigs: GitHubProjectConfigMap;
  preferredProjectKey?: string;
  activeProjectKey?: string;
}): string {
  const keys = Object.keys(params.projectConfigs);
  const preferred = String(params.preferredProjectKey || "").trim();
  const active = String(params.activeProjectKey || "").trim();
  if (preferred && params.projectConfigs[preferred]) return preferred;
  if (active && params.projectConfigs[active]) return active;
  return keys[0] || "";
}

export const useGitHubSettingsStore = create<GitHubSettingsState>((set, get) => ({
  owner: "",
  repo: "",
  token: "",
  projectConfigs: {},
  activeProjectKey: "",
  isLoaded: false,

  load: async (preferredProjectKey) => {
    const payload = await configIpc
      .getGitHubProjectConfigs()
      .catch(() => ({ projectConfigs: {}, activeProjectKey: "" }));
    const activeProjectKey = pickActiveProjectKey({
      projectConfigs: payload.projectConfigs,
      preferredProjectKey,
      activeProjectKey: payload.activeProjectKey
    });
    const activeConfig = payload.projectConfigs[activeProjectKey] ?? EMPTY_GITHUB_CONFIG;
    set({
      projectConfigs: payload.projectConfigs,
      activeProjectKey,
      owner: activeConfig.owner,
      repo: activeConfig.repo,
      token: activeConfig.token,
      isLoaded: true
    });
  },

  setActiveProject: async (projectKey) => {
    const normalizedKey = String(projectKey || "").trim();
    if (!normalizedKey) return;
    const current = get();
    const projectConfigs = { ...current.projectConfigs };
    if (!projectConfigs[normalizedKey]) return;
    await configIpc.setGitHubActiveProjectKey(normalizedKey).catch(() => {});
    const activeConfig = projectConfigs[normalizedKey];
    set({
      projectConfigs,
      activeProjectKey: normalizedKey,
      owner: activeConfig.owner,
      repo: activeConfig.repo,
      token: activeConfig.token
    });
  },

  createProject: async (projectKey) => {
    const normalizedKey = String(projectKey || "").trim();
    if (!normalizedKey) return false;
    if (get().projectConfigs[normalizedKey]) {
      await get().setActiveProject(normalizedKey);
      return false;
    }

    await configIpc.setGitHubConfig(EMPTY_GITHUB_CONFIG, normalizedKey).catch(() => {});
    await configIpc.setGitHubActiveProjectKey(normalizedKey).catch(() => {});
    const projectConfigs = { ...get().projectConfigs, [normalizedKey]: { ...EMPTY_GITHUB_CONFIG } };
    set({
      projectConfigs,
      activeProjectKey: normalizedKey,
      owner: "",
      repo: "",
      token: ""
    });
    return true;
  },

  removeProject: async (projectKey) => {
    const normalizedKey = String(projectKey || "").trim();
    if (!normalizedKey) return;

    const projectConfigs = { ...get().projectConfigs };
    if (!projectConfigs[normalizedKey]) return;

    delete projectConfigs[normalizedKey];
    await configIpc.removeGitHubProjectConfig(normalizedKey).catch(() => {});

    const activeProjectKey = pickActiveProjectKey({
      projectConfigs,
      activeProjectKey: get().activeProjectKey === normalizedKey ? "" : get().activeProjectKey
    });
    await configIpc.setGitHubActiveProjectKey(activeProjectKey).catch(() => {});
    const activeConfig = projectConfigs[activeProjectKey] ?? EMPTY_GITHUB_CONFIG;
    set({
      projectConfigs,
      activeProjectKey,
      owner: activeConfig.owner,
      repo: activeConfig.repo,
      token: activeConfig.token
    });
  },

  update: async (patch) => {
    const current = get();
    if (!current.activeProjectKey) return;
    const next = { ...resolveActiveConfig(current), ...patch };
    const projectConfigs = { ...current.projectConfigs, [current.activeProjectKey]: next };
    set({ ...next, projectConfigs });
    await configIpc.setGitHubConfig(next, current.activeProjectKey).catch(() => {});
  }
}));
