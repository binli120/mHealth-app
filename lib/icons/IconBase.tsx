import React from 'react';

export interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export const IconBase: React.FC<React.PropsWithChildren<IconProps>> = ({
  size = 24,
  color = '#1f6f73',
  strokeWidth = 2,
  className,
  children,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox='0 0 64 64'
      fill='none'
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap='round'
      strokeLinejoin='round'
      className={className}
    >
      {children}
    </svg>
  );
};
