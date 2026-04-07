import os from 'os';

export type Platform = 'macos' | 'linux' | 'windows' | 'unknown';

export function detectPlatform(): Platform {
  switch (os.platform()) {
    case 'darwin': return 'macos';
    case 'linux': return 'linux';
    case 'win32': return 'windows';
    default: return 'unknown';
  }
}

export function platformLabel(p: Platform): string {
  switch (p) {
    case 'macos': return 'macOS';
    case 'linux': return 'Linux';
    case 'windows': return 'Windows';
    default: return os.platform();
  }
}

export function osVersion(): string {
  return `${os.type()} ${os.release()}`;
}
