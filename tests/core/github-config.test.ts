import { beforeEach, describe, expect, it, vi } from "vitest";

const { savedValues } = vi.hoisted(() => ({ savedValues: {} as Record<string, unknown> }));

vi.mock("electron-store", () => ({
  default: class {
    constructor(options: { defaults: Record<string, unknown> }) {
      for (const [key, value] of Object.entries(options.defaults)) {
        if (!(key in savedValues)) savedValues[key] = structuredClone(value);
      }
    }
    get(key: string) {
      return structuredClone(savedValues[key]);
    }
    set(key: string | Record<string, unknown>, value?: unknown) {
      if (typeof key === "string") savedValues[key] = structuredClone(value);
      else Object.assign(savedValues, structuredClone(key));
    }
  }
}));

vi.mock("electron", () => ({
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(`encrypted:${value}`),
    decryptString: (value: Buffer) => value.toString().replace(/^encrypted:/, "")
  }
}));

import { configManager } from "../../apps/desktop/src/main/config";

describe("GitHub project deletion", () => {
  beforeEach(() => {
    savedValues.githubProjects = {};
    savedValues.githubActiveProjectKey = "";
    savedValues.githubDefaultProjectKey = "";
    savedValues.github = { owner: "", repo: "", token: "" };
  });

  it("does not resurrect the last deleted project or its credentials from legacy config", () => {
    configManager.setGitHubConfig({ owner: "owner", repo: "repo", token: "removed-token" }, "project-a");

    configManager.removeGitHubProjectConfig("project-a");

    expect(configManager.getGitHubProjectConfigs()).toEqual({});
    expect(configManager.getGitHubActiveProjectKey()).toBe("");
    expect(configManager.getGitHubConfig()).toEqual({ owner: "", repo: "", token: "" });
    expect(savedValues.githubProjects).toEqual({});
    expect(savedValues.github).toEqual({ owner: "", repo: "", token: "" });
  });

  it("updates the legacy fallback when deleting the active project among several", () => {
    configManager.setGitHubConfig({ owner: "owner-a", repo: "repo-a", token: "token-a" }, "project-a");
    configManager.setGitHubConfig({ owner: "owner-b", repo: "repo-b", token: "token-b" }, "project-b");

    configManager.removeGitHubProjectConfig("project-b");

    expect(configManager.getGitHubActiveProjectKey()).toBe("project-a");
    expect(configManager.getGitHubConfig()).toEqual({ owner: "owner-a", repo: "repo-a", token: "token-a" });
    expect(savedValues.github).toMatchObject({ owner: "owner-a", repo: "repo-a" });
    configManager.removeGitHubProjectConfig("project-a");
    expect(configManager.getGitHubProjectConfigs()).toEqual({});
  });

  it("keeps the selected project and token when deleting a different project", () => {
    configManager.setGitHubConfig({ owner: "owner-a", repo: "repo-a", token: "token-a" }, "project-a");
    configManager.setGitHubConfig({ owner: "owner-b", repo: "repo-b", token: "token-b" }, "project-b");

    configManager.removeGitHubProjectConfig("project-a");

    expect(configManager.getGitHubActiveProjectKey()).toBe("project-b");
    expect(configManager.getGitHubConfig()).toEqual({ owner: "owner-b", repo: "repo-b", token: "token-b" });
  });
});
