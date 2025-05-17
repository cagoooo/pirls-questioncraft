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
        src="/images/logo.png" // Updated to use the local image
        alt="Shih Men Elementary School Logo" // Updated alt text
        width={150} // Adjusted width for better display, original image is 800x786
        height={147} // Adjusted height maintaining aspect ratio
        className="object-contain h-full w-full"
        priority
        data-ai-hint="logo school"
      />
    </div>
  );
}
