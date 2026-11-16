import { describe, expect, it } from "vitest";
import {
  getGitHubIssueNumberForRepository,
  parseGitHubMetadata,
  stripGitHubMetadata,
  upsertGitHubMetadata
} from "../../apps/desktop/src/renderer/src/lib/github-metadata";

describe("copied note GitHub associations", () => {
  it("removes persisted issue metadata so a reloaded copy chooses a new issue", () => {
    const original = upsertGitHubMetadata("# Original\n\nBody\n", {
      issueNumber: 7,
      issueUrl: "https://github.com/owner/repo/issues/7"
    });
    const copiedOnDisk = stripGitHubMetadata(original);
    expect(copiedOnDisk).toBe("# Original\n\nBody\n");
    expect(getGitHubIssueNumberForRepository(parseGitHubMetadata(copiedOnDisk), "owner", "repo")).toBeUndefined();
    expect(getGitHubIssueNumberForRepository(parseGitHubMetadata(original), "owner", "repo")).toBe(7);
  });

  it("clears all metadata comments without deleting adjacent body text or normal comments", () => {
    const content =
      "before <!-- github-issue-number: 7 --> after\n<!-- keep this comment -->\n<!-- github-issue-url: https://github.com/o/r/issues/7 -->\nBody";
    expect(stripGitHubMetadata(content)).toBe("before  after\n<!-- keep this comment -->\nBody");
    expect(parseGitHubMetadata(stripGitHubMetadata(content))).toEqual({ issueNumber: undefined, issueUrl: undefined });
  });
});
