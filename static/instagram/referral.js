/* FLUYNOVA: preserve explicit Instagram campaign tags across service CTAs.
   No storage, cookies, analytics beacon, network calls or browser redirects.
   Only updates same-origin links to /#contacto and /diagnostico/.
*/
(function(root){
  "use strict";

  const PARAMS=["utm_source","utm_medium","utm_campaign","utm_content"];
  const SAFE=/^[A-Za-z0-9_.-]{1,90}$/;

  function rewriteReferralLink(href, search, origin){
    if(typeof href!=="string"||typeof search!=="string"||typeof origin!=="string"){
      return href;
    }
    const inbound=new URLSearchParams(search);
    if(inbound.get("utm_source")!=="instagram")return href;
    const values=new URLSearchParams();
    for(const key of PARAMS){
      const value=inbound.get(key);
      if(value && SAFE.test(value))values.set(key,value);
    }
    if(values.get("utm_source")!=="instagram" || !values.has("utm_campaign")){
      return href;
    }

    let original;
    try{original=new URL(href,origin);}
    catch(_){return href;}
    if(original.origin!==origin)return href;

    const contact = original.pathname==="/" && original.hash==="#contacto";
    const diagnostic = original.pathname==="/diagnostico/";
    if(!contact&&!diagnostic)return href;

    // Preserve campaign provenance; never auto-submit any contact form.
    const query=values.toString();
    return original.pathname+"?"+query+(original.hash||"");
  }

  if(typeof module!=="undefined"&&module.exports){
    module.exports={rewriteReferralLink};
  }
  if(root&&root.document&&root.location){
    for(const anchor of root.document.querySelectorAll("a[href]")){
      const previous=anchor.getAttribute("href");
      const next=rewriteReferralLink(previous,root.location.search,root.location.origin);
      if(next!==previous)anchor.setAttribute("href",next);
    }
  }
})(typeof window!=="undefined"?window:undefined);
