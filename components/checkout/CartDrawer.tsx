"use client";
import { Icon } from "@/components/ui/Icon";
import { ProductImage } from "@/components/product/ProductImage";
import { useHala } from "@/store";
import { fmtPrice } from "@/lib/format/money";
import Link from "next/link";
import { useStrings, useTranslate } from "@/hooks/useTranslate";

export function CartDrawer() {
  const cart = useHala((store) => store.cart);
  const setQty = useHala((store) => store.setQty);
  const removeItem = useHala((store) => store.removeItem);
  const cartOpen = useHala((store) => store.cartOpen);
  const setCartOpen = useHala((store) => store.setCartOpen);
  const startDelivery = useHala((store) => store.startDelivery);

  const text = useStrings();
  const translate = useTranslate();

  if (!cartOpen) return null;
  const currency = cart[0]?.currency || "QAR";
  const sub = cart.reduce((a, item) => a + item.price * item.quantity, 0);

  const onCheckout = () => {
    setCartOpen(false);
    // startDelivery reuses a single live checkout card (no duplicate threads).
    startDelivery();
  };

  return (
    <>
      <div className="scrim" onClick={() => setCartOpen(false)} />
      <aside className="drawer">
        <div className="drawer-h">
          <Icon name="cart" size={20} />
          <h3>{text.cart}</h3>
          <button className="x" onClick={() => setCartOpen(false)}>
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="drawer-body">
          {cart.length === 0 && (
            <div className="cart-empty">
              <Icon name="gift" size={54} />
              <div>{text.empty_cart}</div>
              <div className="cart-empty-sub">
                {translate("Tap a product below to add it here")}
              </div>
            </div>
          )}
          {cart.map((item, index) => (
            <div className="cart-line" key={item.id + "-" + index}>
              <ProductImage product={item} />
              <div className="cl-body">
                {item.url ? (
                  <Link
                    className="cl-name cl-name-link"
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {item.name}
                  </Link>
                ) : (
                  <div className="cl-name">{item.name}</div>
                )}
                <div className="cl-row">
                  <div className="cl-price">
                    {fmtPrice(item.price * item.quantity, item.currency)}
                  </div>
                  <span className="qty">
                    <button onClick={() => setQty(item.id, -1)}>
                      <Icon name="minus" size={13} />
                    </button>
                    <span>{item.quantity}</span>
                    <button onClick={() => setQty(item.id, 1)}>
                      <Icon name="plus" size={13} />
                    </button>
                  </span>
                </div>
              </div>
              <button
                className="cl-remove"
                onClick={() => removeItem(item.id)}
                aria-label={translate("Remove item")}
                title={translate("Remove")}
              >
                <Icon name="trash" size={16} />
              </button>
            </div>
          ))}
        </div>
        {cart.length > 0 && (
          <div className="drawer-foot">
            <div className="totrow grand">
              <span>{text.total}</span>
              <span>{fmtPrice(sub, currency)}</span>
            </div>
            <button
              className="btn-primary"
              style={{ justifyContent: "center", width: "100%" }}
              onClick={onCheckout}
            >
              <Icon name="external" size={16} /> {text.checkout} ·{" "}
              {fmtPrice(sub, currency)}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
