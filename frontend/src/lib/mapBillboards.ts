import type { Billboard } from '../types/billboard';

/** Static billboard inventory used by the city map. */
export const MAP_BILLBOARDS: Billboard[] = [
  { id:'102', type:'Premium Road', position:[0,4,-22], traffic:'High', bid:5000, occupied:false, ad:'ZEST • meal delivery' },
  { id:'207', type:'Premium Road', position:[0,4,22], rotationY:Math.PI, traffic:'High', bid:8200, occupied:true, ad:'URBAN FINANCE' },
  { id:'102-L', type:'Vertical', kind:'vertical-ad', position:[-6.4,4,-22], traffic:'High', bid:4200, occupied:false, ad:'VERTICAL AD', size:[2.8,4.6] },
  { id:'102-R', type:'Vertical', kind:'vertical-ad', position:[6.4,4,-22], traffic:'High', bid:4200, occupied:false, ad:'VERTICAL AD', size:[2.8,4.6] },
  { id:'207-L', type:'Vertical', kind:'vertical-ad', position:[-6.4,4,22], rotationY:Math.PI, traffic:'High', bid:4200, occupied:false, ad:'VERTICAL AD', size:[2.8,4.6] },
  { id:'207-R', type:'Vertical', kind:'vertical-ad', position:[6.4,4,22], rotationY:Math.PI, traffic:'High', bid:4200, occupied:false, ad:'VERTICAL AD', size:[2.8,4.6] },
  { id:'501', type:'Street', position:[-53,4,-53], traffic:'Medium', bid:2400, occupied:false, ad:'CORNER NORTHWEST', rotationY:Math.PI/4 },
  { id:'502', type:'Street', position:[53,4,-53], traffic:'Medium', bid:2400, occupied:false, ad:'CORNER NORTHEAST', rotationY:-Math.PI/4 },
  { id:'503', type:'Street', position:[-53,4,53], traffic:'Medium', bid:2400, occupied:false, ad:'CORNER SOUTHWEST', rotationY:Math.PI*3/4 },
  { id:'504', type:'Street', position:[53,4,53], traffic:'Medium', bid:2400, occupied:false, ad:'CORNER SOUTHEAST', rotationY:-Math.PI*3/4 },
  { id:'W01', type:'Building Wall', kind:'wall-ad', position:[-22.05,8.2,-10.82], rotationY:0, traffic:'High', bid:3200, occupied:false, ad:'ADVERTISE HERE', size:[3.4,3.4] },
  { id:'W03', type:'Building Wall', kind:'wall-ad', position:[-17.95,8.2,-10.82], rotationY:0, traffic:'High', bid:3600, occupied:false, ad:'YOUR BRAND', size:[3.4,3.4] },
  { id:'W02', type:'Building Wall', kind:'wall-ad', position:[17.7,8.4,-11.32], rotationY:0, traffic:'High', bid:4500, occupied:false, ad:'CITY REACH', size:[4.2,3.5] },
  { id:'W04', type:'Building Wall', kind:'wall-ad', position:[22.3,8.4,-11.32], rotationY:0, traffic:'Medium', bid:2800, occupied:false, ad:'AVAILABLE', size:[4.2,3.5] },
  { id:'W05', type:'Building Wall', kind:'wall-ad', position:[-33,10.8,16.12], rotationY:0, traffic:'Medium', bid:2600, occupied:false, ad:'LOCAL SPOT', size:[7.4,4.1] },
  { id:'W06', type:'Building Wall', kind:'wall-ad', position:[-20,8.8,17.12], rotationY:0, traffic:'High', bid:3400, occupied:false, ad:'YOUR NEXT AD', size:[6.2,3.8] },
  { id:'W07', type:'Building Wall', kind:'wall-ad', position:[20,8.8,16.12], rotationY:0, traffic:'High', bid:3300, occupied:false, ad:'YOUR BRAND', size:[6.4,3.8] },
  { id:'W08', type:'Building Wall', kind:'wall-ad', position:[34,10.8,17.62], rotationY:0, traffic:'High', bid:3700, occupied:false, ad:'CITY REACH', size:[7.6,4.2] },
  { id:'W09', type:'Building Wall', kind:'wall-ad', position:[20,9.0,-35.38], rotationY:0, traffic:'Medium', bid:3000, occupied:false, ad:'ADVERTISE HERE', size:[6.4,3.8] },
  { id:'W10', type:'Building Wall', kind:'wall-ad', position:[-20,8.8,-34.38], rotationY:0, traffic:'Medium', bid:2900, occupied:false, ad:'YOUR BRAND', size:[5.8,3.6] },
  { id:'W11', type:'Building Wall', kind:'wall-ad', position:[-31,10.5,-36.38], rotationY:0, traffic:'High', bid:3500, occupied:false, ad:'CITY REACH', size:[7.2,4.0] },
];
