"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslate } from "@/hooks/useTranslate";

/** Delivery address + map-pin handling: typed-address autocomplete (live
 *  geocoding), reverse-geocoding a dropped/dragged pin back into the address
 *  box, and browser "use my location". Extracted out of CheckoutForm so the
 *  form itself stays focused on checkout activity. */
export function useAddressMap(opts: {
  city: string;
  setCity: (city: string) => void;
}) {
  const translate = useTranslate();
  const [address, setAddress] = useState("");
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [mapAddress, setMapAddress] = useState("");
  // Map is shown by default so the confirm-pin is immediately usable; it can
  // be collapsed to shorten the form.
  const [showMap, setShowMap] = useState(true);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState("");

  // When the address change came from dragging the map pin (reverse geocode),
  // skip re-geocoding it back onto the map — otherwise the pin would jump.
  const skipNextGeocode = useRef(false);
  // True right after a suggestion is chosen, so we don't re-fetch suggestions.
  const justPickedAddr = useRef(false);

  // Address autocomplete (Uber/PickMe-style): live geocoded suggestions for
  // the typed address; picking one drops the EXACT pin + route.
  const [addrResults, setAddrResults] = useState<
    { label: string; lat: number; lng: number }[]
  >([]);
  const addrDeb = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (justPickedAddr.current) {
      justPickedAddr.current = false;
      return;
    }
    const query = address.trim();
    if (addrDeb.current) clearTimeout(addrDeb.current);
    addrDeb.current = setTimeout(async () => {
      if (query.length < 4) {
        setAddrResults([]);
        return;
      }
      try {
        const res = await fetch(
          "/api/geocode?q=" +
            encodeURIComponent(opts.city ? `${query}, ${opts.city}` : query),
        ).then((response) => response.json());
        setAddrResults(
          Array.isArray(res?.results) ? res.results.slice(0, 6) : [],
        );
      } catch {
        setAddrResults([]);
      }
    }, 350);
    return () => {
      if (addrDeb.current) clearTimeout(addrDeb.current);
    };
  }, [address, opts.city]);

  // Choose a suggestion → set the address + drop the EXACT pin (map reflects it).
  function pickAddress(result: { label: string; lat: number; lng: number }) {
    justPickedAddr.current = true;
    skipNextGeocode.current = true; // keep the chosen pin (don't re-geocode away)
    setAddress(result.label);
    setMapAddress(result.label);
    setPin({ lat: result.lat, lng: result.lng });
    setAddrResults([]);
    setShowMap(true);
  }

  // Debounce the typed address, then geocode it onto the map. Typing
  // overrides any confirmed pin (clear it) so the map re-geocodes the new
  // address; a pin drag/tap/location sets skipNextGeocode so it isn't undone
  // here.
  useEffect(() => {
    if (skipNextGeocode.current) {
      skipNextGeocode.current = false;
      return;
    }
    const time = setTimeout(() => {
      setMapAddress(address.trim());
      setPin(null);
    }, 600);
    return () => clearTimeout(time);
  }, [address]);

  // Drag the pin → reverse-geocode to a human address and fill the input
  // box, so the map and the address field stay in sync (both stay editable).
  async function fillAddressFromPin(lat: number, lng: number) {
    try {
      const result = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`).then(
        (response) => response.json(),
      );
      const label =
        (result?.address as string | undefined)?.trim() ||
        `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      skipNextGeocode.current = true;
      justPickedAddr.current = true; // don't pop the autocomplete for autofill
      setAddress(label);
      // Auto-fill the delivery city when none is set yet (e.g. after "use my
      // location"), so the date picker appears.
      if (result?.city && !opts.city) opts.setCity(String(result.city));
    } catch {
      /* keep whatever the user typed */
    }
  }

  // Browser geolocation → drop the pin, draw the route, and reverse-geocode
  // to fill the address + city (Uber/PickMe-style "use my location").
  function useMyLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocateError(
        translate(
          "Location isn't available here — tap the map to set your spot.",
        ),
      );
      return;
    }
    setLocating(true);
    setLocateError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setPin({ lat: latitude, lng: longitude });
        setShowMap(true);
        void fillAddressFromPin(latitude, longitude);
        setLocating(false);
      },
      () => {
        setLocateError(
          translate(
            "Couldn't get your location — allow permission, or tap the map to set it.",
          ),
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  function handlePinPick(lat: number, lng: number, source: "geocode" | "drag") {
    setPin({ lat, lng });
    if (source === "drag") void fillAddressFromPin(lat, lng);
  }

  return {
    address,
    setAddress,
    pin,
    setPin,
    mapAddress,
    showMap,
    setShowMap,
    locating,
    locateError,
    addrResults,
    setAddrResults,
    pickAddress,
    useMyLocation,
    handlePinPick,
  };
}
