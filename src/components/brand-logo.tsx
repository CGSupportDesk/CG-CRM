import Image from "next/image";
import { cn } from "@/lib/utils";

const logoAssets = {
  dark: {
    src: "/brand/growth-engine-logo-dark.png",
    width: 784,
    height: 334,
  },
  light: {
    src: "/brand/growth-engine-logo-light.png",
    width: 581,
    height: 253,
  },
};

export function BrandLogo({
  variant = "dark",
  className,
}: {
  variant?: "dark" | "light";
  className?: string;
}) {
  const logo = logoAssets[variant];

  return (
    <Image
      src={logo.src}
      alt="Growth Engine"
      width={logo.width}
      height={logo.height}
      priority
      className={cn("block h-auto w-auto object-contain", className)}
    />
  );
}
