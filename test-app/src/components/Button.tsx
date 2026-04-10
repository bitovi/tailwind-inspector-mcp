interface ButtonProps {
  variant: 'primary' | 'secondary' | 'warning'
  children: React.ReactNode
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export function Button({ variant, children, leftIcon, rightIcon }: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors'
  const styles = variant === 'primary'
    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
    : variant === 'warning'
    ? 'bg-amber-500 text-white hover:bg-amber-600'
    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'

  return (
    <button className={`${base} ${styles}`}>
      {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
      <span className="inline-flex">{children}</span>
      {rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
    </button>
  )
}
