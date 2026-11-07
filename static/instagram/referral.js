/* FLUYNOVA: preserve explicit campaign tags across service CTAs.
   Supports Instagram and our own portfolio /laboratorio/ only.
   No storage, cookies, analytics beacon, network calls or browser redirects.
   Only updates same-origin links to /#contacto and /diagnostico/.
*/
(function(root){
  "use strict";

  const PARAMS=["utm_source","utm_medium","utm_campaign","utm_content"];
  const SAFE=/^[A-Za-z0-9_.-]{1,90}$/;
  const SOURCE_CAMPAIGNS=Object.freeze({
    instagram:null,
    laboratorio:"demostraciones_202611"
  });

  function rewriteReferralLink(href,search,origin){
    if(typeof href!=="string"||typeof search!=="string"||typeof origin!=="string")return href;
    const inbound=new URLSearchParams(search);
    const source=inbound.get("utm_source");
    if(!Object.prototype.hasOwnProperty.call(SOURCE_CAMPAIGNS,source))return href;
    const values=new URLSearchParams();
    for(const key of PARAMS){
      const value=inbound.get(key);
      if(value&&SAFE.test(value))values.set(key,value);
    }
    if(values.get("utm_source")!==source || !values.has("utm_campaign"))return href;
    const requiredCampaign=SOURCE_CAMPAIGNS[source];
    if(requiredCampaign&&values.get("utm_campaign")!==requiredCampaign)return href;

    let original;
    try{original=new URL(href,origin);}catch{return href;}
    if(original.origin!==origin)return href;
    const contact=original.pathname==="/"&&original.hash==="#contacto";
    const diagnostic=original.pathname==="/diagnostico/";
    if(!contact&&!diagnostic)return href;
    return original.pathname+"?"+values.toString()+(original.hash||"");
  }

  if(typeof module!=="undefined"&&module.exports)module.exports={rewriteReferralLink};
  if(root&&root.document&&root.location){
    for(const anchor of root.document.querySelectorAll("a[href]")){
      const previous=anchor.getAttribute("href");
      const next=rewriteReferralLink(previous,root.location.search,root.location.origin);
      if(next!==previous)anchor.setAttribute("href",next);
    }
  }
})(typeof window!=="undefined"?window:undefined);
