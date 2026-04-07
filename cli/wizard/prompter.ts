import * as clack from '@clack/prompts';

export interface WizardPrompter {
  intro(title: string): void;
  outro(message: string): void;
  note(message: string, title?: string): void;
  select<T extends string>(params: {
    message: string;
    options: Array<{ value: T; label: string; hint?: string }>;
  }): Promise<T>;
  text(params: {
    message: string;
    placeholder?: string;
    defaultValue?: string;
    validate?: (value: string) => string | undefined;
  }): Promise<string>;
  confirm(params: {
    message: string;
    initialValue?: boolean;
  }): Promise<boolean>;
  spinner(): {
    start(message?: string): void;
    stop(message?: string): void;
    message(msg: string): void;
  };
}

export class WizardCancelledError extends Error {
  constructor() {
    super('Setup cancelled.');
    this.name = 'WizardCancelledError';
  }
}

function guardCancel<T>(value: T | symbol): T {
  if (clack.isCancel(value)) {
    clack.cancel('Setup cancelled.');
    throw new WizardCancelledError();
  }
  return value as T;
}

export function createPrompter(): WizardPrompter {
  return {
    intro(title: string) {
      clack.intro(title);
    },

    outro(message: string) {
      clack.outro(message);
    },

    note(message: string, title?: string) {
      clack.note(message, title);
    },

    async select<T extends string>(params: {
      message: string;
      options: Array<{ value: T; label: string; hint?: string }>;
    }): Promise<T> {
      const result = await clack.select({
        message: params.message,
        options: params.options as any,
      });
      return guardCancel(result) as T;
    },

    async text(params: {
      message: string;
      placeholder?: string;
      defaultValue?: string;
      validate?: (value: string) => string | undefined;
    }): Promise<string> {
      const result = await clack.text(params);
      return guardCancel(result);
    },

    async confirm(params: {
      message: string;
      initialValue?: boolean;
    }): Promise<boolean> {
      const result = await clack.confirm(params);
      return guardCancel(result);
    },

    spinner() {
      const s = clack.spinner();
      return {
        start(message?: string) { s.start(message); },
        stop(message?: string) { s.stop(message); },
        message(msg: string) { s.message(msg); },
      };
    },
  };
}
