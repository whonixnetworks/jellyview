import { ReactNode } from 'react'
import { AlertCircle, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ErrorAlertProps {
  title?: string
  message: string
  onRetry?: () => void
  onDismiss?: () => void
  className?: string
  actions?: ReactNode
}

export function ErrorAlert({
  title = 'Error',
  message,
  onRetry,
  onDismiss,
  className,
  actions,
}: ErrorAlertProps) {
  return (
    <div className={cn(
      'flex items-start gap-3 p-4 rounded-lg border bg-red-50 dark:bg-red-950/20 text-red-900 dark:text-red-100',
      className
    )}>
      <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold text-sm">{title}</p>}
        <p className="text-sm opacity-90 mt-1">{message}</p>
        {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
      </div>
      <div className="flex gap-1 shrink-0">
        {onRetry && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onRetry}
            className="h-7 w-7"
            title="Retry"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
        {onDismiss && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onDismiss}
            className="h-7 w-7"
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

interface SuccessAlertProps {
  title?: string
  message: string
  onDismiss?: () => void
  className?: string
}

export function SuccessAlert({
  title = 'Success',
  message,
  onDismiss,
  className,
}: SuccessAlertProps) {
  return (
    <div className={cn(
      'flex items-start gap-3 p-4 rounded-lg border bg-green-50 dark:bg-green-950/20 text-green-900 dark:text-green-100',
      className
    )}>
      <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold text-sm">{title}</p>}
        <p className="text-sm opacity-90 mt-1">{message}</p>
      </div>
      {onDismiss && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onDismiss}
          className="h-7 w-7 shrink-0"
          title="Dismiss"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

interface WarningAlertProps {
  title?: string
  message: string
  onDismiss?: () => void
  className?: string
}

export function WarningAlert({
  title = 'Warning',
  message,
  onDismiss,
  className,
}: WarningAlertProps) {
  return (
    <div className={cn(
      'flex items-start gap-3 p-4 rounded-lg border bg-yellow-50 dark:bg-yellow-950/20 text-yellow-900 dark:text-yellow-100',
      className
    )}>
      <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold text-sm">{title}</p>}
        <p className="text-sm opacity-90 mt-1">{message}</p>
      </div>
      {onDismiss && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onDismiss}
          className="h-7 w-7 shrink-0"
          title="Dismiss"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

interface LoadingStateProps {
  message?: string
  className?: string
}

export function LoadingState({ message = 'Loading...', className }: LoadingStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-4 p-12', className)}>
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

interface EmptyStateProps {
  icon?: ReactNode
  title?: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title = 'No data found',
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-4 p-12 text-center', className)}>
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <div>
        <p className="font-medium">{title}</p>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {action}
    </div>
  )
}

import { CheckCircle2, AlertTriangle } from 'lucide-react'
