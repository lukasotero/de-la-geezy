import { useId } from 'react'
import { cn } from '@/lib/utils'

type LogoMarkProps = {
  size?: number
  tone?: 'lime' | 'ink' | 'light'
  className?: string
  decorative?: boolean
}

const toneColor = {
  lime: '#C5F277',
  ink: '#111418',
  light: '#F5F7F2',
}

function LogoMark({ size = 36, tone = 'lime', className, decorative = false }: LogoMarkProps) {
  const maskId = `geezy-wallet-${useId().replace(/:/g, '')}`

  return (
    <svg
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : 'De La Geezy'}
      className={cn('shrink-0', className)}
      height={size}
      role={decorative ? undefined : 'img'}
      viewBox="0 0 48 48"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <mask id={maskId} maskUnits="userSpaceOnUse" x="3" y="5" width="42" height="38">
        <rect x="4" y="6" width="40" height="36" rx="11" fill="white" />
        <path d="M29 19h15v15H29a7.5 7.5 0 0 1 0-15Z" fill="black" />
      </mask>
      <rect x="4" y="6" width="40" height="36" rx="11" fill={toneColor[tone]} mask={`url(#${maskId})`} />
      <circle cx="31" cy="26.5" r="2.25" fill={toneColor[tone]} />
    </svg>
  )
}

type BrandProps = {
  variant?: 'compact' | 'full'
  size?: 'sm' | 'md' | 'lg'
  tone?: LogoMarkProps['tone']
  className?: string
}

const brandSizes = {
  sm: { mark: 32, title: 'text-sm', tagline: 'text-[10px]' },
  md: { mark: 36, title: 'text-[15px]', tagline: 'text-[11px]' },
  lg: { mark: 48, title: 'text-xl', tagline: 'text-xs' },
}

export function Brand({ variant = 'full', size = 'md', tone = 'lime', className }: BrandProps) {
  const styles = brandSizes[size]

  return (
    <div className={cn('flex items-center gap-[10px]', className)}>
      <LogoMark size={styles.mark} tone={tone} decorative={variant === 'full'} />
      {variant === 'full' && (
        <div className="min-w-0 leading-tight">
          <strong className={cn('block whitespace-nowrap font-bold tracking-[-0.025em] text-text', styles.title)}>De La Geezy</strong>
          <span className={cn('mt-1 block whitespace-nowrap text-muted', styles.tagline)}>Tu plata, sin chamuyo.</span>
        </div>
      )}
    </div>
  )
}
