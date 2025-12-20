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
  } as unknown) as any,
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} future={({ v7_startTransition: true } as unknown) as any} />
  </StrictMode>,
)
