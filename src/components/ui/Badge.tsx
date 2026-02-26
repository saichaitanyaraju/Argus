<<<<<<< HEAD
interface Props {
  children: React.ReactNode
=======
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
>>>>>>> 89c15af (Fix: cost module, xlsx upload, security + deploy fixes)
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  size?: 'sm' | 'md'
}

const variants = {
  default: 'bg-white/10 text-white/70 border border-white/10',
  success: 'bg-green-500/10 text-green-400 border border-green-500/20',
  warning: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20',
  danger: 'bg-red-500/10 text-red-400 border border-red-500/20',
  info: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
}

export default function Badge({ children, variant = 'default', size = 'sm' }: Props) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-mono font-medium ${size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm'} ${variants[variant]}`}>
      {children}
    </span>
  )
}
