import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  glow = false,
  ...props
}) => {
  return (
    <div
      className={twMerge(
        clsx(
          'bg-white/95 rounded-2xl p-5 transition-all duration-150 border border-slate-200/80 shadow-[0_2px_12px_rgba(99,102,241,0.04)]',
          glow && 'hover:border-blue-300 hover:shadow-[0_4px_20px_rgba(26,104,240,0.12)]',
          className
        )
      )}
      {...props}
    >
      {children}
    </div>
  );
};
