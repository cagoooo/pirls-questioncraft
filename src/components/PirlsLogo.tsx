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
        src={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/images/logo.png`}
        alt="Shih Men Elementary School Logo"
        width={150}
        height={147}
        className="object-contain h-full w-full"
        priority
        data-ai-hint="logo school"
      />
    </div>
  );
}
