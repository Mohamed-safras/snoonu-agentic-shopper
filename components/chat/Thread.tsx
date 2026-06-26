"use client";
import { useEffect, useRef, useState } from "react";
import { Intro } from "./Intro";
import { MessageView } from "./MessageView";
import { Icon } from "@/components/ui/Icon";
import { RecentOrders } from "@/components/checkout/RecentOrders";
import { PopularCategories } from "@/components/widgets/PopularCategories";
import { ForYou } from "@/components/widgets/ForYou";
import { BuyAgain } from "@/components/widgets/BuyAgain";
import { useTrova } from "@/store";
import { useStrings, useTranslate } from "@/hooks/useTranslate";

/**
 * The scrolling conversation column: intro + suggestion chips, the recent-orders
 * rail on the landing screen, and the message thread. Fully store-driven.
 */
export function Thread() {
  const messages = useTrova((store) => store.messages);
  const suggestions = useTrova((store) => store.suggestions);
  const orders = useTrova((store) => store.orders);
  const playing = useTrova((store) => store.playing);
  const userSend = useTrova((store) => store.userSend);
  const pushAttach = useTrova((store) => store.pushAttach);
  const reorderToCart = useTrova((store) => store.reorderToCart);
  const string = useStrings();
  const translate = useTranslate();
  const conversing = messages.length > 0;
  const threadRef = useRef<HTMLDivElement>(null);
  // Jump-to-top / jump-to-bottom affordances, shown only when there's room to
  // scroll in that direction. Updated from the scroll event (no effect setState).
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const updateScrollAffordances = () => {
    const current = threadRef.current;
    if (!current) return;
    const { scrollTop, scrollHeight, clientHeight } = current;
    setCanScrollUp(scrollTop > 320);
    setCanScrollDown(scrollTop + clientHeight < scrollHeight - 320);
  };
  const scrollThreadTo = (top: number) =>
    threadRef.current?.scrollTo({ top, behavior: "smooth" });
  // The user message we've already pinned, so we pin each send only once.
  const pinnedUserId = useRef<string | null>(null);
  // The last message id we acted on, to detect when the thread actually grows.
  const lastSeenId = useRef<string | null>(null);

  useEffect(() => {
    const current = threadRef.current;
    if (!current) return;

    const lastId = messages[messages.length - 1]?.id ?? null;
    const grew = lastId !== lastSeenId.current;
    lastSeenId.current = lastId;

    // Find the most recent user message.
    let latestUserId: string | null = null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.kind === "text" && message.role === "user") {
        latestUserId = message.id;
        break;
      }
    }

    // On a fresh send, pin that message near the top of the viewport so the
    // reply streams in BELOW it — the shopper reads the turn from the start.
    // We then deliberately do nothing else for the rest of the turn, so the
    // streaming reply + product cards never yank the view to the bottom.
    if (latestUserId && latestUserId !== pinnedUserId.current) {
      pinnedUserId.current = latestUserId;
      const node = current.querySelector<HTMLElement>(
        `[data-mid="${latestUserId}"]`,
      );
      if (node) {
        const top =
          node.getBoundingClientRect().top -
          current.getBoundingClientRect().top +
          current.scrollTop -
          12;
        current.scrollTo({ top, behavior: "smooth" });
      }
      return;
    }

    // No new user message. Only when idle (not mid-response) do we reveal a
    // freshly opened card — e.g. a /surprise or checkout card the user invoked.
    // While a pinned turn is streaming we leave the scroll exactly where it is.
    if (grew && !playing) {
      current.scrollTo({ top: current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, playing]);

  return (
    <div className="thread" ref={threadRef} onScroll={updateScrollAffordances}>
      {conversing && (canScrollUp || canScrollDown) && (
        <div className="thread-jump">
          {canScrollUp && (
            <button
              className="thread-jump-btn"
              onClick={() => scrollThreadTo(0)}
              aria-label={translate("Scroll to top")}
              title={translate("Go to top")}
            >
              <Icon
                name="chevron"
                size={18}
                style={{ transform: "rotate(180deg)" }}
              />
            </button>
          )}
          {canScrollDown && (
            <button
              className="thread-jump-btn"
              onClick={() =>
                scrollThreadTo(threadRef.current?.scrollHeight ?? 0)
              }
              aria-label={translate("Scroll to bottom")}
              title={translate("Go to bottom")}
            >
              <Icon name="chevron" size={18} />
            </button>
          )}
        </div>
      )}
      <div className="thread-inner">
        <Intro
          chips={suggestions.length ? suggestions : string.chips}
          onPick={(text) => userSend(text)}
          onSurprise={() => pushAttach({ kind: "surprise" })}
          onAutobuy={() =>
            // Sends straight into chat — no manual edit+send. If no budget is
            // known yet, the orchestrator's autobuy turn asks for one with chips.
            userSend(translate("pick and order for me"))
          }
        />
        {!conversing && (
          <>
            <RecentOrders orders={orders} onReorder={reorderToCart} />
            <BuyAgain />
          </>
        )}
        {/* "Picked for you" + categories stay mounted even while chatting (they
            scroll above the conversation) so a frequent shopper keeps seeing
            things to buy, not only on a cleared thread. Both self-hide when there
            is no signal yet. */}
        <ForYou />
        <PopularCategories />
        {messages.map((message) => (
          <MessageView key={message.id} message={message} />
        ))}
        {/* While a reply streams, reserve a tall tail so the just-sent message
            can be pinned to the top of the viewport; collapses when idle. */}
        <div style={{ height: playing ? "60vh" : 8, flex: "0 0 auto" }} />
      </div>
    </div>
  );
}
