import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import Admin from './Admin'
import './index.css'
import StartupGate from './StartupGate'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StartupGate><BrowserRouter>
      <Routes><Route path="/" element={<App />}/><Route path="/admin" element={<Admin />}/></Routes>
    </BrowserRouter></StartupGate>
  </React.StrictMode>,
)
