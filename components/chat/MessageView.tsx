"use client";
import { useState } from "react";
import Image from "next/image";
import { Icon } from "@/components/ui/Icon";
import { ImageViewer } from "@/components/ui/ImageViewer";
import { Thinking } from "./Thinking";
import { Chips } from "@/components/ui/Chips";
import { CardShell } from "@/components/ui/CardShell";
import { ShelfWithBudget } from "@/components/product/ShelfWithBudget";
import { Spotlight } from "@/components/product/Spotlight";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { OrderPlaced } from "@/components/checkout/OrderPlaced";
import { OrderTracker } from "@/components/checkout/OrderTracker";
import { SurpriseMe } from "@/components/widgets/SurpriseMe";
import { HamperBuilder } from "@/components/widgets/HamperBuilder";
import { KitBuilder } from "@/components/widgets/KitBuilder";
import { WatchlistCard } from "@/components/widgets/WatchlistCard";
import { CompareCard } from "@/components/widgets/CompareCard";
import { OccasionReminder } from "@/components/widgets/OccasionReminder";
import { PhotoMatchCard } from "@/components/widgets/PhotoMatchCard";
import { WarningAlert } from "./WarningAlert";
import { GatedReveal } from "./GatedReveal";
import { AutobuyConfirm } from "./AutobuyConfirm";
import { AgentSteps } from "./AgentSteps";
import { useHala, type ChatMessage } from "@/store";
import type { UiDirective } from "@/types";
import { useTranslate } from "@/hooks/useTranslate";

/** Compact local clock time (e.g. "3:45 PM") for a message timestamp. */
function formatTime(at: number): string {
  return new Date(at).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Short label for each in-thread card (shown in its close/reopen header). */
function attachTitle(directive: UiDirective): string {
  switch (directive.kind) {
    case "shelf":
      return directive.title || "Products";
    case "spotlight":
      return "Featured pick";
    case "delivery":
      return "Delivery";
    case "dates":
      return "Delivery date";
    case "gift":
      return "Gift message";
    case "checkout_form":
      return "Checkout";
    case "checkout":
      return "Order summary";
    case "tracking":
      return "Order tracking";
    case "surprise":
      return "Surprise me";
    case "hamper":
      return "Gift hamper";
    case "kit":
      return "Smart kit";
    case "watchlist":
      return "Watchlist";
    case "compare":
      return "Compare";
    case "countdown":
      return "Occasion countdown";
    case "photo_match":
      return "Photo matches";
    case "autobuy_confirm":
      return "Autobuy picks";
    default:
      return "Details";
  }
}

/**
 * Renders a single chat message — text bubbles, typing/thinking indicators,
 * quick-reply chips, and the rich in-thread cards (shelves, spotlight, checkout,
 * order, tracking, surprise, photo match). Fully self-contained: every action
 * and piece of data comes from the store.
 */
export function MessageView({ message }: { message: ChatMessage }) {
  const lang = useHala((store) => store.lang);
  const translate = useTranslate();
  const conv = useHala((store) => store.conv);
  const dislikes = useHala((store) => store.dislikes);
  const favorites = useHala((store) => store.favorites);
  const toggleFav = useHala((store) => store.toggleFav);
  const addDislike = useHala((store) => store.addDislike);
  const userSend = useHala((store) => store.userSend);
  const handleChip = useHala((store) => store.handleChip);
  const onOpenProduct = useHala((store) => store.setSkuProduct);
  const onAdd = useHala((store) => store.addProduct);
  const pushAttach = useHala((store) => store.pushAttach);
  // A real order just succeeded — remember it, drop the ordered items from
  // the cart, and show the "Order placed" card (replacing any existing one
  // so re-placing after editing updates in place instead of stacking).
  const onOrder = useHala((store) => store.recordOrderSuccess);
  const setComposerDraft = useHala((store) => store.setComposerDraft);
  const resendUserMessage = useHala((store) => store.resendUserMessage);
  const playing = useHala((store) => store.playing);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  function renderAttach(attach: Extract<ChatMessage, { kind: "attach" }>) {
    const directive = attach.directive;
    switch (directive.kind) {
      case "shelf": {
        const shown = directive.products.filter(
          (product) => !dislikes.includes(product.id),
        );
        if (shown.length === 0) return null;
        return (
          <GatedReveal gated={directive.gated} products={shown}>
            {() => (
              <ShelfWithBudget
                title={directive.title}
                sub={directive.sub}
                products={shown}
                more={directive.more}
                onAdd={onAdd}
                onOpen={onOpenProduct}
                faved={(product) => favorites.includes(product.id)}
                onFav={(product) => toggleFav(product.id)}
                onDislike={(product) => addDislike(product.id)}
              />
            )}
          </GatedReveal>
        );
      }
      case "spotlight":
        return (
          <GatedReveal gated={directive.gated} products={[directive.product]}>
            {() => <Spotlight product={directive.product} onAdd={onAdd} />}
          </GatedReveal>
        );
      case "checkout_form":
        return (
          <CheckoutForm
            cityName={conv.city}
            dateISO={conv.date}
            dateLabel={conv.dateLabel}
            gift={conv.gift}
            onOrder={onOrder}
          />
        );
      case "checkout":
        return (
          <OrderPlaced
            order={directive.order}
            onTrack={() =>
              pushAttach({ kind: "tracking", order: directive.order })
            }
          />
        );
      case "tracking":
        return (
          <OrderTracker
            order={directive.order ?? conv.lastOrder ?? undefined}
          />
        );
      case "surprise":
        return <SurpriseMe onComplete={(brief) => userSend(brief)} />;
      case "hamper":
        return <HamperBuilder />;
      case "kit":
        return <KitBuilder />;
      case "watchlist":
        return <WatchlistCard />;
      case "compare":
        return (
          <CompareCard
            messageId={attach.id}
            products={directive.products}
            savedDetail={directive.detail}
            savedComparison={directive.comparison}
          />
        );
      case "countdown":
        return <OccasionReminder />;
      case "autobuy_confirm":
        return (
          <AutobuyConfirm
            products={directive.products}
            alternates={directive.alternates}
            budget={directive.budget}
            currency={directive.currency}
          />
        );
      case "photo_match": {
        const shown = directive.products.filter(
          (product) => !dislikes.includes(product.id),
        );
        return (
          <GatedReveal gated={directive.gated} products={shown}>
            {() => (
              <PhotoMatchCard
                srcs={attach.photos}
                products={shown}
                onAdd={onAdd}
                onOpen={onOpenProduct}
                faved={(product) => favorites.includes(product.id)}
                onFav={(product) => toggleFav(product.id)}
                onDislike={(product) => addDislike(product.id)}
              />
            )}
          </GatedReveal>
        );
      }
      default:
        return null;
    }
  }

  const cls =
    lang === "si"
      ? "si-text"
      : lang === "ta"
        ? "ta-text"
        : lang === "ar"
          ? "ar-text"
          : "";

  if (message.kind === "typing" || message.kind === "thinking") {
    return (
      <div className="row">
        <div className="avatar">
          <Image
            src="/hala-logo.svg"
            alt={translate("Hala")}
            width={34}
            height={34}
            unoptimized
          />
        </div>
        <div className="bubble-wrap">
          {message.kind === "thinking" ? (
            <Thinking />
          ) : (
            <div className="bubble">
              <div className="typing">
                <i />
                <i />
                <i />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (message.kind === "chips") {
    return <Chips items={message.items} onPick={handleChip} />;
  }

  if (message.kind === "warning") {
    return <WarningAlert />;
  }

  if (message.kind === "steps") {
    return <AgentSteps items={message.items} done={message.done} />;
  }

  if (message.kind === "attach") {
    // Product-showing cards don't need close/reopen (users remove items
    // individually); only the flow cards get the collapsible shell.
    const kind = message.directive.kind;
    // These cards carry their own header, so they skip the collapsible shell.
    const isProductCard =
      kind === "shelf" ||
      kind === "spotlight" ||
      kind === "photo_match" ||
      kind === "hamper" ||
      kind === "kit" ||
      kind === "countdown" ||
      kind === "autobuy_confirm";
    return (
      <div className="attach-full">
        <div className="attach">
          {isProductCard ? (
            renderAttach(message)
          ) : (
            <CardShell title={translate(attachTitle(message.directive))}>
              {renderAttach(message)}
            </CardShell>
          )}
        </div>
      </div>
    );
  }

  const isUser = message.role === "user";
  const photos = message.photos ?? [];
  return (
    <div className={"row" + (isUser ? " user" : "")} data-mid={message.id}>
      {isUser ? (
        <div className="avatar avatar-user">
          <Icon name="user" size={18} />
        </div>
      ) : (
        <div className="avatar">
          <Image
            src="/hala-logo.svg"
            alt={translate("Hala")}
            width={34}
            height={34}
            unoptimized
          />
        </div>
      )}
      <div className="bubble-wrap">
        {/* Media renders independently of the text bubble: a transparent,
            scrollable strip of thumbnails with gaps. Tap to open the viewer. */}
        {photos.length > 0 && (
          <div className="msg-media" data-count={photos.length}>
            {photos.map((src, index) => (
              <button
                key={index}
                className="msg-media-item"
                onClick={() => setViewerIndex(index)}
                aria-label={`View photo ${index + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`Attached ${index + 1}`} />
              </button>
            ))}
          </div>
        )}
        {message.text && (
          <div className={"bubble" + (isUser ? " has-edit" : "")}>
            <p
              className={(message.lead && !isUser ? "lead " : "") + cls}
              dir="auto"
            >
              {message.text}
            </p>
            {isUser && (
              <button
                className="bubble-edit"
                onClick={() => setComposerDraft(message.text)}
                title={translate("Edit & resend")}
                aria-label={translate("Edit & resend")}
              >
                <Icon name="pencil" size={12} />
              </button>
            )}
          </div>
        )}
        <div className="msg-foot">
          {message.at && (
            <span className="msg-time">{formatTime(message.at)}</span>
          )}
          {/* "Try again": re-send this user message (re-running the turn). Shown
              only on the user bubble — never on the assistant reply. Hidden while
              a turn is still streaming. */}
          {isUser && message.text && !playing && (
            <button
              className="bubble-retry"
              onClick={() => resendUserMessage(message.id)}
              title={translate("Try again")}
              aria-label={translate("Re-send this message")}
            >
              <Icon name="redo" size={12} />
              <span>{translate("Try again")}</span>
            </button>
          )}
        </div>
      </div>

      <ImageViewer
        images={photos}
        index={viewerIndex}
        onClose={() => setViewerIndex(null)}
      />
    </div>
  );
}
