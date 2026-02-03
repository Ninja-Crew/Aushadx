function timestamp() {
  return new Date().toISOString();
}
export function createLogger({
  level = process.env.LOG_LEVEL || "info",
  service = "medicine-analyzer",
} = {}) {
  const levels = ["error", "warn", "info", "debug"];
  const idx = Math.max(
    0,
    levels.indexOf(level) === -1 ? 2 : levels.indexOf(level)
  );
  const shouldLog = (l) => levels.indexOf(l) <= idx;
  const fmt = (lvl, ...args) => [
    `[${timestamp()}] [${service}] [${lvl.toUpperCase()}]`,
    ...args,
  ];
  return {
    error: (...a) => {
      if (!shouldLog("error")) return;
      console.error(...fmt("error", ...a));
    },
    warn: (...a) => {
      if (!shouldLog("warn")) return;
      console.warn(...fmt("warn", ...a));
    },
    info: (...a) => {
      if (!shouldLog("info")) return;
      console.log(...fmt("info", ...a));
    },
    debug: (...a) => {
      if (!shouldLog("debug")) return;
      console.debug(...fmt("debug", ...a));
    },
  };
}

const logger = createLogger();
export default logger;
