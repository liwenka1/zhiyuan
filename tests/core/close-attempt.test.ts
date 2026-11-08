import { describe, expect, it } from "vitest";
import { CloseAttemptTracker } from "../../apps/desktop/src/main/window-manager/close-attempt";

describe("close attempt tracker", () => {
  it("accepts only the current attempt completion", () => {
    const tracker = new CloseAttemptTracker();
    const firstAttempt = tracker.begin(1);

    expect(firstAttempt).toBe(1);
    expect(tracker.isCurrent(1, firstAttempt)).toBe(true);
    expect(tracker.complete(1, firstAttempt)).toBe(true);
    expect(tracker.isPending(1)).toBe(false);
    expect(tracker.complete(1, firstAttempt)).toBe(false);
  });

  it("invalidates a late completion after timeout and preserves monotonic tokens", () => {
    const tracker = new CloseAttemptTracker();
    const firstAttempt = tracker.begin(7);
    tracker.cancel(7);

    const secondAttempt = tracker.begin(7);
    expect(secondAttempt).toBe(2);
    expect(tracker.complete(7, firstAttempt)).toBe(false);
    expect(tracker.complete(7, secondAttempt)).toBe(true);
  });

  it("clears all state when a window is destroyed", () => {
    const tracker = new CloseAttemptTracker();
    tracker.begin(9);
    tracker.clear(9);

    expect(tracker.isPending(9)).toBe(false);
    expect(tracker.begin(9)).toBe(1);
  });
});
