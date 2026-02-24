const EVENT_TYPE_EMOJIS: Record<string, string> = {
  PreToolUse: '\u{1F527}',       // wrench
  PostToolUse: '\u2705',          // check mark
  PostToolUseFailure: '\u274C',   // cross mark
  PermissionRequest: '\u{1F512}', // lock
  Notification: '\u{1F514}',     // bell
  Stop: '\u{1F534}',             // red circle
  SubagentStart: '\u{1F680}',    // rocket
  SubagentStop: '\u{1F6D1}',     // stop sign
  PreCompact: '\u{1F4E6}',      // package
  UserPromptSubmit: '\u{1F4DD}', // memo
  SessionStart: '\u{1F7E2}',    // green circle
  SessionEnd: '\u26AB',          // black circle
  TeammateIdle: '\u{1F634}',    // sleeping face
  TaskCompleted: '\u{1F3C1}',   // checkered flag
  ConfigChange: '\u2699\uFE0F', // gear
  WorktreeCreate: '\u{1F333}',  // deciduous tree
  WorktreeRemove: '\u{1FAA5}',  // axe
};

const TOOL_EMOJIS: Record<string, string> = {
  Bash: '\u{1F4BB}',       // computer
  Read: '\u{1F4D6}',       // open book
  Write: '\u270F\uFE0F',    // pencil
  Edit: '\u2702\uFE0F',     // scissors
  Glob: '\u{1F50D}',       // magnifying glass
  Grep: '\u{1F50E}',       // magnifying glass right
  Task: '\u{1F4CB}',       // clipboard
  WebFetch: '\u{1F310}',   // globe
  WebSearch: '\u{1F50D}',  // magnifying glass
  NotebookEdit: '\u{1F4D3}', // notebook
};

export function useEventEmojis() {
  const getEventEmoji = (eventType: string): string => {
    return EVENT_TYPE_EMOJIS[eventType] || '\u{1F4A0}'; // diamond
  };

  const getToolEmoji = (toolName: string): string => {
    return TOOL_EMOJIS[toolName] || '\u{1F6E0}\uFE0F'; // hammer and wrench
  };

  const formatEventTypeLabel = (eventType: string): string => {
    return eventType.replace(/([A-Z])/g, ' $1').trim();
  };

  return { getEventEmoji, getToolEmoji, formatEventTypeLabel };
}
