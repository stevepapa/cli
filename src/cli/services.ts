import { copyToClipboard } from '../node/clipboard/systemClipboard.js';

export type CliServices = {
  clipboard: {
    copyToClipboard: (text: string) => Promise<boolean>;
  };
};

export function createCliServices(): CliServices {
  return {
    clipboard: { copyToClipboard },
  };
}
