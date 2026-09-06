import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import type { ListingCategory } from "../lib/listings";
import { recordView } from "../lib/views";

interface ViewCountProps {
  category: ListingCategory;
  slug: string;
}

function VisitCount({ category, slug }: ViewCountProps) {
  const request = useRef<Promise<number> | null>(null);
  const [count, setCount] = useState<number | "unavailable" | null>(null);
  useEffect(() => {
    let active = true;
    // Reuse the request during Strict Mode's effect replay. Never retry a POST
    // automatically: a lost response may already have incremented the total.
    request.current ??= recordView(category, slug);
    void request.current.then(
      (views) => {
        if (active) setCount(views);
      },
      () => {
        if (active) setCount("unavailable");
      },
    );
    return () => {
      active = false;
    };
  }, [category, slug]);

  return (
    <div>
      <dt>Views</dt>
      <dd aria-live="polite">
        {count === null
          ? "Loading…"
          : count === "unavailable"
            ? "Unavailable"
            : count.toLocaleString("en")}
      </dd>
    </div>
  );
}

export function ViewCount(props: ViewCountProps) {
  const location = useLocation();
  return (
    <VisitCount
      key={`${location.key}:${props.category}:${props.slug}`}
      {...props}
    />
  );
}
