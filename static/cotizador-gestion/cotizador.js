/* FLUYNOVA · presupuesto comercial orientativo. No envía datos, no habilita cobros. */
(function(root,create){
  "use strict";
  const api=create();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.FluynovaSoftwareQuote=api;
})(typeof globalThis==="object"?globalThis:null,function(){
  "use strict";
  const plans=Object.freeze({
    web:Object.freeze({label:"Presencia Web",setup:290000,monthly:null,description:"Sitio web esencial con consultas. Mantenimiento opcional, a cotizar."}),
    crm:Object.freeze({label:"Presupuestos + Clientes",setup:290000,monthly:39000,description:"CRM y presupuestos. Prototipo: no disponible para contratación todavía."}),
    gestion:Object.freeze({label:"Gestión + Automatizaciones",setup:390000,monthly:59000,description:"CRM y un flujo automatizado acordado. En desarrollo, sin venta habilitada."})
  });
  function estimate(input){
    if(!input||!Object.prototype.hasOwnProperty.call(plans,input.plan))throw new TypeError("Plan inválido");
    const plan=plans[input.plan];
    const team=["1-5","6-20","21+"].includes(input.team)?input.team:"1-5";
    const infra=["fluynova","propia"].includes(input.infra)?input.infra:"fluynova";
    const extra=Boolean(input.extraIntegration);
    const custom=team!=="1-5"||extra||(infra==="propia"&&input.plan!=="web");
    const monthly=plan.monthly===null?null:(infra==="fluynova"&&!custom?plan.monthly:null);
    const annual=monthly===null?null:plan.setup+monthly*12;
    return Object.freeze({
      planId:input.plan,label:plan.label,
      setup:plan.setup,monthly,firstYear:annual,
      requiresCustomQuote:custom,
      isPublishedOffer:input.plan==="web",
      caveat:custom?"La cantidad de usuarios, integraciones o alojamiento propio requieren presupuesto personalizado.":plan.description
    });
  }
  function ars(n){return Number.isSafeInteger(n)&&n>=0?n.toLocaleString("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}):"A cotizar";}
  return Object.freeze({plans,estimate,ars});
});
