"use client";
import { Header } from "@/components/header/Header";
import { Thread } from "@/components/chat/Thread";
import { Icon } from "@/components/ui/Icon";
import { SkuDrawer } from "@/components/product/SkuDrawer";
import { CartDrawer } from "@/components/checkout/CartDrawer";
import { OrdersDrawer } from "@/components/checkout/OrdersDrawer";
import PromotionBanner from "@/components/widgets/PromotionBanner";
import Composer from "@/components/widgets/Composer";
import { CompareBar } from "@/components/widgets/CompareBar";
import { useHala } from "@/store";

export default function Home() {
  const occasion = useHala((store) => store.conv.occasion);
  const toast = useHala((store) => store.toast);
  const skuProduct = useHala((store) => store.skuProduct);

  return (
    <div id="app" data-mood={occasion || ""}>
      <Header />

      <PromotionBanner />

      <Thread />

      {!skuProduct && <CompareBar />}

      <Composer />

      {skuProduct && <SkuDrawer key={skuProduct.id} product={skuProduct} />}

      <CartDrawer />

      <OrdersDrawer />

      {toast && (
        <div className="toast">
          <Icon name="check" size={16} /> {toast}
        </div>
      )}
    </div>
  );
}
