import chalk from 'chalk';
import Table from 'cli-table3';

export const BANNER = `
${chalk.hex('#FF6B35').bold('  ███████╗██╗      ██████╗ ██████╗ ')}${chalk.hex('#FF8C42').bold('██████╗ ██████╗  ██████╗ ██████╗ ')}
${chalk.hex('#FF6B35').bold('  ██╔════╝██║     ██╔═══██╗██╔══██╗')}${chalk.hex('#FF8C42').bold('██╔══██╗██╔══██╗██╔═══██╗██╔══██╗')}
${chalk.hex('#FF6B35').bold('  ███████╗██║     ██║   ██║██████╔╝')}${chalk.hex('#FF8C42').bold('██║  ██║██████╔╝██║   ██║██████╔╝')}
${chalk.hex('#FF6B35').bold('  ╚════██║██║     ██║   ██║██╔═══╝ ')}${chalk.hex('#FF8C42').bold('██║  ██║██╔══██╗██║   ██║██╔═══╝ ')}
${chalk.hex('#FF6B35').bold('  ███████║███████╗╚██████╔╝██║     ')}${chalk.hex('#FF8C42').bold('██████╔╝██║  ██║╚██████╔╝██║     ')}
${chalk.hex('#FF6B35').bold('  ╚══════╝╚══════╝ ╚═════╝ ╚═╝     ')}${chalk.hex('#FF8C42').bold('╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚═╝     ')}
`;

export const TAGLINE = chalk.dim('  Drop your voice slop on your own server.\n');

export const icons = {
  check: chalk.green('✓'),
  cross: chalk.red('✗'),
  arrow: chalk.cyan('→'),
  info: chalk.blue('ℹ'),
  warn: chalk.yellow('⚠'),
  mic: '🎙️',
  rocket: '🚀',
  key: '🔑',
  globe: '🌍',
  server: '🖥️',
  lock: '🔒',
  clipboard: '📋',
  sparkles: '✨',
} as const;

export function heading(text: string): string {
  return chalk.bold.underline(text);
}

export function success(text: string): string {
  return `${icons.check} ${chalk.green(text)}`;
}

export function error(text: string): string {
  return `${icons.cross} ${chalk.red(text)}`;
}

export function info(text: string): string {
  return `${icons.info} ${chalk.blue(text)}`;
}

export function warn(text: string): string {
  return `${icons.warn} ${chalk.yellow(text)}`;
}

export function dim(text: string): string {
  return chalk.dim(text);
}

export function bold(text: string): string {
  return chalk.bold(text);
}

export function makeTable(head: string[], rows: string[][]): string {
  const table = new Table({
    head: head.map(h => chalk.bold.cyan(h)),
    style: { head: [], border: ['dim'] },
    chars: {
      top: '─', 'top-mid': '┬', 'top-left': '┌', 'top-right': '┐',
      bottom: '─', 'bottom-mid': '┴', 'bottom-left': '└', 'bottom-right': '┘',
      left: '│', 'left-mid': '├', mid: '─', 'mid-mid': '┼',
      right: '│', 'right-mid': '┤', middle: '│',
    },
  });
  rows.forEach(row => table.push(row));
  return table.toString();
}

export function promptBox(title: string, content: string): string {
  const lines = content.split('\n');
  const maxLen = Math.max(title.length, ...lines.map(l => l.length));
  const border = chalk.dim('─'.repeat(maxLen + 4));
  const top = chalk.dim('┌') + border + chalk.dim('┐');
  const bot = chalk.dim('└') + border + chalk.dim('┘');
  const titleLine = chalk.dim('│') + ' ' + chalk.bold.yellow(title.padEnd(maxLen + 2)) + ' ' + chalk.dim('│');
  const sep = chalk.dim('├') + border + chalk.dim('┤');
  const body = lines.map(l =>
    chalk.dim('│') + '  ' + l.padEnd(maxLen + 2) + chalk.dim('│')
  ).join('\n');

  return [top, titleLine, sep, body, bot].join('\n');
}
