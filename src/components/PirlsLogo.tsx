import Image from 'next/image';
import type { HTMLAttributes } from 'react';

interface PirlsLogoProps extends HTMLAttributes<HTMLDivElement> {
  // className will be passed via ...props
  // Optional: add other specific props if needed
}

export function PirlsLogo({ className, ...props }: PirlsLogoProps) {
  return (
    <div className={className} {...props}>
      <Image
        src="/images/logo.png" // Assumes the image is saved at public/images/logo.png
        alt="Shih Men Elementary School Logo" // Updated alt text to reflect the new image
        width={800} // Intrinsic width of the provided image
        height={786} // Intrinsic height of the provided image
        className="object-contain h-full w-full" // Ensure image fits and maintains aspect ratio
        priority // Optional: if logo is LCP, consider adding priority
      />
    </div>
  );
}
