import { useState } from 'react'
import { X, Eye, EyeOff } from 'lucide-react'

export function Button({ variant = 'primary', className = '', children, ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[.98] disabled:opacity-50 disabled:active:scale-100'
  const sizes = 'px-4 py-3 text-sm'
  const variants = {
    primary: 'bg-cafe-accent text-black hover:bg-cafe-accent-dark',
    ghost: 'bg-cafe-card text-white border border-cafe-line hover:border-cafe-accent/60',
    danger: 'bg-red-500/90 text-white hover:bg-red-500',
    success: 'bg-emerald-600 text-white hover:bg-emerald-500',
    subtle: 'bg-cafe-line/60 text-white hover:bg-cafe-line',
  }
  return (
    <button className={`${base} ${sizes} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}

export function Card({ className = '', children }) {
  return (
    <div className={`rounded-2xl bg-cafe-card border border-cafe-line ${className}`}>
      {children}
    </div>
  )
}

export function Input({ label, className = '', ...props }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm text-cafe-muted">{label}</span>}
      <input
        className={`w-full rounded-xl bg-cafe-bg border border-cafe-line px-4 py-3 text-base outline-none focus:border-cafe-accent ${className}`}
        {...props}
      />
    </label>
  )
}

export function PasswordInput({ label, className = '', ...props }) {
  const [show, setShow] = useState(false)
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm text-cafe-muted">{label}</span>}
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          className={`w-full rounded-xl bg-cafe-bg border border-cafe-line px-4 py-3 pr-11 text-base outline-none focus:border-cafe-accent ${className}`}
          {...props}
        />
        <button type="button" onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-cafe-muted hover:text-white"
          aria-label={show ? 'Hide password' : 'Show password'}>
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
    </label>
  )
}

export function Textarea({ label, className = '', ...props }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm text-cafe-muted">{label}</span>}
      <textarea
        className={`w-full rounded-xl bg-cafe-bg border border-cafe-line px-4 py-3 text-base outline-none focus:border-cafe-accent ${className}`}
        {...props}
      />
    </label>
  )
}

export function Select({ label, className = '', children, ...props }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm text-cafe-muted">{label}</span>}
      <select
        className={`w-full rounded-xl bg-cafe-bg border border-cafe-line px-4 py-3 text-base outline-none focus:border-cafe-accent ${className}`}
        {...props}
      >
        {children}
      </select>
    </label>
  )
}

export function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-md max-h-[88vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-cafe-card border border-cafe-line p-5 safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="rounded-full p-1 text-cafe-muted hover:text-white">
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Badge({ className = '', children }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>
      {children}
    </span>
  )
}

export function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center text-cafe-muted">
      {Icon && <Icon size={40} className="mb-3 opacity-50" />}
      <p className="font-semibold text-white">{title}</p>
      {subtitle && <p className="mt-1 text-sm">{subtitle}</p>}
    </div>
  )
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-cafe-line border-t-cafe-accent" />
    </div>
  )
}
