"use client";
import { Icon } from "@/components/ui/Icon";
import { useTrova } from "@/store";

/** Corner chevron that shows/hides the promo banner. */
export function BannerToggle() {
  const bannerForced = useTrova((store) => store.bannerForced);
  const setBannerForced = useTrova((store) => store.setBannerForced);
  const conversing = useTrova((store) => store.messages.length > 0);
  const bannerOpen = bannerForced ? bannerForced === "open" : !conversing;

  return (
    <button
      className={"banner-chevron" + (bannerOpen ? " open" : "")}
      onClick={() => setBannerForced(bannerOpen ? "closed" : "open")}
      title={bannerOpen ? "Hide offers" : "Show offers & deals"}
      aria-label={bannerOpen ? "Hide offers banner" : "Show offers banner"}
    >
      <Icon name="chevron" size={18} />
    </button>
  );
}
