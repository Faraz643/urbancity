const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'frontend', 'src', 'App.tsx');
let source = fs.readFileSync(file, 'utf8');

if (!source.includes("./pricing")) {
  source = source.replace(
    "import { io, Socket } from 'socket.io-client';",
    "import { io, Socket } from 'socket.io-client';\nimport { bookingPrice as calculateBookingPrice, pricingCategory as getPricingCategory, URBANCITY_PRICING } from './pricing';"
  );
}

const oldPricing = / const pricingCategory=\(b:Billboard\)=>.*?\n const remaining=/s;
if (!oldPricing.test(source)) throw new Error('Could not find the existing frontend pricing block in App.tsx');
source = source.replace(oldPricing, ` const pricingCategory=(b:Billboard)=>getPricingCategory(b.type);\n const bookingPrice=(b:Billboard,m:number)=>calculateBookingPrice(b.type,m);\n const remaining=`);

const oldBook = / const book=async\(\)=>\{.*?\};\n\n const uploadImageOnly=/s;
const newBook = ` const book=async()=>{if(!selected)return;if(!user){setAuthOpen(true);setAuthError('Login or register to book advertising space.');return;}setBookingError('');const link=adUrl.trim();if(link){try{const u=new URL(link);if(!['http:','https:'].includes(u.protocol))throw new Error()}catch{setBookingError('Please enter a valid website URL including https:// (for example: https://yourcompany.com).');return;}}if(adFile&&adFile.size>5*1024*1024){setBookingError('Your image is too large. Please choose a PNG, JPG or WEBP image smaller than 5 MB.');return;}setBookingBusy(true);try{const advertisementId=await uploadCreative();const r=await fetch(api+'/api/payments/checkout',{method:'POST',headers:{'Content-Type':'application/json',...authHeaders()},body:JSON.stringify({billboardId:selected.id,durationMinutes:bookingMinutes,companyName:bookingCompanyName||user.displayName||user.username,description:adTitle.trim()||undefined,advertisementId:advertisementId||undefined})});const data=await readApi(r);if(!r.ok)throw new Error(data.error||'Could not start secure checkout');if(data.paymentProvider==='DODO'&&data.checkoutUrl){window.location.href=data.checkoutUrl;return;}if(data.paymentProvider==='CASHFREE'&&data.paymentSessionId){const Cashfree=(window as any).Cashfree;if(typeof Cashfree!=='function')throw new Error('Cashfree checkout is still loading. Please wait a moment and try again.');const cashfree=Cashfree({mode:data.environment==='production'?'production':'sandbox'});cashfree.checkout({paymentSessionId:data.paymentSessionId,redirectTarget:'_self'});return;}throw new Error('No supported payment checkout was returned.');}catch(e:any){setBookingError(e.message||'Booking failed')}finally{setBookingBusy(false)}};\n\n const uploadImageOnly=`;
if (!oldBook.test(source)) throw new Error('Could not find the existing booking function in App.tsx');
source = source.replace(oldBook, newBook);

const oldLabel = /<small>\{pricingCategory\(selected\)==='MAIN'\?.*?<\/small>/;
const newLabel = `<small>{pricingCategory(selected)==='MAIN'?\`Main boards (wide + vertical): • $\${URBANCITY_PRICING.MAIN.per30.toFixed(2)} / 30 min\`:pricingCategory(selected)==='WALL'?\`Wall boards: • $\${URBANCITY_PRICING.WALL.per30.toFixed(2)} / 30 min\`:\`Corner boards: • $\${URBANCITY_PRICING.CORNER.per30.toFixed(2)} / 30 min\`}</small>`;
if (!oldLabel.test(source)) throw new Error('Could not find the old frontend price label');
source = source.replace(oldLabel, newLabel);

// Dodo redirects back with payment_id/status; Cashfree uses order_id.
const oldReturnParam = "const orderId=params.get('order_id');";
const newReturnParam = "const orderId=params.get('order_id')||params.get('payment_id');";
if (!source.includes(oldReturnParam)) throw new Error('Could not find the payment return parameter in App.tsx');
source = source.replace(oldReturnParam, newReturnParam);

fs.writeFileSync(file, source, 'utf8');
console.log('Applied final USD pricing plus Dodo/Cashfree checkout and return handling to frontend/src/App.tsx');
