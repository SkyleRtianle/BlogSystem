"use client";

import { useEffect, useState } from "react";

export default function LoadableImage({
  src,
  className,
  style,
  alt,
}: {
  src: string;
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
}) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    const img = new Image();
    img.onload = () => setLoaded(true);
    img.onerror = () => setLoaded(true);
    img.src = src;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return (
    <div
      role="img"
      aria-label={alt}
      className={className}
      style={{
        ...style,
        backgroundImage: `url("${src}")`,
        opacity: loaded ? 1 : 0,
        transition: "opacity 0.45s ease-out",
      }}
    />
  );
}
