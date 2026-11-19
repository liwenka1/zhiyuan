import { describe, expect, it } from "vitest";
import { findWorkspaceSearchResults } from "@/components/app/workspace-search-matches";

describe("workspace name search", () => {
  it("finds both file and folder names without searching parent paths or note contents", () => {
    const folders = [
      { id: "项目/周报归档", name: "项目/周报归档" },
      { id: "周报归档/资料", name: "周报归档/资料" }
    ];
    const notes = [
      { id: "项目/产品周报.MD", fileName: "产品周报.MD", content: "" },
      { id: "周报归档/草稿.md", fileName: "草稿.md", content: "周报" }
    ];

    expect(findWorkspaceSearchResults(folders, notes, " 周报 ")).toEqual({
      folders: [{ kind: "folder", id: "项目/周报归档", name: "周报归档" }],
      files: [{ kind: "file", id: "项目/产品周报.MD", name: "产品周报.MD" }]
    });
    expect(findWorkspaceSearchResults(folders, notes, ".md").files).toHaveLength(2);
    expect(findWorkspaceSearchResults(folders, notes, " ")).toEqual({ folders: [], files: [] });
  });

  it("reserves space for both groups and ranks exact matches ahead of earlier partial matches", () => {
    const folders = Array.from({ length: 20 }, (_, index) => ({
      id: `report-${index}`,
      name: `report-${index}`
    }));
    folders.push({ id: "archive/Report", name: "archive/Report" });
    const notes = [{ id: "inbox/report.md" }];

    const matches = findWorkspaceSearchResults(folders, notes, "report");
    expect(matches.folders).toHaveLength(12);
    expect(matches.folders[0]?.id).toBe("archive/Report");
    expect(matches.files).toEqual([{ kind: "file", id: "inbox/report.md", name: "report.md" }]);
  });

  it("finds a folder or a file beyond the name result cap by its relative path", () => {
    const prefixes = Array.from({ length: 13 }, (_, index) => "archive/team-" + (index + 1));
    const folders = prefixes.map((prefix) => ({ id: prefix + "/Report", name: prefix + "/Report" }));
    const notes = prefixes.map((prefix) => ({ id: prefix + "/Report.md", fileName: "Report.md" }));
    const matches = findWorkspaceSearchResults(folders, notes, "report");
    expect(matches.folders).toHaveLength(12);
    expect(matches.files).toHaveLength(12);
    expect(matches.folders.some(({ id }) => id.startsWith("archive/team-13/"))).toBe(false);
    expect(matches.files.some(({ id }) => id.startsWith("archive/team-13/"))).toBe(false);

    expect(findWorkspaceSearchResults(folders, notes, "./archive/team-13/report.md").files).toEqual([
      { kind: "file", id: "archive/team-13/Report.md", name: "Report.md" }
    ]);
    expect(findWorkspaceSearchResults(folders, notes, "archive\\team-13\\report").folders).toEqual([
      { kind: "folder", id: "archive/team-13/Report", name: "Report" }
    ]);
  });

  it("matches a directory with trailing separators before its descendants", () => {
    const folders = ["reports/weekly", "reports", "archive/Empty", "archive/Reports "].map((id) => ({
      id,
      name: id
    }));
    const notes = [{ id: "reports/weekly/summary.md" }, { id: "unrelated.md" }];

    for (const query of ["reports/", ".\\reports\\", "REPORTS/"]) {
      const matches = findWorkspaceSearchResults(folders, notes, query);
      expect(matches.folders.map(({ id }) => id)).toEqual(["reports", "reports/weekly"]);
      expect(matches.files.map(({ id }) => id)).toEqual(["reports/weekly/summary.md"]);
      expect(matches.filesFirst).toBeUndefined();
    }
    expect(findWorkspaceSearchResults(folders, notes, "./archive/empty//").folders.map(({ id }) => id)).toEqual([
      "archive/Empty"
    ]);
    expect(findWorkspaceSearchResults(folders, notes, "archive\\Reports \\").folders.map(({ id }) => id)).toEqual([
      "archive/Reports "
    ]);
  });

  it("keeps a literal trailing backslash ahead of its Windows directory interpretation", () => {
    const folders = ["reports", "reports\\"].map((id) => ({ id, name: id }));

    for (const query of ["reports\\", "reports\\/"]) {
      expect(findWorkspaceSearchResults(folders, [], query).folders.map(({ id }) => id)).toEqual([
        "reports\\",
        "reports"
      ]);
    }
  });

  it("keeps the literal path ahead of more than twelve case-folded and Unicode-normalized matches", () => {
    const otherFolders = [
      "TEAM",
      "TEAm",
      "TEaM",
      "TEam",
      "TeAM",
      "TeAm",
      "TeaM",
      "Team",
      "tEAM",
      "tEAm",
      "tEaM",
      "tEam"
    ];
    const notes = otherFolders.map((folder) => ({ id: folder + "/cafe\u0301.md" }));
    const literalPath = "team/café.md";
    notes.push({ id: literalPath });

    const matches = findWorkspaceSearchResults([], notes, literalPath).files;
    expect(matches).toHaveLength(12);
    expect(matches[0]?.id).toBe(literalPath);
    expect(matches.filter(({ id }) => id === literalPath)).toHaveLength(1);
  });

  it("can find a root file beyond the name result cap using a leading dot-slash", () => {
    const notes = Array.from({ length: 12 }, (_, index) => ({ id: "folder-" + index + "/README.md" }));
    notes.push({ id: "README.md" });

    expect(findWorkspaceSearchResults([], notes, "README.md").files.some(({ id }) => id === "README.md")).toBe(false);
    expect(findWorkspaceSearchResults([], notes, "./README.md").files[0]?.id).toBe("README.md");
  });

  it("keeps whitespace in literal relative paths before matching the trimmed query", () => {
    const folders = ["archive/Reports", "archive/Reports ", "archive/ Reports", " "].map((id) => ({ id, name: id }));
    const notes = [{ id: "archive/README.md" }, { id: "archive/ README.md" }];

    expect(findWorkspaceSearchResults(folders, notes, "archive/Reports ").folders[0]?.id).toBe("archive/Reports ");
    expect(findWorkspaceSearchResults(folders, notes, "archive\\Reports ").folders[0]?.id).toBe("archive/Reports ");
    expect(findWorkspaceSearchResults(folders, notes, "./archive/ Reports").folders[0]?.id).toBe("archive/ Reports");
    expect(findWorkspaceSearchResults(folders, notes, "./archive/ README.md").files[0]?.id).toBe("archive/ README.md");
    expect(findWorkspaceSearchResults(folders, notes, " Reports ").folders[0]?.id).toBe("archive/Reports");
    expect(findWorkspaceSearchResults(folders, notes, "./").folders).toEqual([]);
    expect(findWorkspaceSearchResults(folders, notes, "./ ").folders.map(({ id }) => id)).toEqual([" "]);
  });

  it("prioritizes root names with literal whitespace and otherwise preserves basename ordering", () => {
    const folders = ["archive/Reports", "Reports", "Reports ", " "].map((id) => ({ id, name: id }));
    const notes = [{ id: "archive/README.md" }, { id: "README.md" }, { id: " README.md" }];

    expect(findWorkspaceSearchResults(folders, notes, "Reports ").folders[0]?.id).toBe("Reports ");
    expect(findWorkspaceSearchResults(folders, notes, " README.md").files[0]?.id).toBe(" README.md");
    expect(findWorkspaceSearchResults(folders, notes, " Reports ").folders[0]?.id).toBe("archive/Reports");
    expect(findWorkspaceSearchResults(folders, notes, "Reports").folders[0]?.id).toBe("archive/Reports");
    expect(findWorkspaceSearchResults(folders, notes, " ").folders).toEqual([]);
  });

  it("ranks literal backslashes in folder and file names before a Windows-style path match", () => {
    const folders = ["a/b", "nested/a\\b", "a\\b"].map((path) => ({ id: path, name: path }));
    const notes = [
      { id: "a/b.md", fileName: "b.md" },
      { id: "nested/a\\b.md", fileName: "a\\b.md" },
      { id: "a\\b.md", fileName: "a\\b.md" }
    ];

    expect(findWorkspaceSearchResults(folders, notes, "a\\b").folders.map(({ id }) => id)).toEqual([
      "a\\b",
      "nested/a\\b",
      "a/b"
    ]);
    expect(findWorkspaceSearchResults(folders, notes, "a\\b.md").files.map(({ id }) => id)).toEqual([
      "a\\b.md",
      "nested/a\\b.md",
      "a/b.md"
    ]);
    expect(findWorkspaceSearchResults(folders, notes, "./a\\b.md").files[0]?.id).toBe("a\\b.md");
    expect(findWorkspaceSearchResults(folders, notes, "a/b.md").files[0]?.id).toBe("a/b.md");
  });

  it("matches nested literal backslashes and folds case and Unicode without losing Windows path search", () => {
    const folders = ["nested/a/b", "nested/a\\b", "ordinary/folder"].map((path) => ({ id: path, name: path }));
    const notes = [{ id: "nested/a/café.md" }, { id: "nested/a\\cafe\u0301.md" }, { id: "ordinary/folder/report.md" }];

    expect(findWorkspaceSearchResults(folders, notes, "nested/a\\b").folders.map(({ id }) => id)).toEqual([
      "nested/a\\b",
      "nested/a/b"
    ]);
    expect(findWorkspaceSearchResults(folders, notes, "NESTED/A\\CAFÉ.MD").files.map(({ id }) => id)).toEqual([
      "nested/a\\cafe\u0301.md",
      "nested/a/café.md"
    ]);
    expect(
      findWorkspaceSearchResults(folders, notes, ".\\ordinary\\folder\\report.md").files.map(({ id }) => id)
    ).toEqual(["ordinary/folder/report.md"]);
  });

  it("keeps exact literal and Windows-style paths ahead of capped partial matches", () => {
    const notes = Array.from({ length: 12 }, (_, index) => ({ id: "nested/" + index + "-a\\b.md" }));
    notes.push({ id: "a/b.md" }, { id: "a\\b.md" });

    const matches = findWorkspaceSearchResults([], notes, "a\\b.md").files;
    expect(matches).toHaveLength(12);
    expect(matches.slice(0, 2).map(({ id }) => id)).toEqual(["a\\b.md", "a/b.md"]);
  });

  it("prefers the group with an exact path while keeping folder-first order for name-only searches", () => {
    const folders = [{ id: "archive/README.md-backup", name: "archive/README.md-backup" }];
    const notes = [{ id: "archive/README.md" }];

    expect(findWorkspaceSearchResults(folders, notes, "archive/README.md").filesFirst).toBe(true);
    expect(findWorkspaceSearchResults(folders, notes, "archive\\README.md").filesFirst).toBe(true);
    expect(findWorkspaceSearchResults(folders, notes, "README.md").filesFirst).toBeUndefined();

    folders.push({ id: "archive\\README.md", name: "archive\\README.md" });
    expect(findWorkspaceSearchResults(folders, notes, "archive\\README.md").filesFirst).toBeUndefined();
  });
});
