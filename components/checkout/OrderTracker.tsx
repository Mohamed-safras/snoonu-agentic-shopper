"use client";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { MapTabs } from "@/components/map/MapTabs";
import type { Order } from "@/types";
import { useTranslate } from "@/hooks/useTranslate";

interface TrackEvent {
  title: string;
  detail?: string;
}

/** Pull a timeline + summary out of the (real) track_order JSON, defensively. */
function parseTracking(trackingData: unknown): {
  status?: string;
  recipient?: string;
  greeting?: string;
  items?: string[];
  events: TrackEvent[];
} {
  const data = (trackingData ?? {}) as Record<string, unknown>;
  const rawEvents =
    (data.events as unknown[]) ||
    (data.history as unknown[]) ||
    (data.timeline as unknown[]) ||
    (data.progress as unknown[]) ||
    [];
  const events: TrackEvent[] = rawEvents.map((event) => {
    if (typeof event === "string") return { title: event };
    const order = event as Record<string, unknown>;
    return {
      title: String(
        order.title ||
          order.step ||
          order.status ||
          order.label ||
          order.event ||
          "Update",
      ),
      detail:
        [order.time, order.timestamp, order.date, order.location]
          .filter(Boolean)
          .map(String)
          .join(" · ") || undefined,
    };
  });
  const items = Array.isArray(data.items)
    ? (data.items as unknown[]).map((it) =>
        typeof it === "string"
          ? it
          : String((it as Record<string, unknown>).name ?? JSON.stringify(it)),
      )
    : undefined;
  // `recipient` comes back as a {name, phone, address, city} object, not a
  // string — naive String() coercion produced a literal "[object Object]".
  const rawRecipient = data.recipient;
  const recipient =
    rawRecipient && typeof rawRecipient === "object"
      ? String((rawRecipient as Record<string, unknown>).name || "") ||
        undefined
      : rawRecipient
        ? String(rawRecipient)
        : undefined;
  return {
    status: data.status_display
      ? String(data.status_display)
      : data.status
        ? String(data.status)
        : undefined,
    recipient,
    greeting: data.greeting_message
      ? String(data.greeting_message).trim() || undefined
      : undefined,
    items,
    events,
  };
}

/** Live order tracking. Renders REAL track_order data; honest about refs. */
export function OrderTracker({ order }: { order?: Order }) {
  // Only the just-placed order is shown (its map/journey). We don't list saved
  // orders — their create_order references aren't trackable; tracking uses the
  // order number Snoonu emails after payment, pasted below.
  const selected = order;
  const translate = useTranslate();
  const [number, setNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ReturnType<typeof parseTracking> | null>(
    null,
  );
  const [text, setText] = useState<string | null>(null);

  async function track() {
    const num = number.trim();
    if (num.length < 4) return;
    setLoading(true);
    setData(null);
    setText(null);
    try {
      const result = await fetch(
        "/api/track?order=" + encodeURIComponent(num),
      ).then((response) => response.json());
      if (result.data && typeof result.data === "object") {
        setData(parseTracking(result.data));
      } else {
        const raw = `${result.text || ""} ${result.error || ""}`.toLowerCase();
        const notFound =
          /not.?found|no order|does not exist|doesn't exist/.test(raw);
        setText(
          notFound
            ? translate(
                "We couldn't find that order yet. The trackable order number is the one Snoonu emails you once payment is completed — paste that number here (not the order reference shown above).",
              )
            : result.text ||
                translate("No details found for that order number."),
        );
      }
    } catch {
      setText(
        translate(
          "Couldn't fetch tracking — check the order number and try again.",
        ),
      );
    }
    setLoading(false);
  }

  return (
    <div className="track">
      <div className="track-head">
        <div>
          <div className="track-head-lbl">{translate("Order tracking")}</div>
          {selected && <div className="track-head-id">{selected.id}</div>}
        </div>
        <span className="live-badge">
          <span className="live-dot" /> {translate("LIVE")}
        </span>
      </div>

      {selected?.city && (
        <div className="track-map-pad">
          <MapTabs destName={selected.city} />
        </div>
      )}

      {selected && (
        <div className="track-stats">
          <span>
            📦 {translate("Order Reference is {id}", { id: selected.id })}
          </span>{" "}
          {translate(
            "after payment completed, Snoonu emails you with order number. Paste it below to track live.",
          )}
        </div>
      )}

      {/* Expected journey — shown until real track_order events arrive. */}
      {selected && !data && (
        <div className="track-journey">
          <div className="track-journey-h">{translate("Expected journey")}</div>
          <div className="track-steps">
            {[
              {
                title: translate("Order placed"),
                detail: translate("Ref {id}", { id: selected.id }),
                state: "done",
              },
              {
                title: translate("Payment confirmed"),
                detail: translate("Pay via the link to confirm"),
                state: "active",
              },
              { title: translate("Preparing your order"), state: "pending" },
              {
                title: translate("Out for delivery"),
                detail: selected.city || undefined,
                state: "pending",
              },
              {
                title: translate("Delivered"),
                detail: selected.dateLabel || undefined,
                state: "pending",
              },
            ].map((step, index, arr) => (
              <div key={step.title} className={"tstep " + step.state}>
                <div className="tdot">
                  <i />
                  {index < arr.length - 1 && <span className="line" />}
                </div>
                <div className="tbody">
                  <div className="tt">{step.title}</div>
                  {step.detail && <div className="tm">{step.detail}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="track-lookup">
        <div className="track-lookup-h">
          <span className="pi" style={{ width: 28, height: 28 }}>
            <Icon name="clock" size={14} />
          </span>
          <div>
            <h4 style={{ fontSize: 14 }}>{translate("Track an order")}</h4>
            <div className="sub" style={{ fontSize: 11 }}>
              {translate("Enter your Snoonu order number")}{" "}
            </div>
          </div>
        </div>
        <div className="addr-row">
          <input
            className="addr-input"
            placeholder={translate("e.g. VIMP34456CB2")}
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") track();
            }}
          />
          <button
            className="addr-go"
            onClick={track}
            disabled={number.trim().length < 4 || loading}
          >
            {loading ? (
              <span className="llm-dot">
                <i />
                <i />
                <i />
              </span>
            ) : (
              <Icon name="search" size={16} />
            )}
          </button>
        </div>

        {data && (
          <div style={{ marginTop: 12 }}>
            {data.status && (
              <div
                className={
                  "track-status-badge" +
                  (/delivered/i.test(data.status) ? " delivered" : "")
                }
              >
                <Icon
                  name={/delivered/i.test(data.status) ? "check" : "truck"}
                  size={12}
                />
                {data.status}
              </div>
            )}
            {data.recipient && (
              <div className="rcpt-mini" style={{ marginBottom: 6 }}>
                <Icon name="pin" size={14} /> {translate("To")}{" "}
                <b>{data.recipient}</b>
              </div>
            )}
            {data.items?.map((it, i) => (
              <div className="rcpt-mini" key={i}>
                <Icon name="gift" size={13} /> {it}
              </div>
            ))}
            {data.greeting && (
              <div className="oplaced-gift" style={{ marginTop: 6 }}>
                <Icon name="gift" size={14} /> &ldquo;{data.greeting}&rdquo;
              </div>
            )}
            {data.events.length > 0 && (
              <div className="track-steps" style={{ padding: "12px 0 0" }}>
                {data.events.map((event, i, arr) => (
                  <div
                    key={i}
                    className={
                      "tstep " + (i === arr.length - 1 ? "active" : "done")
                    }
                  >
                    <div className="tdot">
                      <i />
                      {i < arr.length - 1 && <span className="line" />}
                    </div>
                    <div className="tbody">
                      <div className="tt">{event.title}</div>
                      {event.detail && <div className="tm">{event.detail}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {text && (
          <div
            className="rcpt-mini"
            style={{ marginTop: 12, display: "block", lineHeight: 1.5 }}
          >
            {text}
          </div>
        )}
      </div>
    </div>
  );
}
