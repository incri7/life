import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { NeonAuthUIProvider } from '@neondatabase/neon-js/auth/react'
import { ChakraProvider } from '@chakra-ui/react'
import App from './App'
import { authClient } from './lib/auth'
import './index.css'
import '@neondatabase/neon-js/ui/css'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <NeonAuthUIProvider emailOTP authClient={authClient}>
            <BrowserRouter>
                <ChakraProvider>
                    <App />
                </ChakraProvider>
            </BrowserRouter>
        </NeonAuthUIProvider>
    </React.StrictMode>,
)
