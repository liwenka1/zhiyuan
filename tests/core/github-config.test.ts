import fs from "node:fs";
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

describe("workspace pins", () => {
  it("reads old pin keys that name the same workspace and respects a later explicit unpin", async () => {
    const legacy = "/workspaces/notes";
    const canonical = "/workspaces/Notes";
    savedValues.pinnedNotes = { [legacy]: ["saved.md"] };
    const realpath = vi.spyOn(fs.promises, "realpath").mockResolvedValueOnce(canonical);
    try {
      expect(await configManager.getPinnedNotes(canonical)).toEqual(["saved.md"]);
      expect(realpath).toHaveBeenCalledExactlyOnceWith(legacy);
      configManager.setPinnedNotes(canonical, []);
      expect(await configManager.getPinnedNotes(canonical)).toEqual([]);
      expect(realpath).toHaveBeenCalledOnce();
    } finally {
      realpath.mockRestore();
      savedValues.pinnedNotes = {};
    }
  });

  it("bounds stale pin lookups and still finds a reachable alias", async () => {
    const unavailable = "/volumes/offline/workspace";
    const legacy = "/workspaces/notes";
    const canonical = "/workspaces/Notes";
    savedValues.pinnedNotes = { [unavailable]: ["offline.md"], [legacy]: ["saved.md"] };
    let finishLookup!: (value: string) => void;
    const stalled = new Promise<string>((resolve) => (finishLookup = resolve));
    const realpath = vi.spyOn(fs.promises, "realpath").mockImplementation((workspacePath) => {
      return workspacePath === unavailable ? stalled : Promise.resolve(canonical);
    });
    try {
      await expect(configManager.getPinnedNotes(canonical)).resolves.toEqual(["saved.md"]);
      await expect(configManager.getPinnedNotes("/workspaces/Other")).resolves.toEqual([]);
      expect(realpath.mock.calls.filter(([workspacePath]) => workspacePath === unavailable)).toHaveLength(1);
    } finally {
      finishLookup(unavailable);
      await stalled;
      realpath.mockRestore();
      savedValues.pinnedNotes = {};
    }
  });
});

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
