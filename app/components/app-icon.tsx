import { useState } from "react";

const defaultAppIcon = "/icons/showcase/apps.svg";

export function AppIcon({
  src,
  large = false,
}: {
  src?: string;
  large?: boolean;
}) {
  const [failedSource, setFailedSource] = useState<string>();
  const icon = !src || src === failedSource ? defaultAppIcon : src;
  return (
    <span
      className={`extension-icon ${large ? "large" : ""}`}
      data-color="default"
    >
      <img
        key={icon}
        src={icon}
        onError={() => {
          if (icon !== defaultAppIcon) setFailedSource(src);
        }}
        referrerPolicy="no-referrer"
        width={large ? 48 : 40}
        height={large ? 48 : 40}
        alt=""
      />
    </span>
  );
}
