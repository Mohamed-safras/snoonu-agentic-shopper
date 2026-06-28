"use client";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { LiveBadge } from "@/components/widgets/McpBadges";
import { fmtPrice } from "@/lib/format/money";
import { useHala } from "@/store";
import { useTranslate } from "@/hooks/useTranslate";

interface Feasibility {
  available: boolean;
  fee: number;
  currency: string;
  perishableWarning?: string;
}

const titleCase = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

/** Local YYYY-MM-DD (matches the <input type="date"> value, unlike UTC ISO). */
const localDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Occasion Countdown: pick the date of the occasion → a live countdown, plus a
 * REAL "can we deliver on the day?" check (MCP delivery quote) so the shopper
 * knows they're in time, and a one-tap jump to finding the gift.
 */
export function OccasionReminder() {
  const occasion = useHala((store) => store.conv.occasion);
  const city = useHala((store) => store.conv.city);
  const userSend = useHala((store) => store.userSend);
  const translate = useTranslate();

  const [date, setDate] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [feasibilityState, setFeasibilityState] = useState<Feasibility | null>(
    null,
  );
  const [checking, setChecking] = useState(false);
  // Only meaningful when both a date and city are set — derived so we never have
  // to reset state synchronously in an effect when they're cleared.
  const feasibility = date && city ? feasibilityState : null;

  // Tick once a second while a date is set, for the live countdown.
  useEffect(() => {
    if (!date) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [date]);

  // Real delivery feasibility for that date + city.
  useEffect(() => {
    if (!date || !city) return; // nothing to fetch; `feasibility` derives to null
    let cancelled = false;
    // The work runs in an async function (not the effect body) so the loading +
    // result state updates happen in callbacks, not synchronously in the effect.
    void (async () => {
      setChecking(true);
      try {
        const quote = await fetch(
          `/api/delivery/quote?city=${encodeURIComponent(city)}&date=${date}`,
        ).then((response) => response.json());
        if (cancelled) return;
        setFeasibilityState(
          quote && typeof quote.available === "boolean"
            ? {
                available: quote.available,
                fee: quote.fee ?? 0,
                currency: quote.currency ?? "QAR",
                perishableWarning: quote.perishableWarning,
              }
            : null,
        );
      } catch {
        if (!cancelled) setFeasibilityState(null);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date, city]);

  const todayString = localDateString(new Date(now));
  const isToday = Boolean(date) && date === todayString;
  const isPast = Boolean(date) && date < todayString;
  // Count down to the START of the occasion day (local midnight) for future dates.
  const target = date ? new Date(date + "T00:00:00").getTime() : 0;
  const remaining = Math.max(0, target - now);
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  const label = occasion ? titleCase(occasion) : translate("Your occasion");

  return (
    <div className="countdown">
      <div className="countdown-h">
        <span className="countdown-h-icon">
          <Icon name="clock" size={18} />
        </span>
        <div className="countdown-h-text">
          <span className="countdown-h-lbl">
            {translate("Occasion countdown")}
          </span>
          <h4>{translate("{label} — don't miss the day", { label })}</h4>
        </div>
      </div>

      <label className="countdown-field">
        <span>{translate("When's the big day?")}</span>
        <input
          type="date"
          className="addr-input"
          value={date}
          min={todayString}
          onChange={(event) => setDate(event.target.value)}
        />
      </label>

      {date && !isPast && !isToday && (
        <div className="countdown-clock">
          {[
            { value: days, unit: translate("days") },
            { value: hours, unit: translate("hrs") },
            { value: minutes, unit: translate("min") },
            { value: seconds, unit: translate("sec") },
          ].map((cell) => (
            <div className="countdown-unit" key={cell.unit}>
              <b>{String(cell.value).padStart(2, "0")}</b>
              <span>{cell.unit}</span>
            </div>
          ))}
        </div>
      )}

      {isToday && (
        <div className="countdown-note today">
          <Icon name="spark" size={15} />{" "}
          {translate("It's today — send some love!")}
        </div>
      )}
      {isPast && (
        <div className="countdown-note">
          {translate("That date has passed — pick another?")}
        </div>
      )}

      {date && !isPast && city && (
        <div
          className={
            "countdown-feas" +
            (feasibility && !feasibility.available ? " warn" : "")
          }
        >
          <Icon
            name={feasibility?.available === false ? "truck2" : "truck"}
            size={15}
          />
          {checking ? (
            <span>{translate("Checking delivery to {city}…", { city })}</span>
          ) : feasibility ? (
            feasibility.available ? (
              <span>
                {translate("Deliverable to {city} on the day · {fee}", {
                  city,
                  fee: fmtPrice(feasibility.fee, feasibility.currency),
                })}
                {feasibility.perishableWarning
                  ? ` · ${feasibility.perishableWarning}`
                  : ""}{" "}
                <LiveBadge tool="snoonu_check_delivery" />
              </span>
            ) : (
              <span>
                {translate(
                  "Not deliverable to {city} on that date — try ordering earlier.",
                  { city },
                )}
              </span>
            )
          ) : (
            <span>
              {translate("Set a delivery city in checkout to confirm timing.")}
            </span>
          )}
        </div>
      )}

      {date && !isPast && (
        <button
          className="countdown-cta"
          onClick={() =>
            userSend(occasion ? `gift ideas for ${occasion}` : "gift ideas")
          }
        >
          <Icon name="spark" size={15} /> {translate("Find the perfect gift")}
        </button>
      )}
    </div>
  );
}
