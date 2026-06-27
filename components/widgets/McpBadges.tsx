"use client";
import { useEffect, useState } from "react";
import { useHala } from "@/store";
import { useTranslate } from "@/hooks/useTranslate";

/** Gold pulsing "live data" badge. */
export function LiveBadge({
  tool,
  label = "LIVE",
}: {
  tool?: string;
  label?: string;
}) {
  const translate = useTranslate();
  return (
    <span
      className="mcp-live"
      title={
        tool
          ? translate("Live data from Snoonu · {tool}", { tool })
          : translate("Live data from Snoonu")
      }
    >
      <span className="mcp-live-dot" />
      <span className="mcp-live-text">{label}</span>
    </span>
  );
}

/** Vernacular city alias → canonical resolution pill. */
export function CityMatchPill({
  alias,
  canonical,
}: {
  alias: string;
  canonical: string;
}) {
  const translate = useTranslate();
  return (
    <div className="city-match-pill">
      <span className="city-match-from">{alias}</span>
      <span aria-hidden>→</span>
      <span className="city-match-to">{canonical}</span>
      <span className="city-match-check">{translate("✓ matched")}</span>
    </div>
  );
}

/** Same-day delivery window meter (clock-aware, Asia/Colombo-ish local time). */
export function CutoffHeatBar({ cutoffHour = 14 }: { cutoffHour?: number }) {
  const translate = useTranslate();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const start = 8;
  const hours = now.getHours() + now.getMinutes() / 60;
  const progress = Math.max(
    0,
    Math.min(1, (hours - start) / (cutoffHour - start)),
  );
  const past = hours >= cutoffHour;
  const warn = !past && hours >= cutoffHour - 1.5;

  const fill = past
    ? "linear-gradient(90deg,#C73838,#A02020)"
    : warn
      ? "linear-gradient(90deg,#F5C200,#E57C00)"
      : "linear-gradient(90deg,#3CD27A,#1F8A5B)";

  return (
    <div className="cutoff-wrap">
      <div className="cutoff-head">
        <div className="cutoff-title">
          <span className="cutoff-pulse" /> {translate("Same-day window")}
        </div>
        <div
          className={"cutoff-status" + (past ? " past" : warn ? " warn" : "")}
        >
          {past
            ? translate("Cutoff passed · next-day delivery")
            : warn
              ? translate("Closing soon · order in {min}m", {
                  min: Math.floor((cutoffHour - hours) * 60),
                })
              : translate("Open until {hour}:00", { hour: cutoffHour })}
        </div>
      </div>
      <div className="cutoff-track">
        <div
          className="cutoff-fill"
          style={{ width: progress * 100 + "%", background: fill }}
        />
        <div className="cutoff-cutoff" />
      </div>
      <div className="cutoff-foot">
        <span>{start}:00</span>
        <span>{translate("{hour}:00 cutoff", { hour: cutoffHour })}</span>
      </div>
    </div>
  );
}

const TRUST_TOOLS = [
  { k: "snoonu_search_products", ico: "🔍", short: "search" },
  { k: "snoonu_get_product", ico: "📦", short: "product" },
  { k: "snoonu_list_categories", ico: "🗂️", short: "categories" },
  { k: "snoonu_list_delivery_cities", ico: "📍", short: "cities" },
  { k: "snoonu_check_delivery", ico: "🚚", short: "delivery" },
  { k: "snoonu_create_order", ico: "🧾", short: "order" },
  { k: "snoonu_track_order", ico: "📦", short: "tracking" },
];

/** Footer strip lighting up the MCP tools the agent has used this session. */
export function McpTrustStrip() {
  const activeTools = useHala((s) => s.activeTools);
  const translate = useTranslate();
  return (
    <div className="mcp-trust">
      <span className="mcp-trust-label">
        <span className="mcp-trust-pulse" />{" "}
        {translate("Powered by Snoonu MCP")}
      </span>
      <div className="mcp-trust-tools">
        {TRUST_TOOLS.map((t) => (
          <span
            key={t.k}
            className={
              "mcp-trust-tool" + (activeTools.includes(t.k) ? " on" : "")
            }
            title={t.k}
          >
            <span className="mcp-trust-ico">{t.ico}</span>
            <span className="mcp-trust-short">{t.short}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
