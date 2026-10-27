interface IconProps {
  className?: string
}

export function PlayIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5.4 19 12 8 18.6Z" fill="currentColor" />
    </svg>
  )
}

export function PauseIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="5" width="4.4" height="14" rx="0.8" fill="currentColor" />
      <rect x="13.6" y="5" width="4.4" height="14" rx="0.8" fill="currentColor" />
    </svg>
  )
}

export function PlayPauseIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 12" aria-hidden="true">
      <path
        d="M9.58 5.635 0 11.212V.057zM19.578 0h3.796v11.273h-3.796zm-5.793 0h3.797v11.273h-3.797z"
        fill="currentColor"
      />
    </svg>
  )
}

export function PreviousIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 23 12" aria-hidden="true">
      <path
        d="M9.58 5.635 0 11.212V.057zm9.623 0-9.58 5.577V.057zm0-5.635H23v11.273h-3.797z"
        fill="currentColor"
        transform="rotate(180 11.5 6)"
      />
    </svg>
  )
}

export function NextIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 23 12" aria-hidden="true">
      <path
        d="M9.58 5.635 0 11.212V.057zm9.623 0-9.58 5.577V.057zm0-5.635H23v11.273h-3.797z"
        fill="currentColor"
      />
    </svg>
  )
}



export function PlusIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  )
}

export function FolderIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function MusicIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M9 18.2V6.4l9-1.9v11.2M9 9.1l9-1.9M6.3 21a3.3 3.3 0 1 0 0-6.6 3.3 3.3 0 0 0 0 6.6Zm9-2a3.3 3.3 0 1 0 0-6.6 3.3 3.3 0 0 0 0 6.6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function VolumeLowIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9.5h3.2L12 5.4v13.2L7.2 14.5H4Z" fill="currentColor" />
    </svg>
  )
}

export function VolumeIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9.5h3.2L12 5.4v13.2L7.2 14.5H4Z" fill="currentColor" />
      <path
        d="M15.5 8.6a4.8 4.8 0 0 1 0 6.8M18.1 6a8.4 8.4 0 0 1 0 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function UploadIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 15.5v2A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5v-2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
