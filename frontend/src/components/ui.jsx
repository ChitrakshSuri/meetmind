// Small shared pieces: the product mark, a spinner and the few icons the UI needs.
// Icons are 16px outline at 1.5px stroke, grey by inheritance, always decorative.

export function Mark({ className = 'h-6 w-6' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="9" width="3.5" height="6" rx="1.75" fill="currentColor" />
      <rect x="8" y="4" width="3.5" height="16" rx="1.75" fill="currentColor" />
      <rect x="14" y="7" width="3.5" height="10" rx="1.75" fill="currentColor" />
      <rect x="20" y="10" width="2.5" height="4" rx="1.25" fill="var(--signal)" />
    </svg>
  )
}

export function Spinner({ className = 'h-4 w-4' }) {
  return (
    <svg className={`animate-spin motion-reduce:animate-none ${className}`} fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
    </svg>
  )
}

function Icon({ children, className = 'h-4 w-4' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const CheckIcon = (p) => (
  <Icon {...p}>
    <path d="M3.5 8.5l3 3 6-7" />
  </Icon>
)
export const CloseIcon = (p) => (
  <Icon {...p}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </Icon>
)
export const ArrowIcon = (p) => (
  <Icon {...p}>
    <path d="M3 8h10M9 4l4 4-4 4" />
  </Icon>
)
export const ExternalIcon = (p) => (
  <Icon {...p}>
    <path d="M9 3h4v4M13 3L7.5 8.5M12 9.5V12a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1h2.5" />
  </Icon>
)
export const AlertIcon = (p) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="6" />
    <path d="M8 5v3.5M8 11h.01" />
  </Icon>
)
