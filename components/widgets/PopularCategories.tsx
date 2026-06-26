"use client";
import { useEffect, useRef, useState } from "react";
import { useTrova } from "@/store";
import { useTranslate } from "@/hooks/useTranslate";

interface CategoryTile {
  name: string;
  image?: string;
}

/** A soft pastel circle colour derived from the category name (stable per name,
 *  no hardcoded palette). */
function pastel(name: string): string {
  let hash = 0;
  for (let index = 0; index < name.length; index++)
    hash = (hash * 31 + name.charCodeAt(index)) % 360;
  return `hsl(${hash} 68% 91%)`;
}

/**
 * Popular Categories: real Kapruka categories (kapruka_list_categories), each
 * fronted by a real product photo from that category. Tapping one starts a
 * discovery search. No hardcoded data — names + images come live from MCP. On
 * mobile the grid scrolls horizontally with page dots tracking the swipe.
 */
export function PopularCategories() {
  const userSend = useTrova((store) => store.userSend);
  const translate = useTranslate();
  const [tiles, setTiles] = useState<CategoryTile[]>([]);
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const gridRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState(1);
  const [activePage, setActivePage] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // Load once; retry a couple of times if it comes back empty (transient MCP
    // hiccup) so the categories never permanently disappear.
    const load = async (attempt: number) => {
      try {
        const data = await fetch("/api/popular-categories", {
          cache: "no-store",
        }).then((response) => response.json());
        const list: CategoryTile[] = Array.isArray(data.categories)
          ? data.categories.filter((tile: CategoryTile) => tile.name)
          : [];
        if (cancelled) return;
        if (list.length) setTiles(list);
        else if (attempt < 3) setTimeout(() => load(attempt + 1), 1500);
      } catch {
        if (!cancelled && attempt < 3) setTimeout(() => load(attempt + 1), 1500);
      }
    };
    void load(0);
    return () => {
      cancelled = true;
    };
  }, []);

  // Derive the number of swipe pages from the real scroll geometry; recompute on
  // resize. On desktop the grid never overflows, so pageCount stays 1 (dots hide).
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const measure = () => {
      const pages = Math.max(
        1,
        Math.round(grid.scrollWidth / grid.clientWidth),
      );
      setPageCount(pages);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [tiles]);

  if (!tiles.length) return null;

  const onScroll = () => {
    const grid = gridRef.current;
    if (!grid) return;
    setActivePage(Math.round(grid.scrollLeft / grid.clientWidth));
  };

  const goToPage = (page: number) => {
    const grid = gridRef.current;
    if (!grid) return;
    grid.scrollTo({ left: page * grid.clientWidth, behavior: "smooth" });
  };

  return (
    <section className="popcat">
      <div className="popcat-head">
        <span className="popcat-bar" />
        <h3>{translate("Popular categories")}</h3>
      </div>
      <div className="popcat-grid" ref={gridRef} onScroll={onScroll}>
        {tiles.map((tile) => (
          <button
            key={tile.name}
            className="popcat-cat"
            onClick={() => userSend(`Show me ${tile.name}`)}
            title={tile.name}
          >
            <span
              className="popcat-circle"
              style={{ background: pastel(tile.name) }}
            >
              {tile.image && !broken.has(tile.name) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tile.image}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={() =>
                    setBroken((current) => new Set(current).add(tile.name))
                  }
                />
              ) : (
                <span className="popcat-initial">
                  {tile.name.charAt(0).toUpperCase()}
                </span>
              )}
            </span>
            <span className="popcat-label">{tile.name}</span>
          </button>
        ))}
      </div>
      {pageCount > 1 && (
        <div className="popcat-dots" role="tablist" aria-label={translate("Category pages")}>
          {Array.from({ length: pageCount }, (_, page) => (
            <button
              key={page}
              className={"popcat-dot" + (page === activePage ? " active" : "")}
              aria-label={translate("Go to page {n}", { n: page + 1 })}
              aria-selected={page === activePage}
              role="tab"
              onClick={() => goToPage(page)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
