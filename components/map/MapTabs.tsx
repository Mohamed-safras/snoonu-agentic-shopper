"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { Icon } from "@/components/ui/Icon";
import { useTranslate } from "@/hooks/useTranslate";

const mapLoading = () => (
  <div className="zone-map-leaflet" style={{ height: 240 }} />
);
const DeliveryMap = dynamic(
  () => import("./DeliveryMap").then((map) => map.DeliveryMap),
  { ssr: false, loading: mapLoading },
);
const DeliveryZones = dynamic(
  () => import("./DeliveryZones").then((map) => map.DeliveryZones),
  { ssr: false, loading: mapLoading },
);

/**
 * Two map tabs: (1) the route to THIS order's destination (live route +
 * confirm-pin), and (2) all 25 district delivery zones with predicted windows.
 */
export function MapTabs({
  destName,
  address,
  pinned,
  onPick,
}: {
  destName?: string;
  address?: string;
  pinned?: { lat: number; lng: number } | null;
  onPick?: (lat: number, lng: number, source: "geocode" | "drag") => void;
}) {
  const [tab, setTab] = useState<"route" | "zones">("route");
  const translate = useTranslate();
  return (
    <div className="map-tabs">
      <div className="map-tabs-bar">
        <button
          className={"map-tab" + (tab === "route" ? " on" : "")}
          onClick={() => setTab("route")}
        >
          <Icon name="pin" size={13} /> {translate("Your delivery")}
        </button>
        <button
          className={"map-tab" + (tab === "zones" ? " on" : "")}
          onClick={() => setTab("zones")}
        >
          <Icon name="truck" size={13} /> {translate("Delivery zones")}
        </button>
      </div>
      {tab === "route" ? (
        <DeliveryMap
          destName={destName}
          address={address}
          pinned={pinned}
          onPick={onPick}
        />
      ) : (
        <DeliveryZones highlight={destName} />
      )}
    </div>
  );
}
