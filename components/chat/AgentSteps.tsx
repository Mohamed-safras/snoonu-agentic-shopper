"use client";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useTranslate } from "@/hooks/useTranslate";

/** Live agentic-loop narration (e.g. autobuy's search/reason steps), shown as
 *  its own interactive timeline — never mixed into the reply bubble's text.
 *  Stays expanded while running so the shopper sees real activity; the
 *  moment it's `done` it's collapsed to a tappable one-line summary by
 *  default (a multi-iteration loop can produce a dozen+ lines, which is
 *  noise once the outcome is already shown in the confirm card below). Tap
 *  the header to expand/collapse — `userToggled` overrides the done-based
 *  default once the shopper has touched it, so a re-render never fights
 *  their choice. */
export function AgentSteps({
  items,
  done,
}: {
  items: string[];
  done?: boolean;
}) {
  const translate = useTranslate();
  const [userToggled, setUserToggled] = useState<boolean | null>(null);
  const expanded = userToggled ?? !done;

  if (!items.length) return null;

  return (
    <div className={"agent-steps" + (done ? " agent-steps-done" : "")}>
      <button
        type="button"
        className="agent-steps-head"
        onClick={() => setUserToggled(!expanded)}
      >
        <Icon name="spark" size={13} />
        {done
          ? translate("Worked it out · {n} steps", { n: items.length })
          : translate("Working on it…")}
        <span className={"agent-steps-chev" + (expanded ? " open" : "")}>
          <Icon name="chevron" size={13} />
        </span>
      </button>
      {expanded &&
        items.map((item, index) => {
          const isLast = index === items.length - 1;
          const live = isLast && !done;
          return (
            <div
              className={"agent-step" + (live ? " agent-step-live" : "")}
              key={index}
            >
              <span className="agent-step-dot">
                {!live && <Icon name="check" size={9} />}
              </span>
              <span className="agent-step-text">{translate(item)}</span>
            </div>
          );
        })}
    </div>
  );
}
