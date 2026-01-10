import type { AskLine } from '../../interactive/askLine.js';
import type { InteractiveMap } from '../../../core/promptInputs.js';

export async function runInteractivePrompts(params: {
  promptName: string;
  vars: Record<string, string>;
  interactiveMap: InteractiveMap;
  askLine: AskLine;
  onSeparator?: () => void;
}): Promise<void> {
  const entries = Object.entries(params.interactiveMap);
  const totalQuestions = entries.length;

  for (const [idx, [varName, meta]] of entries.entries()) {
    const current = params.vars[varName];
    const question = meta.question?.trim() || `Enter value for '${varName}'`;
    const help = meta.help?.trim();
    const value = await params.askLine({
      sessionHeader:
        idx === 0 && totalQuestions > 0
          ? { promptName: params.promptName, totalQuestions }
          : undefined,
      question,
      help,
      defaultValue: current,
      required: meta.required === true && (!current || current.trim().length === 0),
    });
    params.vars[varName] = value;
  }

  if (totalQuestions > 0) {
    params.onSeparator?.();
  }
}
