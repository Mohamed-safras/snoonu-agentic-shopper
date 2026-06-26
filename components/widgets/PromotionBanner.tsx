"use client";
import { OccasionCountdown } from "./OccasionCountdown";
import { useTrova } from "@/store";

/**
 * Promo banner slot. Self-contained: reads its open/closed state and the send
 * action straight from the store (open on the landing screen, collapsed once a
 * conversation starts, or forced via the header toggle).
 */
const PromotionBanner = () => {
  const bannerForced = useTrova((store) => store.bannerForced);
  const setBannerForced = useTrova((store) => store.setBannerForced);
  const userSend = useTrova((store) => store.userSend);
  const conversing = useTrova((store) => store.messages.length > 0);
  const bannerOpen = bannerForced ? bannerForced === "open" : !conversing;

  return (
    <div
      className={"banner-slot" + (bannerOpen ? " open" : "")}
      aria-hidden={!bannerOpen}
    >
      <div className="banner-inner">
        <OccasionCountdown
          onShopNow={(query) => userSend(query)}
          onClose={() => setBannerForced("closed")}
        />
      </div>
    </div>
  );
};

export default PromotionBanner;
