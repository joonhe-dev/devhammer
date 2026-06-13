const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const MAGENTA = '\x1b[35m';
const CYAN = '\x1b[36m';
const GRAY = '\x1b[90m';
const BOLD = '\x1b[1m';

function timestamp(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

export const logger = {
  info(message: string): void {
    console.log(`${CYAN}ℹ${RESET} ${message}`);
  },

  success(message: string): void {
    console.log(`${GREEN}✔${RESET} ${message}`);
  },

  warn(message: string): void {
    console.log(`${YELLOW}⚠${RESET} ${message}`);
  },

  error(message: string): void {
    console.log(`${RED}✖${RESET} ${message}`);
  },

  debug(message: string): void {
    console.log(`${GRAY}[${timestamp()}]${RESET} ${GRAY}${message}${RESET}`);
  },

  heading(message: string): void {
    console.log(`\n${BOLD}${MAGENTA}${message}${RESET}\n`);
  },

  dim(message: string): void {
    console.log(`${GRAY}${message}${RESET}`);
  },

  table(data: Record<string, unknown>[]): void {
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
