"use client";
import { Icon } from "@/components/ui/Icon";
import { useHala } from "@/store";

/** Corner chevron that shows/hides the promo banner. */
export function BannerToggle() {
  const bannerForced = useHala((store) => store.bannerForced);
  const setBannerForced = useHala((store) => store.setBannerForced);
  const conversing = useHala((store) => store.messages.length > 0);
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
