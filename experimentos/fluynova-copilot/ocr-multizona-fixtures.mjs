// Fixtures sintéticos compartidos para comparación reproducible.
import {createCanvas} from '@napi-rs/canvas';
export const MULTIZONE_TRUTH={
 net_cents:15000000,tax_cents:3150000,total_cents:18150000
};
export function makeMultizoneFixture(position){
 if(!['left','center','right'].includes(position))
  throw new TypeError('MULTIZONE_UNKNOWN_POSITION');
 const W=1440,H=850;
 const canvas=createCanvas(W,H),ctx=canvas.getContext('2d');
 ctx.fillStyle='#fbfaf6';ctx.fillRect(0,0,W,H);
 ctx.fillStyle='#1a1a1a';ctx.font='bold 56px Arial';
 ctx.fillText('COMPROBANTE FICTICIO',45,90);
 const x={left:45,center:460,right:885}[position];
 ctx.font='bold 47px Arial';
 ['NETO: $150.000,00','IVA: $31.500,00','TOTAL: $181.500,00']
  .forEach((line,i)=>ctx.fillText(line,x,240+i*130));
 const distractors={left:[460,900],center:[45,1030],right:[45,460]}[position];
 ctx.font='34px Arial';
 for(const dx of distractors){
  ['CLIENTE FICTICIO','REFERENCIA DEMO','OBSERVACIONES'].forEach((s,i)=>
   ctx.fillText(s,dx,230+i*105));
 }
 return canvas.toBuffer('image/png');
}
