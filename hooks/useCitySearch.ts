"use client";
import { useEffect, useRef, useState } from "react";
import type { City } from "@/types";

/** Delivery-city selection + live MCP city search (debounced), extracted out
 *  of CheckoutForm so the form itself stays focused on checkout activity. */
export function useCitySearch(initialCity: string) {
  const [city, setCity] = useState(initialCity);
  const [citySearch, setCitySearch] = useState("");
  const [cityResults, setCityResults] = useState<City[]>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const cityDeb = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live city resolver (MCP) — debounced.
  useEffect(() => {
    const query = citySearch.trim();
    if (cityDeb.current) clearTimeout(cityDeb.current);
    cityDeb.current = setTimeout(async () => {
      if (query.length < 2) {
        setCityResults([]);
        setCityLoading(false);
        return;
      }
      setCityLoading(true);
      try {
        const result = await fetch(
          "/api/delivery/cities?q=" + encodeURIComponent(query),
        ).then((response) => response.json());
        setCityResults((result.cities ?? []) as City[]);
      } catch {
        setCityResults([]);
      }
      setCityLoading(false);
    }, 250);
    return () => {
      if (cityDeb.current) clearTimeout(cityDeb.current);
    };
  }, [citySearch]);

  return {
    city,
    setCity,
    citySearch,
    setCitySearch,
    cityResults,
    setCityResults,
    cityLoading,
  };
}
