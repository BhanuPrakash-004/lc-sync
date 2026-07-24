import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { Analytics } from '@vercel/analytics/react'
import App from './App'
import { AuthProvider } from './lib/AuthContext'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 2,   // 2min — data stays "fresh", no re-fetch
      gcTime:    1000 * 60 * 10,  // 10min — keep in memory before GC
      refetchOnWindowFocus: false, // Don't re-fetch on tab switch
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <App />
          <Analytics />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#1A1A1A',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px',
              fontSize: '14px',
            },
            success: {
              iconTheme: { primary: '#00B8A3', secondary: '#1A1A1A' },
            },
            error: {
              iconTheme: { primary: '#EF4743', secondary: '#1A1A1A' },
            },
          }}
        />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
)
