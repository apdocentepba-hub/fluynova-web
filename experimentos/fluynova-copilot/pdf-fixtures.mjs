// Generador local de PDF 1.4 para pruebas; NO reproduce documentos de terceros.
function escapePdfText(s) {
 return s.replaceAll('\\','\\\\').replaceAll('(','\\(').replaceAll(')','\\)');
}
export function buildSyntheticPdf({pages=[[
 'Factura DEMO-0001',
 'Proveedor: Empresa ficticia',
 'Neto: $150.000,00',
 'IVA: $31.500,00',
 'Total: $181.500,00'
]]}={}){
 const objects=[];
 const pageRefs=pages.map((_,index)=>3+index*2);
 const fontId=3+pages.length*2;
 objects.push('<< /Type /Catalog /Pages 2 0 R >>');
 objects.push('<< /Type /Pages /Count '+pages.length+' /Kids [ '+pageRefs.map(i=>i+' 0 R').join(' ')+' ] >>');
 for(let i=0;i<pages.length;i++){
  const pageId=pageRefs[i],streamId=pageId+1;
  objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 '+fontId+' 0 R >> >> /Contents '+streamId+' 0 R >>');
  const commands=pages[i].flatMap((text,index)=>[
   (index===0?'BT /F1 11 Tf 45 790 Td ':'0 -18 Td ')+'('+escapePdfText(text)+') Tj'
  ]).join('\n')+'\nET\n';
  objects.push('<< /Length '+Buffer.byteLength(commands,'latin1')+' >>\nstream\n'+commands+'endstream');
 }
 objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
 let pdf='%PDF-1.4\n';
 const offsets=[0];
 objects.forEach((obj,i)=>{
  offsets.push(Buffer.byteLength(pdf,'latin1'));
  pdf+=(i+1)+' 0 obj\n'+obj+'\nendobj\n';
 });
 const xref=Buffer.byteLength(pdf,'latin1');
 pdf+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n';
 for(const offset of offsets.slice(1))pdf+=String(offset).padStart(10,'0')+' 00000 n \n';
 pdf+='trailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
 return Buffer.from(pdf,'latin1');
}
