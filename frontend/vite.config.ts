import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// UrbanCity keeps billboard prices in the database so the admin dashboard can
// change them without hard-coding a second price list in the 3D client.
// The existing App.tsx is transformed at build/dev time to consume that USD
// value while preserving the rest of the game code unchanged.
const urbanCityUsdPricing: Plugin = {
  name: 'urbancity-usd-pricing',
  enforce: 'pre',
  transform(code, id) {
    if (!id.endsWith('/src/App.tsx')) return null

    let out = code

    out = out.replace(
      "const formatInr=(value:number)=>'₹'+Number(value||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});",
      "const formatInr=(value:number)=>'$'+Number(value||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});"
    )

    out = out.replace(
      "const bookingPrice=(b:Billboard,m:number)=>{const cat=pricingCategory(b);const per30=cat==='MAIN'?49:cat==='WALL'?29:19;if(m<1440)return (m/30)*per30;const firstDay=cat==='MAIN'?999:cat==='WALL'?599:399;const extraDay=cat==='MAIN'?799:cat==='WALL'?499:299;const fullDays=Math.floor(m/1440),remainder=m%1440;return fullDays*extraDay+(fullDays>0?firstDay-extraDay:0)+(remainder/30)*per30;};",
      "const bookingPrice=(b:Billboard,m:number)=>{const configured=Number(b.bid);const per30=Number.isFinite(configured)&&configured>0?configured:(pricingCategory(b)==='MAIN'?0.21:1.05);if(m<1440)return (m/30)*per30;const firstDay=per30*40;const after24Per30=per30*(0.19/0.21);const extraDay=after24Per30*48;const fullDays=Math.floor(m/1440),remainder=m%1440;return firstDay+Math.max(0,fullDays-1)*extraDay+(remainder/30)*after24Per30;};"
    )

    out = out.replace(
      "{pricingCategory(selected)==='MAIN'?'Main boards (wide + vertical): • ₹49 / 30 min':pricingCategory(selected)==='WALL'?'Wall boards: •‚¹29 / 30 min':'Corner boards: •‚¹19 / 30 min'}",
      "{'Base price: '+formatInr(Number(selected.bid||0))+' / 30 min'}"
    )

    return out === code ? null : { code: out, map: null }
  },
}

export default defineConfig({
  plugins: [urbanCityUsdPricing, react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
