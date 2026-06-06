'use client';

import { useState } from 'react';

type CopyLinkButtonProps = {
  url: string;
  children: React.ReactNode;
};

export function CopyLinkButton({ url, children }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <button type="button" onClick={copy} className="button">
      {copied ? 'Copiado' : children}
    </button>
  );
}
