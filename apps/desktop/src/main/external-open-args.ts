const SWITCHES_WITH_VALUE = new Set([
  "--user-data-dir",
  "--profile-directory",
  "--disk-cache-dir",
  "--remote-debugging-port",
  "--remote-debugging-address",
  "--log-file",
  "--js-flags",
  "--proxy-server",
  "--proxy-pac-url"
]);

/** Electron 开发启动还包含应用入口，打包启动则直接跟随文件参数。 */
export function getExternalOpenCandidates(argv: string[], defaultApp = false): string[] {
  const args = argv.slice(defaultApp ? 2 : 1);
  const candidates: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--") return [...candidates, ...args.slice(index + 1)];
    if (argument.startsWith("-")) {
      if (SWITCHES_WITH_VALUE.has(argument)) index += 1;
      continue;
    }
    candidates.push(argument);
  }
  return candidates;
}
