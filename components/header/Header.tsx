"use client";
import { Brand } from "./Brand";
import { BannerToggle } from "./BannerToggle";
import { LangSwitch } from "./LangSwitch";
import { OrdersButton } from "./OrdersButton";
import { CartButton } from "./CartButton";

export function Header() {
  return (
    <header className="hdr">
      <Brand />
      <div className="hdr-spacer" />
      <BannerToggle />
      <LangSwitch />
      <OrdersButton />
      <CartButton />
    </header>
  );
}
