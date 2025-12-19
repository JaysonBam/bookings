import React, { createContext, useContext } from 'react'

type LayoutContextType = {
  isMobile: boolean
  open: boolean
  mobileOpen: boolean
  drawerWidth: number
  onToggle: () => void
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined)

export function LayoutProvider({ value, children }: { value: LayoutContextType; children: React.ReactNode }) {
  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
}

export function useLayout() {
  const ctx = useContext(LayoutContext)
  if (!ctx) throw new Error('useLayout must be used within LayoutProvider')
  return ctx
}

export default LayoutContext
