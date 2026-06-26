"use client";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useTrova } from "@/store";
import { fmtPrice } from "@/lib/format/money";
import type { DeliveryQuote } from "@/types";
import { useTranslate } from "@/hooks/useTranslate";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function dateLabelOf(iso: string): string {
  const date = new Date(iso + "T00:00:00");
  return `${DOW[date.getDay()]}, ${date.getDate()} ${MON[date.getMonth()]}`;
}
const toISO = (date: Date) => date.toISOString().slice(0, 10);

/**
 * 10-day grid whose availability + fee + perishable warning come from the REAL
 * Snoonu check_delivery tool for the chosen city.
 */
export function DatePicker({
  cityName,
  selected,
  onPick,
}: {
  cityName?: string | null;
  selected?: string | null;
  onPick: (iso: string, label: string, sameDay: boolean) => void;
}) {
  const productId = useTrova((store) => store.cart[0]?.id);
  const translate = useTranslate();
  const [avail, setAvail] = useState<Record<string, DeliveryQuote | null>>({});
  const [loading, setLoading] = useState(false);

  const today = new Date();
  const cells = Array.from({ length: 10 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    return { index, date, iso: toISO(date) };
  });

  // Fetch real availability for each date once we know the city.
  useEffect(() => {
    if (!cityName) return;
    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    Promise.all(
      cells.map((cell) =>
        fetch(
          `/api/delivery/quote?city=${encodeURIComponent(cityName)}&date=${cell.iso}` +
            (productId ? `&product=${encodeURIComponent(productId)}` : ""),
        )
          .then((response) => response.json())
          .then(
            (date) => [cell.iso, date.quote as DeliveryQuote | null] as const,
          )
          .catch(() => [cell.iso, null] as const),
      ),
    ).then((entries) => {
      if (!alive) return;
      setAvail(Object.fromEntries(entries));
      setLoading(false);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityName, productId]);

  const firstAvail = cells.find((cell) => avail[cell.iso]?.available);
  const selectedQuote = selected ? avail[selected] : null;

  return (
    <div className="panel">
      <div className="panel-h">
        <span className="pi">
          <Icon name="calendar" size={17} />
        </span>
        <div style={{ flex: 1 }}>
          <h4>{translate("When should it arrive?")}</h4>
          <div className="sub">
            {translate("Delivering to")}{" "}
            <b style={{ color: "var(--ink)" }}>
              {cityName || translate("your city")}
            </b>
            {loading ? " · " + translate("checking dates…") : ""}
          </div>
        </div>
      </div>

      <div className="dates">
        {cells.map((cell) => {
          const query = avail[cell.iso];
          const known = cell.iso in avail;
          const unavailable = known && query && !query.available;
          return (
            <button
              key={cell.iso}
              className={
                "date-cell" +
                (selected === cell.iso ? " on" : "") +
                (unavailable ? " dis" : "") +
                (cell === firstAvail ? " earliest" : "")
              }
              disabled={!!unavailable}
              onClick={() =>
                onPick(cell.iso, dateLabelOf(cell.iso), cell.index === 0)
              }
            >
              <div className="dow">{DOW[cell.date.getDay()]}</div>
              <div className="dnum">{cell.date.getDate()}</div>
              <div className="dmon">{MON[cell.date.getMonth()]}</div>
              {cell === firstAvail && (
                <div className="tag earliest-tag">{translate("Earliest")}</div>
              )}
            </button>
          );
        })}
      </div>

      {selectedQuote && (
        <div
          className={"quote-box" + (selectedQuote.available ? "" : " warn")}
          style={{ marginTop: 14 }}
        >
          <span className="quote-ic">
            <Icon
              name={selectedQuote.available ? "bolt" : "truck2"}
              size={20}
            />
          </span>
          <div className="quote-main" style={{ flex: 1 }}>
            <b>
              {selectedQuote.available
                ? translate("Available")
                : translate("Not available")}{" "}
              ·{" "}
              {translate("{price} delivery", {
                price: fmtPrice(selectedQuote.fee, selectedQuote.currency),
              })}
            </b>
            {selectedQuote.perishableWarning && (
              <div style={{ color: "#8B4500" }}>
                ⚠️ {selectedQuote.perishableWarning}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
