import { create } from "zustand";
import { configIpc } from "@/ipc";
import type { GitHubConfig } from "@shared";

interface GitHubSettingsState extends GitHubConfig {
  isLoaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<GitHubConfig>) => Promise<void>;
}

export const useGitHubSettingsStore = create<GitHubSettingsState>((set, get) => ({
  owner: "",
  repo: "",
  token: "",
  isLoaded: false,

  load: async () => {
    const config = await configIpc.getGitHubConfig().catch(() => ({ owner: "", repo: "", token: "" }));
    set({ ...config, isLoaded: true });
  },

  update: async (patch) => {
    const next = { owner: get().owner, repo: get().repo, token: get().token, ...patch };
    set(next);
    await configIpc.setGitHubConfig(next).catch(() => {});
  }
}));
