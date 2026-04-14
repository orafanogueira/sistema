/**
 * Gera o snippet JS que o cliente COLA no <head> do site dele.
 * O snippet:
 * - Captura fbclid/gclid/UTMs da URL
 * - Armazena em localStorage + cookie
 * - Registra pageview no nosso backend
 * - Quando usuario clica em link de WhatsApp, preserva params
 *
 * Uso: <script src="https://gruponogueiramkt.com/api/track/script/CLIENTE_TOKEN" async></script>
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://gruponogueiramkt.com";

  const script = `
(function(){
  var TOKEN = ${JSON.stringify(token)};
  var ENDPOINT = ${JSON.stringify(appUrl + "/api/track/view")};
  var SID_KEY = "gn_sid";

  function uuid(){return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(c){var r=Math.random()*16|0,v=c=="x"?r:(r&0x3|0x8);return v.toString(16);});}
  function getCookie(n){var m=document.cookie.match(new RegExp("(^|;\\\\s*)"+n+"=([^;]+)"));return m?decodeURIComponent(m[2]):null;}
  function setCookie(n,v,d){var e=new Date();e.setTime(e.getTime()+d*86400000);document.cookie=n+"="+encodeURIComponent(v)+";expires="+e.toUTCString()+";path=/;SameSite=Lax";}
  function getOrCreateSession(){var s=getCookie(SID_KEY)||localStorage.getItem(SID_KEY);if(!s){s=uuid();setCookie(SID_KEY,s,30);localStorage.setItem(SID_KEY,s);}return s;}

  function parseQS(){
    var q={},p=window.location.search.replace(/^\\?/,"").split("&");
    for(var i=0;i<p.length;i++){var kv=p[i].split("=");if(kv[0])q[decodeURIComponent(kv[0])]=decodeURIComponent(kv[1]||"");}
    return q;
  }

  var q=parseQS();
  var STORE_KEY="gn_tracking";
  var stored={};
  try{stored=JSON.parse(localStorage.getItem(STORE_KEY)||"{}");}catch(e){}

  // Captura e persiste
  ["fbclid","gclid","ttclid","utm_source","utm_medium","utm_campaign","utm_term","utm_content"].forEach(function(k){
    if(q[k]) stored[k]=q[k];
  });
  localStorage.setItem(STORE_KEY, JSON.stringify(stored));

  var sid = getOrCreateSession();

  // Registra pageview
  try {
    fetch(ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},keepalive:true,body:JSON.stringify({
      cliente_token: TOKEN,
      session_id: sid,
      url: window.location.href,
      path: window.location.pathname,
      title: document.title,
      fbclid: stored.fbclid,
      gclid: stored.gclid,
      ttclid: stored.ttclid,
      utm: {
        source: stored.utm_source,
        medium: stored.utm_medium,
        campaign: stored.utm_campaign,
        term: stored.utm_term,
        content: stored.utm_content
      },
      referrer: document.referrer
    })});
  } catch(e) {}

  // Preserva trackings em links de WhatsApp
  function preserveWaLinks() {
    var links = document.querySelectorAll("a[href*='wa.me'], a[href*='api.whatsapp.com'], a[href*='whatsapp://']");
    links.forEach(function(a){
      try {
        var u = new URL(a.href);
        ["fbclid","gclid","ttclid"].forEach(function(k){ if(stored[k]) u.searchParams.set(k, stored[k]); });
        ["utm_source","utm_medium","utm_campaign","utm_term","utm_content"].forEach(function(k){ if(stored[k]) u.searchParams.set(k, stored[k]); });
        u.searchParams.set("gn_sid", sid);
        a.href = u.toString();
      } catch(e) {}
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", preserveWaLinks);
  } else {
    preserveWaLinks();
  }
  var obs = new MutationObserver(preserveWaLinks);
  obs.observe(document.body || document.documentElement, { childList: true, subtree: true });
})();
`;

  return new Response(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
