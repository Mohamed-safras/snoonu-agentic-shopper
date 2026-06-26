/** Options for a conversational turn (image attach / suppress the user bubble). */
export interface SendOptions {
  /** One or more base64 image data URLs for visual search. */
  images?: string[];
  silent?: boolean;
  /** Regenerating an existing reply: the user message is already in the thread,
   *  so don't add a new bubble or push it onto the history again. */
  replay?: boolean;
}

/** Drives a conversational turn against the agent API. */
export interface AgentSlice {
  /** Run a conversational turn: POST /api/chat, stream events into the store. */
  send: (text: string, opts?: SendOptions) => Promise<void>;
  /** Like send, but also collapses the promo banner (any user-initiated turn). */
  userSend: (text: string, opts?: SendOptions) => Promise<void>;
  /** Discard an assistant reply (and everything after it) and re-run the turn. */
  regenerate: (assistantId: string) => Promise<void>;
  /** Re-send a past user message: drop everything after it, then re-run it. */
  resendUserMessage: (userMessageId: string) => Promise<void>;
  /** Abort the in-flight turn (the user tapped "stop"). */
  stopGeneration: () => void;
}
