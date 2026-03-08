import { create } from "zustand";
import { configIpc } from "@/ipc";
import type { GitHubConfig, GitHubProjectConfigMap } from "@shared";
import { DEFAULT_GITHUB_PROJECT_KEY } from "@shared";

const EMPTY_GITHUB_CONFIG: GitHubConfig = { owner: "", repo: "", token: "" };

interface GitHubSettingsState extends GitHubConfig {
  projectConfigs: GitHubProjectConfigMap;
  activeProjectKey: string;
  defaultProjectKey: string;
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
  defaultProjectKey?: string;
}): string {
  const keys = Object.keys(params.projectConfigs);
  const preferred = String(params.preferredProjectKey || "").trim();
  const fallbackDefault = String(params.defaultProjectKey || "").trim() || DEFAULT_GITHUB_PROJECT_KEY;
  if (preferred && (params.projectConfigs[preferred] || keys.length === 0)) return preferred;
  if (params.projectConfigs[fallbackDefault]) return fallbackDefault;
  return keys[0] || preferred || fallbackDefault;
}

export const useGitHubSettingsStore = create<GitHubSettingsState>((set, get) => ({
  owner: "",
  repo: "",
  token: "",
  projectConfigs: {},
  activeProjectKey: DEFAULT_GITHUB_PROJECT_KEY,
  defaultProjectKey: DEFAULT_GITHUB_PROJECT_KEY,
  isLoaded: false,

  load: async (preferredProjectKey) => {
    const payload = await configIpc
      .getGitHubProjectConfigs()
      .catch(() => ({ projectConfigs: {}, defaultProjectKey: DEFAULT_GITHUB_PROJECT_KEY }));
    const activeProjectKey = pickActiveProjectKey({
      projectConfigs: payload.projectConfigs,
      preferredProjectKey,
      defaultProjectKey: payload.defaultProjectKey
    });
    const activeConfig = payload.projectConfigs[activeProjectKey] ?? EMPTY_GITHUB_CONFIG;
    set({
      projectConfigs: payload.projectConfigs,
      defaultProjectKey: payload.defaultProjectKey || DEFAULT_GITHUB_PROJECT_KEY,
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
    if (!projectConfigs[normalizedKey]) {
      projectConfigs[normalizedKey] = { ...EMPTY_GITHUB_CONFIG };
      await configIpc.setGitHubConfig(EMPTY_GITHUB_CONFIG, normalizedKey).catch(() => {});
    }
    await configIpc.setGitHubDefaultProjectKey(normalizedKey).catch(() => {});
    const activeConfig = projectConfigs[normalizedKey];
    set({
      projectConfigs,
      activeProjectKey: normalizedKey,
      defaultProjectKey: normalizedKey,
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

    let defaultProjectKey = get().defaultProjectKey;
    if (defaultProjectKey === normalizedKey) {
      defaultProjectKey = Object.keys(projectConfigs)[0] || DEFAULT_GITHUB_PROJECT_KEY;
      await configIpc.setGitHubDefaultProjectKey(defaultProjectKey).catch(() => {});
    }

    const activeProjectKey = pickActiveProjectKey({
      projectConfigs,
      defaultProjectKey,
      preferredProjectKey: get().activeProjectKey === normalizedKey ? defaultProjectKey : get().activeProjectKey
    });
    const activeConfig = projectConfigs[activeProjectKey] ?? EMPTY_GITHUB_CONFIG;
    set({
      projectConfigs,
      defaultProjectKey,
      activeProjectKey,
      owner: activeConfig.owner,
      repo: activeConfig.repo,
      token: activeConfig.token
    });
  },

  update: async (patch) => {
    const current = get();
    const next = { ...resolveActiveConfig(current), ...patch };
    const projectConfigs = { ...current.projectConfigs, [current.activeProjectKey]: next };
    set({ ...next, projectConfigs });
    await configIpc.setGitHubConfig(next, current.activeProjectKey).catch(() => {});
  }
}));
