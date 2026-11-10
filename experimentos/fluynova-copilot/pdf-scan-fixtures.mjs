// Genera PDF de laboratorio cuyo contenido visible es SÓLO una imagen raster.
// No agrega capa de texto: demuestra el flujo de páginas escaneadas en PDF.js.
import {deflateSync} from 'node:zlib';
import {createCanvas} from '@napi-rs/canvas';

function pdfFromObjects(objects){
 const parts=[Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n','latin1')],offsets=[0];
 let len=parts[0].length;
 for(let i=0;i<objects.length;i++){
  offsets.push(len);
  const begin=Buffer.from((i+1)+' 0 obj\n');
  const end=Buffer.from('\nendobj\n');
  parts.push(begin,objects[i],end);
  len+=begin.length+objects[i].length+end.length;
 }
 const xrefAt=len;
 let xref='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n';
 for(const off of offsets.slice(1))xref+=String(off).padStart(10,'0')+' 00000 n \n';
 xref+='trailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+xrefAt+'\n%%EOF\n';
 return Buffer.concat([...parts,Buffer.from(xref)]);
}
export function buildScannedPdf({lines=[
 'FACTURA FICTICIA',
 'NETO: $150.000,00',
 'IVA: $31.500,00',
 'TOTAL: $181.500,00'
]}={}){
 const width=1300,height=650;
 const canvas=createCanvas(width,height),ctx=canvas.getContext('2d');
 ctx.fillStyle='white';ctx.fillRect(0,0,width,height);
 ctx.fillStyle='#111';ctx.font='bold 73px Arial';
 for(let i=0;i<lines.length;i++)ctx.fillText(lines[i],50,130+i*135);
 const rgba=ctx.getImageData(0,0,width,height).data;
 const rgb=Buffer.alloc(width*height*3);
 for(let p=0,q=0;p<rgba.length;p+=4){
  rgb[q++]=rgba[p];rgb[q++]=rgba[p+1];rgb[q++]=rgba[p+2];
 }
 const compressed=deflateSync(rgb,{level:9});
 const content=Buffer.from('q\n595 0 0 298 0 0 cm\n/Im1 Do\nQ\n');
 const obj=[
  Buffer.from('<< /Type /Catalog /Pages 2 0 R >>'),
  Buffer.from('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
  Buffer.from('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 298] /Resources << /XObject << /Im1 5 0 R >> >> /Contents 4 0 R >>'),
  Buffer.concat([
   Buffer.from('<< /Length '+content.length+' >>\nstream\n'),content,Buffer.from('endstream')
  ]),
  Buffer.concat([
   Buffer.from('<< /Type /XObject /Subtype /Image /Width '+width+
    ' /Height '+height+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length '+
    compressed.length+' >>\nstream\n'),
   compressed,Buffer.from('\nendstream')
  ])
 ];
 return pdfFromObjects(obj);
}
