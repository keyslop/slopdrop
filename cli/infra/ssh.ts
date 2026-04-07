import { NodeSSH } from 'node-ssh';

interface SSHConfig {
  host: string;
  username: string;
  privateKeyPath?: string;
}

export async function testSSHConnection(config: SSHConfig): Promise<{ ok: boolean; error?: string }> {
  const ssh = new NodeSSH();

  try {
    await ssh.connect({
      host: config.host,
      username: config.username,
      privateKey: config.privateKeyPath,
      // Try default SSH key locations
      agent: process.env.SSH_AUTH_SOCK,
      tryKeyboard: false,
      readyTimeout: 10000,
    });

    const result = await ssh.execCommand('echo ok');
    ssh.dispose();

    if (result.stdout.trim() === 'ok') {
      return { ok: true };
    }
    return { ok: false, error: `Unexpected response: ${result.stdout}` };
  } catch (e) {
    try { ssh.dispose(); } catch {}
    return { ok: false, error: (e as Error).message };
  }
}

export async function execRemote(
  config: SSHConfig,
  command: string,
): Promise<{ stdout: string; stderr: string; code: number }> {
  const ssh = new NodeSSH();

  await ssh.connect({
    host: config.host,
    username: config.username,
    privateKey: config.privateKeyPath,
    agent: process.env.SSH_AUTH_SOCK,
  });

  const result = await ssh.execCommand(command);
  ssh.dispose();

  return {
    stdout: result.stdout,
    stderr: result.stderr,
    code: result.code ?? 0,
  };
}
