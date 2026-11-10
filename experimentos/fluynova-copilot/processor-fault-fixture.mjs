// Sólo en pruebas: PDF provoca salida abrupta; OCR queda colgado.
// No se importa desde el servidor productivo.
if(process.argv[2]==='pdf'){
  process.exit(139);
}
if(process.argv[2]==='ocr'){
  setInterval(()=>{},1000);
}
