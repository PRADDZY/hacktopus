import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  children,
  className = '',
  ...props
}: ButtonProps) {
  const baseStyles = 'font-black border-3 border-black transition-all duration-200 hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-0 active:translate-y-0 uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantStyles = {
    primary: 'bg-primary text-white shadow-brutal hover:shadow-none',
    secondary: 'bg-secondary text-white shadow-brutal hover:shadow-none',
    outline: 'bg-white text-black shadow-brutal hover:shadow-none',
    ghost: 'bg-transparent text-black border-black hover:bg-black hover:text-white shadow-none',
  };

  const sizeStyles = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
