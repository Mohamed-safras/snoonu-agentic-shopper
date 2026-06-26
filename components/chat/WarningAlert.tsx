"use client";
import { Icon } from "@/components/ui/Icon";
import { useTranslate } from "@/hooks/useTranslate";

/** Inline alert shown when a message uses profanity — flagged deterministically,
 *  not by the LLM. Never blocks the reply, just a tone reminder. (Explicit/18+
 *  content has no separate banner — the blurred shelf gate carries that prompt
 *  right where the content would appear, see GatedReveal.) */
export function WarningAlert() {
  const translate = useTranslate();

  return (
    <div className="mod-warning" role="alert">
      <span className="mod-warning-ic">
        <Icon name="alert-triangle" size={16} />
      </span>
      <div className="mod-warning-body">
        <span>
          {translate(
            "Let's keep things friendly — I'm happy to help once we keep it respectful. 🙏",
          )}
        </span>
      </div>
    </div>
  );
}
