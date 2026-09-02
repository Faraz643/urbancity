import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import Admin from './Admin'
import PublicPage from './PublicPage'
import './index.css'
import StartupGate from './StartupGate'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StartupGate><App /></StartupGate>}/>
        <Route path="/admin" element={<Admin />}/>
        <Route path="/about" element={<PublicPage page="about"/>}/>
        <Route path="/how-it-works" element={<PublicPage page="how-it-works"/>}/>
        <Route path="/faq" element={<PublicPage page="faq"/>}/>
        <Route path="/rules" element={<PublicPage page="rules"/>}/>
        <Route path="/pricing" element={<PublicPage page="pricing"/>}/>
        <Route path="/terms" element={<PublicPage page="terms"/>}/>
        <Route path="/privacy" element={<PublicPage page="privacy"/>}/>
        <Route path="/refund-policy" element={<PublicPage page="refund-policy"/>}/>
        <Route path="/contact" element={<PublicPage page="contact"/>}/>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
)
