import { randomUUID } from "node:crypto";
import path from "node:path";
import { getGitHubIssueNumberForRepository, parseGitHubMetadata } from "@shared";

type PublicationSender = Pick<Electron.WebContents, "id" | "isDestroyed" | "once" | "off">;
type Association = { issueNumber: number; issueUrl: string };
type PathChange = { path: string; includeDescendants: boolean };

function identityPath(value: string): string {
  return process.platform === "win32" ? value.toLowerCase() : value;
}

function includesPath(change: PathChange, candidate: string): boolean {
  return candidate === change.path || (change.includeDescendants && candidate.startsWith(`${change.path}${path.sep}`));
}

interface PublicationLease {
  id: string;
  key: string;
  sourcePath: string;
  owner: string;
  repo: string;
  sender: PublicationSender;
  remoteFinished: boolean;
  abandoned: boolean;
  onDestroyed: () => void;
}

/** One main-process lease spans the remote request and the renderer's metadata save. */
export class PublicationLeases {
  private readonly active = new Map<string, PublicationLease>();
  private readonly byId = new Map<string, PublicationLease>();
  private readonly pathChanges = new Set<PathChange>();
  // A remote create may succeed before local saving fails or its renderer exits.
  // Keep that association available to retries instead of creating another Issue.
  private readonly uncommitted = new Map<string, Association>();

  acquire(sourcePath: string, owner: string, repo: string, sender: PublicationSender): PublicationLease {
    const fileKey = identityPath(sourcePath);
    const key = JSON.stringify([fileKey, owner.toLowerCase(), repo.toLowerCase()]);
    if (this.active.has(key)) throw new Error("This file is already being published in another window.");
    if ([...this.pathChanges].some((change) => includesPath(change, fileKey))) {
      throw new Error("This file is being moved or deleted in another window.");
    }
    if (sender.isDestroyed()) throw new Error("The publishing window is closed.");

    const lease: PublicationLease = {
      id: randomUUID(),
      key,
      sourcePath,
      owner,
      repo,
      sender,
      remoteFinished: false,
      abandoned: false,
      onDestroyed: () => {
        lease.abandoned = true;
        // A create already in flight must finish before another renderer can retry.
        if (lease.remoteFinished) this.remove(lease);
      }
    };
    this.active.set(key, lease);
    this.byId.set(lease.id, lease);
    sender.once("destroyed", lease.onDestroyed);
    return lease;
  }

  /** Synchronous acquisition prevents publication from starting during an awaited rename/delete. */
  beginPathChange(sourcePath: string, includeDescendants = false): () => void {
    const change = { path: identityPath(sourcePath), includeDescendants };
    if ([...this.active.values()].some((lease) => includesPath(change, identityPath(lease.sourcePath)))) {
      throw new Error("This file is still being published in another window.");
    }
    if ([...this.pathChanges].some((other) => includesPath(other, change.path) || includesPath(change, other.path))) {
      throw new Error("This path is already being moved or deleted in another window.");
    }
    this.pathChanges.add(change);
    return () => this.pathChanges.delete(change);
  }

  completePathChange(sourcePath: string, destinationPath?: string, includeDescendants = false): void {
    const change = { path: identityPath(sourcePath), includeDescendants };
    for (const [key, association] of [...this.uncommitted]) {
      const [file, owner, repo] = JSON.parse(key) as [string, string, string];
      if (!includesPath(change, file)) continue;
      this.uncommitted.delete(key);
      if (destinationPath !== undefined) {
        const moved = path.join(identityPath(destinationPath), path.relative(change.path, file));
        this.uncommitted.set(JSON.stringify([moved, owner, repo]), association);
      }
    }
  }

  issueNumber(lease: PublicationLease, diskContent: string): number | undefined {
    return (
      getGitHubIssueNumberForRepository(parseGitHubMetadata(diskContent), lease.owner, lease.repo) ??
      this.uncommitted.get(lease.key)?.issueNumber
    );
  }

  remoteSucceeded(lease: PublicationLease, association: Association): void {
    this.uncommitted.set(lease.key, association);
    lease.remoteFinished = true;
    if (lease.abandoned || lease.sender.isDestroyed()) this.remove(lease);
  }

  remoteFailed(lease: PublicationLease): void {
    this.remove(lease);
  }

  owned(id: string, sender: PublicationSender): PublicationLease | undefined {
    const lease = this.byId.get(id);
    if (lease && lease.sender.id !== sender.id) throw new Error("Publication belongs to another window.");
    if (lease && !lease.remoteFinished) throw new Error("Publication request has not finished.");
    return lease;
  }

  release(lease: PublicationLease, diskContent: string | undefined): void {
    const recorded = this.uncommitted.get(lease.key);
    if (
      recorded &&
      diskContent !== undefined &&
      getGitHubIssueNumberForRepository(parseGitHubMetadata(diskContent), lease.owner, lease.repo) ===
        recorded.issueNumber
    ) {
      this.uncommitted.delete(lease.key);
    }
    this.remove(lease);
  }

  private remove(lease: PublicationLease): void {
    if (this.active.get(lease.key) === lease) this.active.delete(lease.key);
    this.byId.delete(lease.id);
    lease.sender.off("destroyed", lease.onDestroyed);
  }
}

export const publicationLeases = new PublicationLeases();
