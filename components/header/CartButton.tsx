"use client";
import { useEffect, useRef } from "react";
import { Icon } from "@/components/ui/Icon";
import { useTrova } from "@/store";

/** Cart button (count + running total) that opens the cart drawer. Also owns
 *  the cart-driven suggestion refresh, since it lives next to the cart. */
export function CartButton() {
  const cart = useTrova((store) => store.cart);
  const setCartOpen = useTrova((store) => store.setCartOpen);
  const loadSuggestions = useTrova((store) => store.loadSuggestions);

  const count = cart.reduce((acc, item) => acc + item.quantity, 0);
  // Refresh the dynamic suggestions whenever the cart changes (skip the first
  // render — Bootstrap does the initial load).
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    void loadSuggestions();
  }, [count, loadSuggestions]);

  return (
    <button className="cart-btn" onClick={() => setCartOpen(true)}>
      <Icon name="cart" size={17} />
      {count > 0 && (
        <span className="cart-count" key={count}>
          {count}
        </span>
      )}
    </button>
  );
}
