import type { AnchorHTMLAttributes } from "react";

export default function MobileLink({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} href={href?.startsWith("/") ? `#${href}` : href} />;
}
