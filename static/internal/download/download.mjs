import { tokenValid, recordName, RECORD_TYPE, openMetadata, downloadFile, limitedBytes } from './crypto.mjs';
const $ = id => document.getElementById(id), element = (tag, text, className) => { const e = document.createElement(tag); if (text) e.textContent = text; if (className) e.className = className; return e; };
let generation = 0, controller, objectURL;
const clear = () => { generation++; controller?.abort(); if (objectURL) URL.revokeObjectURL(objectURL); objectURL = null; $('files').replaceChildren(); };
window.addEventListener('pagehide', clear); window.addEventListener('hashchange', load);
async function load() {
  clear(); const current = generation; controller = new AbortController(); const signal = controller.signal;
  $('title').textContent = 'Open your download link.'; $('intro').textContent = 'Use the complete link provided to you. This page does not list shared files.'; $('status').textContent = 'No iCloud account is required.';
  const token = location.hash.slice(1); if (!token) return;
  if (!tokenValid(token)) { $('status').textContent = 'This download link is incomplete or invalid.'; return; }
  try {
    $('status').textContent = 'Opening your private link…';
    const configResponse = await fetch('../config.json', { cache: 'no-store', credentials: 'omit', signal });
    if (!configResponse.ok) throw new Error('Download service unavailable.'); const config = await configResponse.json();
    if (!config.enabled || config.container !== 'iCloud.orbitusrobotics.Internal' || config.environment !== 'production' || typeof config.apiToken !== 'string') throw new Error('Download service unavailable.');
    const lookup = async name => {
      signal.throwIfAborted();
      const url = `https://api.apple-cloudkit.com/database/1/${config.container}/production/public/records/lookup?${new URLSearchParams({ckAPIToken:config.apiToken})}`;
      const response = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({records:[{recordName:name}],desiredKeys:['payloadJSON','asset']}), credentials:'omit', referrerPolicy:'no-referrer', cache:'no-store', signal });
      const data = JSON.parse(new TextDecoder().decode(await limitedBytes(response, 262144, signal)));
      const record = data.records?.[0]; if (data.serverErrorCode || data.records?.length !== 1 || record.serverErrorCode || record.recordName !== name || record.recordType !== RECORD_TYPE) throw new Error('This download is unavailable or has been revoked.'); return record;
    };
    const record = await lookup(await recordName(token)), meta = await openMetadata(record.fields?.payloadJSON?.value, token);
    if (current !== generation) return;
    $('title').textContent = meta.title; $('status').textContent = 'Link verified. No sign-in required.';
    if (meta.kind === 'collection') {
      $('intro').textContent = 'Choose a package to inspect and download. Each version has its own link; share only the individual links you want to give access to.';
      for (const file of meta.files) {
        const card = element('article', '', 'card'); card.append(element('span', file.platform, 'platform'), element('h2', file.title));
        const actions = element('div', '', 'actions'), a = element('a', 'Open download', 'primary'); a.href = `#${file.token}`;
        const copy = element('button','Copy individual link'); copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(`${location.origin}${location.pathname}#${file.token}`);copy.textContent='Link copied';}catch{copy.textContent='Open download, then copy its address';}});
        actions.append(a,copy); card.append(actions); $('files').append(card);
      }
      return;
    }
    $('intro').textContent = 'Download the preview package below. Your browser decrypts the file and verifies its checksum before saving it.';
    const card = element('article','','card'), size = `${(meta.bytes / 1048576).toFixed(1)} MB`;
    card.append(element('span',meta.platform,'platform'),element('h2',meta.filename),element('p',`${size} · Published ${meta.publishedAt.slice(0,10)}`,'meta'),element('p',meta.instructions),element('p',meta.validation,'meta'));
    const actions = element('div','','actions'), download = element('button','Download package','primary'), cancel = element('button','Cancel'); cancel.hidden=true;
    const progress = element('progress');progress.max=1;progress.value=0;progress.hidden=true;
    const result = element('p','','result'); result.setAttribute('role','status');
    let attempt;
    download.addEventListener('click',async()=>{
      download.disabled=true;cancel.hidden=false;progress.hidden=false;progress.value=0;result.textContent='Downloading encrypted file…';attempt=new AbortController();
      const stop=()=>attempt.abort();signal.addEventListener('abort',stop,{once:true});
      try {
        const bytes = await downloadFile(meta, token, lookup, fetch, value=>{progress.value=value;result.textContent=`Downloading and verifying… ${Math.round(value*100)}%`;},attempt.signal);
        if(current!==generation)return;
        if(objectURL)URL.revokeObjectURL(objectURL);objectURL=URL.createObjectURL(new Blob([bytes],{type:meta.mime}));
        const save=element('a','Save verified package','primary');save.href=objectURL;save.download=meta.filename;actions.append(save);save.click();
        result.textContent='Checksum verified. Your download is ready.';
      } catch(error) { if(current===generation)result.textContent=attempt.signal.aborted?'Download cancelled.':error.message; }
      finally { signal.removeEventListener('abort',stop);if(current===generation){download.disabled=false;cancel.hidden=true;} }
    });cancel.addEventListener('click',()=>attempt?.abort());actions.append(download,cancel);card.append(actions,progress,result);
    const details=element('details');details.append(element('summary','SHA-256 checksum'),element('code',meta.sha256));card.append(details);$('files').append(card);
  } catch(error) { if(current===generation && !signal.aborted){$('status').textContent=error.message;$('intro').textContent='Check that you have the complete link, or ask the sender for a new one.';} }
}
load();
