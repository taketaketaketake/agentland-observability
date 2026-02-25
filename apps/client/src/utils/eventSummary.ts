import type { HookEvent } from '../types';

/** Extract the filename from a path */
export function basename(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || filePath;
}

/** Extract the first sentence (up to ~100 chars) from text */
export function extractFirstSentence(text: string, maxLen = 100): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  const match = cleaned.match(/^[^.!?\n]+[.!?]?/);
  const sentence = match ? match[0].trim() : cleaned;
  if (sentence.length <= maxLen) return sentence;
  return sentence.substring(0, maxLen - 1) + '\u2026';
}

/** Produce a human-readable one-liner summary for a hook event */
export function getEventSummary(event: HookEvent): string {
  const type = event.hook_event_type;
  const toolName = event.payload?.tool_name || '';
  const input = event.payload?.tool_input;
  const lastMsg = event.payload?.last_assistant_message || '';

  // Server-side summary takes priority
  if (event.summary) return event.summary;

  // Stop / SubagentStop — show first sentence of last assistant message
  if (type === 'Stop' || type === 'SubagentStop') {
    if (lastMsg) return `Completed: ${extractFirstSentence(lastMsg)}`;
    return 'Session completed';
  }

  // Session lifecycle
  if (type === 'SessionStart') return 'Session started';
  if (type === 'SessionEnd') return 'Session ended';

  // User prompt
  if (type === 'UserPromptSubmit') {
    const prompt = event.payload?.user_prompt || event.payload?.prompt || lastMsg;
    if (prompt) return `Prompt: ${extractFirstSentence(prompt, 80)}`;
    return 'User prompt submitted';
  }

  // Tool-based events (PreToolUse / PostToolUse)
  if (toolName) {
    const isPost = type === 'PostToolUse';
    switch (toolName) {
      case 'Bash': {
        const cmd = input?.command || '';
        return `${isPost ? 'Ran' : 'Running'}: ${cmd.substring(0, 100) || 'command'}`;
      }
      case 'Write': {
        const fp = input?.file_path || '';
        return `${isPost ? 'Wrote' : 'Writing'}: ${basename(fp) || 'file'}`;
      }
      case 'Read': {
        const fp = input?.file_path || '';
        return `Reading: ${basename(fp) || 'file'}`;
      }
      case 'Edit': {
        const fp = input?.file_path || '';
        return `${isPost ? 'Edited' : 'Editing'}: ${basename(fp) || 'file'}`;
      }
      case 'Grep': {
        const pat = input?.pattern || '';
        return `Searching: '${pat.substring(0, 60)}'`;
      }
      case 'Glob': {
        const pat = input?.pattern || '';
        return `Finding: '${pat.substring(0, 60)}'`;
      }
      case 'Task': {
        const desc = input?.description || input?.prompt || '';
        return `Delegating: ${extractFirstSentence(desc, 60) || 'subtask'}`;
      }
      case 'WebSearch': {
        const query = input?.query || '';
        return `Searching web: '${query.substring(0, 60)}'`;
      }
      case 'WebFetch': {
        const url = input?.url || '';
        return `Fetching: ${url.substring(0, 80)}`;
      }
      default: {
        // Generic tool summary
        if (typeof input === 'string') return `${toolName}: ${input.substring(0, 80)}`;
        if (input?.command) return `${toolName}: ${input.command.substring(0, 80)}`;
        if (input?.file_path) return `${toolName}: ${basename(input.file_path)}`;
        if (input?.pattern) return `${toolName}: '${input.pattern.substring(0, 60)}'`;
        return toolName;
      }
    }
  }

  // Fallback: show last assistant message if present
  if (lastMsg) return extractFirstSentence(lastMsg);

  return type;
}
