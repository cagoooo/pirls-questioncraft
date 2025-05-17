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
        src="https://placehold.co/800x786.png" // Temporarily using a placeholder
        alt="Shih Men Elementary School Logo"
        width={800}
        height={786}
        className="object-contain h-full w-full"
        priority
        data-ai-hint="logo school" // Added AI hint for placeholder
      />
    </div>
  );
}
