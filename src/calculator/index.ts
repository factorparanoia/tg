import * as math from 'mathjs';
import { chat } from '../ai';
import { CalcResult } from '../types';
import { logger } from '../utils/logger';

function safeEval(expression: string): string | null {
  try {
    const result = math.evaluate(expression);
    if (result === undefined || result === null) return null;
    // Format nicely: round floats to 10 sig digits
    if (typeof result === 'number') {
      return parseFloat(result.toPrecision(10)).toString();
    }
    return math.format(result, { precision: 10 });
  } catch {
    return null;
  }
}

export async function calculate(userMessage: string): Promise<CalcResult> {
  // Try direct eval first on the raw message
  const directResult = safeEval(userMessage);
  if (directResult !== null) {
    return {
      expression: userMessage,
      result: directResult,
      method: 'direct',
    };
  }

  // Use LLM to extract and solve
  const response = await chat([
    {
      role: 'user',
      content: `You are a calculator. Solve this and respond ONLY with valid JSON (no markdown):
{"expression": "the math expression only", "result": "numeric answer", "explanation": "one line explanation"}

User message: "${userMessage}"`,
    },
  ]);

  try {
    const raw = response.content.replace(/```(?:json)?\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(raw) as CalcResult;

    // Try to verify with mathjs
    const verified = safeEval(parsed.expression);
    if (verified !== null) parsed.result = verified;

    return { ...parsed, method: 'ai' };
  } catch {
    logger.warn('Calculator JSON parse failed, using raw response');
    return {
      expression: userMessage,
      result: response.content,
      method: 'ai_raw',
    };
  }
}

export function formatCalcResult(calc: CalcResult): string {
  let text = `🧮 *Calculator*\n\n\`${calc.expression}\`\n\n**= ${calc.result}**`;
  if (calc.explanation && calc.explanation !== calc.result) {
    text += `\n\n_${calc.explanation}_`;
  }
  return text;
}
