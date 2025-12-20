import React, { createContext, useContext, useState } from 'react'

type LayoutContextType = {
  open: boolean
  mobileOpen: boolean
  drawerWidth: number
  onToggle: () => void
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined)

export function LayoutProvider({ children, initialOpen = false, initialDrawerWidth = 280 }: { children: React.ReactNode; initialOpen?: boolean; initialDrawerWidth?: number }) {
  const [open, setOpen] = useState(initialOpen)
  const onToggle = () => setOpen((s) => !s)

  const value: LayoutContextType = {
    open,
    mobileOpen: false,
    drawerWidth: initialDrawerWidth,
    onToggle,
  }

  return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
}

export function useLayout() {
  const ctx = useContext(LayoutContext)
  if (!ctx) throw new Error('useLayout must be used within LayoutProvider')
  return ctx
}

export default LayoutContext
