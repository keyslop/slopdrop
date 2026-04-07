import { configExists } from './config.js';
import { runWizard } from './wizard/index.js';
import { runManage } from './manage/index.js';
import { WizardCancelledError } from './wizard/prompter.js';

async function main() {
  try {
    if (configExists()) {
      await runManage();
    } else {
      await runWizard();
    }
  } catch (e) {
    if (e instanceof WizardCancelledError) {
      process.exit(0);
    }
    throw e;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
