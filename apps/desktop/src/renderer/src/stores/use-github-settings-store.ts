import { create } from "zustand";
import { configIpc } from "@/ipc";
import type { GitHubConfig, GitHubProjectConfigMap } from "@shared";

const EMPTY_GITHUB_CONFIG: GitHubConfig = { owner: "", repo: "", token: "" };

interface GitHubSettingsState extends GitHubConfig {
  projectConfigs: GitHubProjectConfigMap;
  activeProjectKey: string;
  isLoaded: boolean;
  load: (preferredProjectKey?: string) => Promise<void>;
  setActiveProject: (projectKey: string) => Promise<boolean>;
  createProject: (projectKey: string) => Promise<boolean>;
  removeProject: (projectKey: string) => Promise<boolean>;
  update: (patch: Partial<GitHubConfig>) => Promise<boolean>;
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
    if (!normalizedKey) return false;
    const current = get();
    const projectConfigs = { ...current.projectConfigs };
    if (!projectConfigs[normalizedKey]) return false;
    try {
      await configIpc.setGitHubActiveProjectKey(normalizedKey);
    } catch {
      return false;
    }
    const activeConfig = projectConfigs[normalizedKey];
    set({
      projectConfigs,
      activeProjectKey: normalizedKey,
      owner: activeConfig.owner,
      repo: activeConfig.repo,
      token: activeConfig.token
    });
    return true;
  },

  createProject: async (projectKey) => {
    const normalizedKey = String(projectKey || "").trim();
    if (!normalizedKey) return false;
    if (get().projectConfigs[normalizedKey]) {
      await get().setActiveProject(normalizedKey);
      return false;
    }

    try {
      await configIpc.setGitHubConfig(EMPTY_GITHUB_CONFIG, normalizedKey);
      await configIpc.setGitHubActiveProjectKey(normalizedKey);
    } catch {
      await get().load();
      return false;
    }
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
    if (!normalizedKey) return false;

    const projectConfigs = { ...get().projectConfigs };
    if (!projectConfigs[normalizedKey]) return false;

    delete projectConfigs[normalizedKey];
    try {
      await configIpc.removeGitHubProjectConfig(normalizedKey);
    } catch {
      await get().load();
      return false;
    }

    const activeProjectKey = pickActiveProjectKey({
      projectConfigs,
      activeProjectKey: get().activeProjectKey === normalizedKey ? "" : get().activeProjectKey
    });
    try {
      await configIpc.setGitHubActiveProjectKey(activeProjectKey);
    } catch {
      await get().load();
      return false;
    }
    const activeConfig = projectConfigs[activeProjectKey] ?? EMPTY_GITHUB_CONFIG;
    set({
      projectConfigs,
      activeProjectKey,
      owner: activeConfig.owner,
      repo: activeConfig.repo,
      token: activeConfig.token
    });
    return true;
  },

  update: async (patch) => {
    const current = get();
    if (!current.activeProjectKey) return false;
    const next = { ...resolveActiveConfig(current), ...patch };
    try {
      await configIpc.setGitHubConfig(next, current.activeProjectKey);
    } catch {
      await get().load(current.activeProjectKey);
      return false;
    }
    const projectConfigs = { ...current.projectConfigs, [current.activeProjectKey]: next };
    set({ ...next, projectConfigs });
    return true;
  }
}));
