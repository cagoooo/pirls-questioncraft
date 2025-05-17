import type { SVGProps } from 'react';

export function PirlsLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 50"
      width="200"
      height="50"
      aria-label="PIRLS QuestionCraft Logo"
      {...props}
    >
      <style>
        {`
          .logo-text {
            font-family: var(--font-geist-sans), Arial, sans-serif;
            font-size: 24px;
            font-weight: 600;
            fill: hsl(var(--primary));
          }
          .logo-tagline {
            font-family: var(--font-geist-sans), Arial, sans-serif;
            font-size: 10px;
            fill: hsl(var(--muted-foreground));
          }
        `}
      </style>
      <text x="10" y="30" className="logo-text">PIRLS QuestionCraft</text>
    </svg>
  );
}
