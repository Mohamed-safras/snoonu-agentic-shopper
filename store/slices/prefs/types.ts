import type { Lang } from "@/types";

/** A product the shopper is watching for price drops / restock. */
export interface WatchItem {
  id: string;
  name: string;
  image?: string;
  price: number;
  currency: string;
  url?: string;
  /** Last-known stock state, to detect a back-in-stock transition. */
  inStock?: boolean;
}

/** Recipient + delivery details remembered from the last successful order. */
export interface DeliveryProfile {
  recipientName: string;
  phone: string;
  address: string;
  city: string;
  locationType: "house" | "apartment" | "office" | "other";
  instructions: string;
  senderName: string;
}

/** Durable shopper preferences (favorites, dislikes, remembered sender name). */
export interface PrefsSlice {
  favorites: string[];
  toggleFav: (id: string) => void;
  /** Products the shopper removed/disliked — filtered out of future shelves. */
  dislikes: string[];
  addDislike: (id: string) => void;
  /** Remembered sender name so repeat checkout is pre-filled (faster). */
  checkoutName: string;
  setCheckoutName: (name: string) => void;
  /** Remembered recipient/delivery details from the last successful order, so
   *  a repeat checkout (and autobuy's hand-off into it) is pre-filled instead
   *  of asking again. Saved only after an order actually succeeds. */
  deliveryProfile: DeliveryProfile | null;
  setDeliveryProfile: (profile: DeliveryProfile) => void;
  /** Read assistant replies aloud (hands-free TTS). On by default. */
  speak: boolean;
  toggleSpeak: () => void;
  /** Chosen read-aloud voice per language (Edge neural voice id), so native
   *  Arabic / Sinhala / Tamil speakers each keep their own preferred voice. */
  voiceByLanguage: Record<Lang, string>;
  setVoiceForLanguage: (language: Lang, voiceId: string) => void;
  /** Products the shopper is watching for price drops / back-in-stock. */
  watches: WatchItem[];
  toggleWatch: (item: WatchItem) => void;
  removeWatch: (id: string) => void;
  /** Replace the watch snapshots (after an on-open price/stock refresh). */
  updateWatches: (next: WatchItem[]) => void;
  /** Shopper confirmed they're 18+ after an explicit-content warning, so it
   *  isn't asked again for the rest of the session. */
  ageConfirmed: boolean;
  confirmAge: () => void;
}
