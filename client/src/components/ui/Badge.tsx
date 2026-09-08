import { clsx } from 'clsx';

type BadgeVariant = 'processing' | 'ready' | 'failed' | 'live' | 'draft' | 'neutral';

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variants: Record<BadgeVariant, string> = {
  processing: 'bg-amber-50 text-amber-700 border border-amber-200',
  ready: 'bg-green-50 text-green-700 border border-green-200',
  failed: 'bg-red-50 text-red-700 border border-red-200',
  live: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  draft: 'bg-gray-100 text-gray-600 border border-gray-200',
  neutral: 'bg-gray-100 text-gray-600 border border-gray-200',
};

export function Badge({ variant, children, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
        variants[variant],
        className
      )}
    >
      <span
        className={clsx('h-1.5 w-1.5 rounded-full', {
          'bg-amber-500 animate-pulse': variant === 'processing',
          'bg-green-500': variant === 'ready',
          'bg-red-500': variant === 'failed',
          'bg-indigo-500': variant === 'live',
          'bg-gray-400': variant === 'draft' || variant === 'neutral',
        })}
      />
      {children}
    </span>
  );
}
