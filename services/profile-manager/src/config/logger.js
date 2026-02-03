/**
 * src/config/logger.js
 * Minimal console-based logger with leveled output.
 * This avoids adding a heavy dependency while still providing a stable
 * logging API (error, warn, info, debug). If you prefer `winston` or `pino`,
 * replace this file with an adapter to that library.
 */

const LEVELS = ["error", "warn", "info", "debug"];

function timestamp() {
  return new Date().toISOString();
}

export function createLogger({
  level = process.env.LOG_LEVEL || "info",
  service = "profile-manager",
} = {}) {
  const normalized = String(level || "info").toLowerCase();
  const maxIdx = Math.max(
    0,
    LEVELS.indexOf(normalized) === -1 ? 2 : LEVELS.indexOf(normalized)
  );

  function shouldLog(lvl) {
    return LEVELS.indexOf(lvl) <= maxIdx;
  }

  function format(lvl, ...args) {
    const prefix = `[${timestamp()}] [${service}] [${lvl.toUpperCase()}]`;
    return [prefix, ...args];
  }

  return {
    error: (...args) => {
      if (!shouldLog("error")) return;
      console.error(...format("error", ...args));
    },
    warn: (...args) => {
      if (!shouldLog("warn")) return;
      console.warn(...format("warn", ...args));
    },
    info: (...args) => {
      if (!shouldLog("info")) return;
      console.log(...format("info", ...args));
    },
    debug: (...args) => {
      if (!shouldLog("debug")) return;
      console.debug(...format("debug", ...args));
    },
    level: normalized,
  };
}

// default logger instance
const logger = createLogger();
export default logger;
