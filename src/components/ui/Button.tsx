import * as React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black disabled:pointer-events-none disabled:opacity-50',
          {
            'bg-black text-white hover:bg-gray-800': variant === 'default',
            'border border-gray-200 bg-white hover:bg-gray-100 text-black': variant === 'outline',
            'hover:bg-gray-100 text-black': variant === 'ghost',
            'text-blue-500 underline-offset-4 hover:underline': variant === 'link',
            'h-10 px-4 py-2': size === 'default',
            'h-9 rounded-full px-3': size === 'sm',
            'h-12 rounded-full px-8 text-base': size === 'lg',
            'h-10 w-10': size === 'icon',
          },
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button };
