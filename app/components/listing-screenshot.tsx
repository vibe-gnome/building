import { useState } from "react";

export function ListingScreenshot({
  src,
  name,
}: {
  src?: string;
  name: string;
}) {
  const [failedSource, setFailedSource] = useState<string>();
  if (!src || src === failedSource) return null;
  return (
    <a
      className="listing-screenshot"
      href={src}
      target="_blank"
      rel="noreferrer"
      aria-label={`Open ${name} screenshot`}
    >
      <img
        key={src}
        src={src}
        width={1280}
        height={640}
        alt={`${name} preview`}
        referrerPolicy="no-referrer"
        onError={() => setFailedSource(src)}
      />
    </a>
  );
}
