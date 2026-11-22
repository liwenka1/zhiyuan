export const RENDERER_URL = "file:///application/renderer/index.html";

export function trustedIpcEvent<T extends object>(sender: T) {
  const mainFrame = { url: RENDERER_URL };
  const isDestroyed =
    "isDestroyed" in sender && typeof sender.isDestroyed === "function" ? sender.isDestroyed : () => false;
  return { sender: Object.assign(sender, { mainFrame, isDestroyed }), senderFrame: mainFrame };
}
