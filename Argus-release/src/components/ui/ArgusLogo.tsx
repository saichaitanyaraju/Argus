import { Eye } from 'lucide-react'

interface Props {
  size?: 'sm' | 'md' | 'lg'
}

export default function ArgusLogo({ size = 'md' }: Props) {
  const sizes = {
    sm: { icon: 16, text: 'text-base' },
    md: { icon: 22, text: 'text-xl' },
    lg: { icon: 32, text: 'text-3xl' },
  }
  const s = sizes[size]

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div className="absolute inset-0 bg-accent rounded-full blur-sm opacity-50" />
        <Eye size={s.icon} className="relative text-accent" strokeWidth={1.5} />
      </div>
      <span
        className={`${s.text} font-display font-bold tracking-tight text-white`}
      >
        Argus
      </span>
    </div>
  )
}
