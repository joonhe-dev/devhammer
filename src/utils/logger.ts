const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
// BLUE = '\x1b[34m' — reserved for future use (link/URL coloring)
const MAGENTA = '\x1b[35m';
const CYAN = '\x1b[36m';
const GRAY = '\x1b[90m';
const BOLD = '\x1b[1m';

/** Log level priority: error > warn > info > debug */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

/** Current log level — defaults to 'info'. Set via LOGGER_LEVEL env or setLevel(). */
let currentLevel: LogLevel = (() => {
  const env = process.env.LOGGER_LEVEL?.toLowerCase();
  if (env && env in LEVEL_PRIORITY) return env as LogLevel;
  return 'info';
})();

function timestamp(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] <= LEVEL_PRIORITY[currentLevel];
}

export const logger = {
  info(message: string): void {
    if (!shouldLog('info')) return;
    console.log(`${CYAN}ℹ${RESET} ${message}`);
  },

  success(message: string): void {
    if (!shouldLog('info')) return;
    console.log(`${GREEN}✔${RESET} ${message}`);
  },

  warn(message: string): void {
    if (!shouldLog('warn')) return;
    console.log(`${YELLOW}⚠${RESET} ${message}`);
  },

  error(message: string): void {
    if (!shouldLog('error')) return;
    console.log(`${RED}✖${RESET} ${message}`);
  },

  debug(message: string): void {
    if (!shouldLog('debug')) return;
    console.log(`${GRAY}[${timestamp()}]${RESET} ${GRAY}${message}${RESET}`);
  },

  heading(message: string): void {
    if (!shouldLog('info')) return;
    console.log(`\n${BOLD}${MAGENTA}${message}${RESET}\n`);
  },

  dim(message: string): void {
    if (!shouldLog('info')) return;
    console.log(`${GRAY}${message}${RESET}`);
  },

  /**
   * Log a progress step, e.g. `[1/3] Analyzing bundle...`
   */
  progress(step: number, total: number, message: string): void {
    if (!shouldLog('info')) return;
    console.log(`${BOLD}${CYAN}[${step}/${total}]${RESET} ${message}`);
  },

  /**
   * Set the current log level. Messages below this level are suppressed.
   */
  setLevel(level: LogLevel): void {
    currentLevel = level;
  },

  /**
   * Get the current log level.
   */
  getLevel(): LogLevel {
    return currentLevel;
  },

  table(data: Record<string, unknown>[]): void {
    if (!shouldLog('info')) return;
    if (data.length === 0) return;

    const keys = Object.keys(data[0]!);
    const colWidths = keys.map((key) => {
      const maxDataLen = Math.max(...data.map((row) => String(row[key] ?? '').length));
      return Math.max(key.length, maxDataLen);
    });

    // Header
    const header = keys.map((key, i) => key.padEnd(colWidths[i]!)).join('  ');
    console.log(`${BOLD}${header}${RESET}`);

    // Separator
    const sep = colWidths.map((w) => '─'.repeat(w)).join('──');
    console.log(`${GRAY}${sep}${RESET}`);

    // Rows
    for (const row of data) {
      const line = keys.map((key, i) => String(row[key] ?? '').padEnd(colWidths[i]!)).join('  ');
      console.log(line);
    }
  },
};
