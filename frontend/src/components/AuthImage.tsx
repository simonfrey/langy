import { useEffect, useState } from "react";

const cache = new Map<string, string>();

export default function AuthImage({
  src,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [objectUrl, setObjectUrl] = useState<string | null>(() => {
    if (!src) return null;
    return cache.get(src) ?? null;
  });

  useEffect(() => {
    if (!src) return;
    if (cache.has(src)) return;
    let cancelled = false;
    const url = src;
    const token = localStorage.getItem("langy_token");
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (blob && !cancelled) {
          const blobUrl = URL.createObjectURL(blob);
          cache.set(src, blobUrl);
          setObjectUrl(blobUrl);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [src]);

  if (!objectUrl) return null;
  return <img {...props} src={objectUrl} />;
}
