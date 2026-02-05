import React from 'react'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
  animation?: 'pulse' | 'wave' | 'none'
}

export function Skeleton({
  className = '',
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse',
}: SkeletonProps) {
  const baseClasses = 'bg-white/[0.03] border border-white/5'

  const variantClasses = {
    text: 'rounded-md h-4',
    circular: 'rounded-full',
    rectangular: 'rounded-xl',
  }

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer bg-gradient-to-r from-white/[0.03] via-white/[0.08] to-white/[0.03] bg-[length:200%_100%]',
    none: '',
  }

  const style: React.CSSProperties = {
    width: width || '100%',
    height: height || (variant === 'text' ? '1rem' : '100%'),
  }

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={style}
    />
  )
}

// Specialized skeleton components for common use cases
export function AssetCardSkeleton({
  viewMode = 'grid-lg',
}: {
  viewMode?: 'grid-lg' | 'grid-sm' | 'list'
}) {
  if (viewMode === 'list') {
    return (
      <div className="p-3 gap-4 flex items-center bg-white/[0.02] border border-white/5 rounded-xl">
        <Skeleton variant="rectangular" width={40} height={40} className="shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="30%" height={12} />
        </div>
      </div>
    )
  }

  return (
    <div className="aspect-square bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
      <div className="w-full h-full relative">
        <Skeleton variant="rectangular" className="w-full h-full" animation="wave" />
        <div className="absolute inset-x-0 bottom-0 p-3 space-y-1">
          <Skeleton variant="text" width="80%" />
          <Skeleton variant="text" width="40%" height={10} />
        </div>
      </div>
    </div>
  )
}

export function FolderCardSkeleton({
  viewMode = 'grid-lg',
}: {
  viewMode?: 'grid-lg' | 'grid-sm' | 'list'
}) {
  if (viewMode === 'list') {
    return (
      <div className="p-3 gap-4 flex items-center bg-white/[0.02] border border-white/5 rounded-xl">
        <Skeleton variant="rectangular" width={40} height={40} className="shrink-0" />
        <Skeleton variant="text" width="50%" />
      </div>
    )
  }

  return (
    <div className="aspect-square bg-white/[0.02] border border-white/5 rounded-xl flex flex-col items-center justify-center gap-3 p-4">
      <Skeleton variant="rectangular" width={48} height={48} />
      <Skeleton variant="text" width="70%" />
    </div>
  )
}
