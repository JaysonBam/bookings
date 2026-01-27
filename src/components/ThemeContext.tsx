import { createContext, useContext } from 'react'

export type ThemeContextType = {
  mode: 'light' | 'dark'
  toggleColorMode: () => void
}

export const ThemeContext = createContext<ThemeContextType>({
  mode: 'light',
  toggleColorMode: () => {},
})

export const useThemeContext = () => useContext(ThemeContext)
