/**
 * Purpose: Module logic for main.tsx.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'

const router = createBrowserRouter(
  [
    {
      path: '/*',
      element: <App />,
    },
  ],
  ({
    future: {
      v7_startTransition: true,
    },
  } as unknown) as Parameters<typeof createBrowserRouter>[1],
)

const routerProviderFuture = { v7_startTransition: true } as unknown as React.ComponentProps<typeof RouterProvider>['future']

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} future={routerProviderFuture} />
  </StrictMode>,
)
