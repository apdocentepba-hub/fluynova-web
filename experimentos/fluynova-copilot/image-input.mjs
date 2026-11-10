// Validación superficial de formatos raster permitidos antes de activar OCR.
// No sustituye al decodificador ni hace segura una imagen arbitraria.
import {CopilotError} from './analysis.mjs';

export const IMAGE_MAX_BYTES=3*1024*1024;
export const IMAGE_MAX_PIXELS=6_000_000;
export const OCR_MAX_TEXT_CHARS=6000;
const PNG_SIG=Buffer.from([137,80,78,71,13,10,26,10]);

function jpegSize(b){
 let offset=2;
 while(offset+4<=b.length){
  if(b[offset]!==0xff)throw new CopilotError('IMAGE_INVALID_HEADER',415);
  while(offset<b.length&&b[offset]===0xff)offset++;
  if(offset>=b.length)break;
  const marker=b[offset++];
  if(marker===0xd8||marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
  if(marker===0xd9||marker===0xda)break;
  if(offset+2>b.length)break;
  const length=b.readUInt16BE(offset);
  if(length<2||offset+length>b.length)break;
  if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){
   if(length<7)break;
   return {width:b.readUInt16BE(offset+5),height:b.readUInt16BE(offset+3)};
  }
  offset+=length;
 }
 throw new CopilotError('IMAGE_INVALID_HEADER',415);
}
export function inspectImageBytes(input){
 const b=Buffer.isBuffer(input)?input:
   input instanceof Uint8Array?Buffer.from(input):null;
 if(!b||b.length<32||b.length>IMAGE_MAX_BYTES)
   throw new CopilotError('IMAGE_INVALID_SIZE',422);
 let format,width,height;
 if(b.subarray(0,8).equals(PNG_SIG)){
  if(b.length<33||b.readUInt32BE(8)!==13||b.toString('ascii',12,16)!=='IHDR')
   throw new CopilotError('IMAGE_INVALID_HEADER',415);
  format='PNG';width=b.readUInt32BE(16);height=b.readUInt32BE(20);
 }else if(b[0]===0xff&&b[1]===0xd8&&b[2]===0xff){
  format='JPEG';({width,height}=jpegSize(b));
 }else{
  throw new CopilotError('IMAGE_UNSUPPORTED_FORMAT',415);
 }
 if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||
    width<80||height<40||width>6000||height>6000||
    width*height>IMAGE_MAX_PIXELS)
  throw new CopilotError('IMAGE_DIMENSIONS_REJECTED',422);
 return {bytes:b,format,width,height};
}
