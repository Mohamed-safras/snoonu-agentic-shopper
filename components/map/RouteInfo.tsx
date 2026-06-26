"use client";
import { useTranslate } from "@/hooks/useTranslate";

/** Distance + ETA strip shown under the delivery route map. */
export function RouteInfo({ km, min }: { km: string; min: number }) {
  const translate = useTranslate();
  return (
    <div className="route-info">
      <span>📍 {translate("{km} km from Snoonu HQ", { km })}</span>
      <span>⏱ {translate("~{min} min delivery drive", { min })}</span>
    </div>
  );
}
