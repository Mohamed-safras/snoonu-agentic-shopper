"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { CityMatchPill } from "@/components/widgets/McpBadges";
import type { City } from "@/types";
import { useTranslate } from "@/hooks/useTranslate";

/** Live city resolver (MCP). Calls onPick with the canonical city. The route
 *  map + exact-location pin live in the checkout step (where the address is). */
export function DeliveryCard({
  selectedCity,
  onPick,
}: {
  selectedCity?: string | null;
  onPick: (cityName: string) => void;
}) {
  const translate = useTranslate();
  const [query, setQuery] = useState("");
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(false);
  const [match, setMatch] = useState<{
    alias: string;
    canonical: string;
  } | null>(null);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) return;
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          "/api/delivery/cities?q=" + encodeURIComponent(query.trim()),
        ).then((r) => r.json());
        setCities(res.cities ?? []);
      } catch {
        setCities([]);
      }
      setLoading(false);
    }, 280);
    return () => {
      if (debRef.current) clearTimeout(debRef.current);
    };
  }, [query]);

  function pick(c: City) {
    const q = query.trim().toLowerCase();
    const aliasHit = c.aliases?.find((a) => a.toLowerCase() === q);
    if (aliasHit && c.name.toLowerCase() !== q) {
      setMatch({ alias: query.trim(), canonical: c.name });
    }
    onPick(c.name);
  }

  return (
    <div className="panel">
      <div className="panel-h">
        <span className="pi">
          <Icon name="pin" size={17} />
        </span>
        <div style={{ flex: 1 }}>
          <h4>{translate("Where are we delivering?")}</h4>
          <div className="sub">{translate("Island-wide · type a city or local name")}</div>
        </div>
      </div>

      <div className="addr-row" style={{ marginTop: 4 }}>
        <input
          className="addr-input"
          placeholder={translate("e.g. Kandy, Galle, Nugegoda…")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="addr-go" disabled={!query.trim() || loading}>
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

      {match && (
        <div style={{ margin: "10px 0 0" }}>
          <CityMatchPill alias={match.alias} canonical={match.canonical} />
        </div>
      )}

      {query.trim().length >= 2 && cities.length > 0 && (
        <div className="chips" style={{ marginTop: 10, flexWrap: "wrap" }}>
          {cities.map((c) => (
            <button
              key={c.key}
              className={"chip" + (selectedCity === c.name ? " primary" : "")}
              onClick={() => pick(c)}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
