import OpenAI from 'openai';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { ChatMessage, ChatResponse, IntentResult, MemoryInput } from '../types';

const client = new OpenAI({
  apiKey: config.openai.apiKey,
  baseURL: config.openai.baseUrl,
});

// ─── System Prompt ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Midnight AI, a personal AI agent and assistant.
You have access to the user's memories, notes, tasks, and reminders.
You are sharp, helpful, and concise. You remember everything the user tells you.

Capabilities:
- 🧠 Memory: store and recall personal facts
- 📝 Notes: save and retrieve notes  
- ✅ Tasks: manage to-do items with priorities
- ⏰ Reminders: schedule future alerts
- 🧮 Calculator: solve mathematical expressions
- 📄 Files: analyze PDFs, documents, and images

When you've taken an action (saved memory, created task, etc.), confirm it clearly.
Use markdown formatting. Be direct and useful.`;

// ─── Core Chat ────────────────────────────────────────────────────────────

export async function chat(
  messages: ChatMessage[],
  systemSuffix?: string
): Promise<ChatResponse> {
  const systemContent = systemSuffix
    ? `${SYSTEM_PROMPT}\n\n${systemSuffix}`
    : SYSTEM_PROMPT;

  try {
    const response = await client.chat.completions.create({
      model: config.openai.model,
      max_tokens: config.openai.maxTokens,
      temperature: config.openai.temperature,
      messages: [
        { role: 'system', content: systemContent },
        ...messages,
      ],
    });

    return {
      content: response.choices[0].message.content ?? '',
      tokens: response.usage?.total_tokens,
    };
  } catch (error) {
    logger.error('LLM chat error:', error);
    throw error;
  }
}

// ─── Intent Classification ────────────────────────────────────────────────

const INTENT_SYSTEM = `Classify user messages into exactly one intent.
Return ONLY a JSON object — no markdown, no explanation.

Intents:
- remember     → save a fact ("remember that...", "my X is Y", "note that...")
- recall       → retrieve what you know ("what's my X", "what do you know about", "tell me about")
- forget       → delete a memory ("forget", "delete that")
- note_save    → save a note ("save note:", "write down", "note:")
- note_list    → list notes ("my notes", "show notes", "list notes")
- note_delete  → delete a note ("delete note 2")
- task_create  → create a task ("add task", "todo:", "I need to", "task:")
- task_list    → list tasks ("my tasks", "show tasks", "what do I need to do")
- task_done    → complete a task ("done with", "complete task", "mark task 2 done")
- task_delete  → delete a task
- reminder_create → set reminder ("remind me", "reminder at", "alert me")
- reminder_list   → list reminders ("my reminders", "show reminders")
- reminder_delete → delete a reminder
- calculate    → math ("calculate", "what is 17+3", "profit if")
- file_analyze → analyze uploaded file
- clear_context → reset conversation ("clear context", "start over", "forget our chat")
- chat         → general conversation or question

Return format:
{
  "intent": "<intent>",
  "confidence": <0.0-1.0>,
  "entities": {
    "content": "for remember: clean fact to store",
    "category": "for remember: category name",
    "type": "permanent|temporary",
    "query": "for recall/forget: what they're asking about",
    "title": "for task: task title",
    "priority": "low|medium|high|urgent",
    "due": "date string or null",
    "message": "for reminder: reminder text",
    "time": "for reminder: when (date/time string)",
    "repeat": "none|daily|weekly|monthly",
    "noteContent": "for note_save: note text",
    "noteTitle": "for note_save: optional title",
    "expression": "for calculate: math expression",
    "index": null
  }
}`;

export async function classifyIntent(userMessage: string): Promise<IntentResult> {
  try {
    const response = await client.chat.completions.create({
      model: config.openai.model,
      max_tokens: 400,
      temperature: 0.05,
      messages: [
        { role: 'system', content: INTENT_SYSTEM },
        { role: 'user', content: userMessage },
      ],
    });

    const raw = (response.choices[0].message.content ?? '').trim();
    const json = raw.replace(/```(?:json)?\n?|\n?```/g, '').trim();
    return JSON.parse(json) as IntentResult;
  } catch (error) {
    logger.warn('Intent classification failed, defaulting to chat:', error);
    return { intent: 'chat', confidence: 0.5, entities: {} };
  }
}

// ─── Memory Extraction ────────────────────────────────────────────────────

export async function extractMemoryDetails(
  userMessage: string
): Promise<MemoryInput> {
  const prompt = `Extract what the user wants to remember.
Return ONLY JSON: {"content": "clean factual statement", "category": "category", "type": "PERMANENT"}

Examples:
- "Remember my server is on Railway" → {"content": "Server is hosted on Railway", "category": "infrastructure", "type": "PERMANENT"}
- "My GPU is RTX 3070" → {"content": "GPU is RTX 3070", "category": "hardware", "type": "PERMANENT"}
- "Temporarily remember my meeting is at 3pm" → {"content": "Meeting at 3pm", "category": "schedule", "type": "TEMPORARY"}`;

  try {
    const response = await client.chat.completions.create({
      model: config.openai.model,
      max_tokens: 200,
      temperature: 0.1,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: userMessage },
      ],
    });

    const raw = (response.choices[0].message.content ?? '')
      .replace(/```(?:json)?\n?|\n?```/g, '')
      .trim();
    return JSON.parse(raw) as MemoryInput;
  } catch {
    return { content: userMessage, category: 'general', type: 'PERMANENT' };
  }
}

// ─── Contextual Answer with Memories ─────────────────────────────────────

export async function answerWithContext(
  messages: ChatMessage[],
  memories: Array<{ content: string; category: string | null }>,
  question: string
): Promise<ChatResponse> {
  const memoryBlock = memories.length > 0
    ? `\n\nFacts I know about this user:\n${memories.map((m) => `- [${m.category ?? 'general'}] ${m.content}`).join('\n')}`
    : '';

  const fullMessages: ChatMessage[] = [
    ...messages,
    { role: 'user', content: question },
  ];

  return chat(fullMessages, memoryBlock || undefined);
}
