export interface MenuItem {
  id: string
  label: string
  value?: string
  chevron?: boolean
  centered?: boolean
  disabled?: boolean
  action?: () => void
}
