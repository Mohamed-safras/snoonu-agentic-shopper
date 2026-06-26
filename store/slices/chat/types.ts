import type { ChatMessage, Lang } from "@/types";

/** The chat thread plus streaming / live-tool activity. */
export interface ChatSlice {
  messages: ChatMessage[];
  addMessage: (message: ChatMessage) => string;
  appendText: (id: string, delta: string) => void;
  /** Append one line to a live "steps" message (an agentic loop's narration). */
  appendStep: (id: string, text: string) => void;
  /** Mark a "steps" message complete so the UI can collapse it. */
  finishSteps: (id: string) => void;
  removeMessage: (id: string) => void;
  /** Remove the message with `id` and every message after it (regenerate). */
  removeMessagesFrom: (id: string) => void;
  clearThread: () => void;
  /** Re-translate every existing message into `target` (cached per language). */
  retranslateThread: (target: Lang) => Promise<void>;
  playing: boolean;
  setPlaying: (playing: boolean) => void;
  activeTools: string[];
  flashTool: (name: string) => void;
}
