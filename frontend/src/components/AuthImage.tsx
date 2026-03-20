import { useEffect, useState } from 'react';
import { imageUrl } from '../lib/api';

export default function AuthImage({ src, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!src) return;
    let revoked = false;
    const url = imageUrl(src) || src;
    const token = localStorage.getItem('langy_token');
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.ok ? r.blob() : null)
      .then(blob => {
        if (blob && !revoked) setObjectUrl(URL.createObjectURL(blob));
      })
      .catch(() => {});
    return () => {
      revoked = true;
      setObjectUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
    };
  }, [src]);

  if (!objectUrl) return null;
  return <img {...props} src={objectUrl} />;
}
