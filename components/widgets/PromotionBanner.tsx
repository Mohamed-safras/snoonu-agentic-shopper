"use client";
import { OccasionCountdown } from "./OccasionCountdown";
import { useHala } from "@/store";

/**
 * Promo banner slot. Self-contained: reads its open/closed state and the send
 * action straight from the store (open on the landing screen, collapsed once a
 * conversation starts, or forced via the header toggle).
 */
const PromotionBanner = () => {
  const bannerForced = useHala((store) => store.bannerForced);
  const setBannerForced = useHala((store) => store.setBannerForced);
  const userSend = useHala((store) => store.userSend);
  const conversing = useHala((store) => store.messages.length > 0);
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
