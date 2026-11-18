import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { newToken, tokenValid, recordName, seal, unseal, sealMetadata, openMetadata, validateMetadata, sha256, downloadFile, limitedBytes, appleAssetURL, PART_BYTES, RECORD_TYPE } from '../static/internal/download/crypto.mjs';
import { auditDownloadSchema, preparePlan, publishPlan } from '../scripts/internal/public-downloads.mjs';
const metaFor=async bytes=>({version:1,kind:'file',title:'Synthetic preview',publishedAt:'2026-11-18T00:00:00Z',filename:'synthetic.zip',mime:'application/zip',platform:'Synthetic QA',instructions:'Extract the package.',validation:'Synthetic test only.',bytes:bytes.length,parts:Math.ceil(bytes.length/PART_BYTES),sha256:await sha256(bytes)});
async function fixture(bytes){
  const token=newToken(),meta=await metaFor(bytes),records=new Map(),assets=new Map();
  for(let i=0;i<meta.parts;i++){const name=await recordName(token,i),cipher=await seal(bytes.subarray(i*PART_BYTES,(i+1)*PART_BYTES),token,name),url=`https://test.icloud-content.com/${i}`;assets.set(url,cipher);records.set(name,{recordName:name,recordType:RECORD_TYPE,fields:{asset:{value:{size:cipher.length,downloadURL:url}}}});}
  return {token,meta,records,assets,lookup:async name=>records.get(name),fetch:async(url,options)=>{assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');return new Response(assets.get(url));}};
}
test('links have independent 256-bit random keys and record identifiers reveal no key',async()=>{
  const tokens=new Set(Array.from({length:100},()=>newToken()));assert.equal(tokens.size,100);
  for(const token of tokens){assert.ok(tokenValid(token));const name=await recordName(token);assert.match(name,/^public-download-[0-9a-f]{64}$/);assert.ok(!name.includes(token));assert.notEqual(name,await recordName(token,0));}
});
test('metadata and file contents require the matching key and authenticated context',async()=>{
  const token=newToken(),bytes=new TextEncoder().encode('synthetic confidential filename and bytes'),name=await recordName(token),cipher=await seal(bytes,token,name);
  assert.deepEqual(await unseal(cipher,token,name),bytes);assert.ok(!new TextDecoder().decode(cipher).includes('confidential'));
  await assert.rejects(unseal(cipher,newToken(),name));await assert.rejects(unseal(cipher,token,`${name}-wrong`));
  const corrupt=cipher.slice();corrupt[15]^=1;await assert.rejects(unseal(corrupt,token,name));
  const meta=await metaFor(bytes),envelope=await sealMetadata(meta,token);assert.ok(!envelope.includes(meta.filename));assert.ok(!envelope.includes(token));assert.deepEqual(await openMetadata(envelope,token),meta);await assert.rejects(openMetadata(envelope,newToken()));
});
test('multi-asset encrypted downloads preserve exact bytes and verify the final digest',async()=>{
  const bytes=new Uint8Array(PART_BYTES+137);for(let i=0;i<bytes.length;i++)bytes[i]=i%251;
  const f=await fixture(bytes),progress=[];assert.deepEqual(await downloadFile(f.meta,f.token,f.lookup,f.fetch,n=>progress.push(n)),bytes);assert.equal(progress.at(-1),1);assert.equal(progress.length,2);
});
test('altered assets and metadata digest mismatches fail before producing a file',async()=>{
  const f=await fixture(new Uint8Array([1,2,3]));f.assets.values().next().value[20]^=1;await assert.rejects(downloadFile(f.meta,f.token,f.lookup,f.fetch));
  const g=await fixture(new Uint8Array([1,2,3]));await assert.rejects(downloadFile({...g.meta,sha256:'0'.repeat(64)},g.token,g.lookup,g.fetch),/checksum mismatch/);
});
test('wrong record identities, missing assets, truncation and oversized downloads are rejected',async()=>{
  for(const change of [r=>{r.recordName+='other';},r=>{r.recordType='InternalDocumentChunk';},r=>{r.fields={};},r=>{r.fields.asset.value.size+=1;}]){
    const f=await fixture(new Uint8Array([4,5]));change(f.records.values().next().value);await assert.rejects(downloadFile(f.meta,f.token,f.lookup,f.fetch));
  }
  await assert.rejects(limitedBytes(new Response(new Uint8Array(9)),8),/exceeded/);
  const f=await fixture(new Uint8Array([4,5]));await assert.rejects(downloadFile(f.meta,f.token,f.lookup,async()=>new Response(new Uint8Array(1))),/Incomplete/);
});
test('unsafe asset destinations, executable document types and unreasonable file metadata fail closed',async()=>{
  for(const url of ['http://test.icloud-content.com/a','https://evil.example/a','https://icloud-content.com.evil.example/a','https://name:secret@test.icloud-content.com/a','javascript:alert(1)'])assert.throws(()=>appleAssetURL(url));
  const meta=await metaFor(new Uint8Array([1]));for(const change of [{filename:'../secret.zip'},{mime:'text/html'},{bytes:0},{bytes:999999999},{parts:2},{filename:'a\nb.zip'}])assert.throws(()=>validateMetadata({...meta,...change}));
});
test('aborted downloads do not fetch or return decrypted bytes',async()=>{
  const f=await fixture(new Uint8Array([1])),c=new AbortController();c.abort();let fetched=false;
  await assert.rejects(downloadFile(f.meta,f.token,f.lookup,async()=>{fetched=true;},()=>{},c.signal));assert.equal(fetched,false);
});
test('collection links are distinct from individual links and only appear inside encrypted metadata',async()=>{
  const key=newToken(),files=[{title:'A',platform:'One',token:newToken()},{title:'B',platform:'Two',token:newToken()}],meta={version:1,kind:'collection',title:'Synthetic collection',publishedAt:'2026-11-18',files};
  const envelope=await sealMetadata(meta,key);for(const f of files){assert.ok(!envelope.includes(f.token));await assert.rejects(openMetadata(envelope,f.token));}assert.deepEqual(await openMetadata(envelope,key),meta);
  assert.throws(()=>validateMetadata({...meta,files:[files[0],files[0]]}));
});
test('private-by-default publication requires explicit per-file and inventory opt-in',async()=>{
  const dir=await mkdtemp(path.join(tmpdir(),'orbitus-share-test-'));
  try{await assert.rejects(preparePlan({files:[]},path.join(dir,'plan.json')));await assert.rejects(preparePlan({visibility:'public-link',title:'Test',files:[{path:'/not-read',public:false}]},path.join(dir,'plan.json')),/explicitly/);}finally{await rm(dir,{recursive:true});}
  await assert.rejects(publishPlan({version:1,visibility:'private',files:[]},null,'',null,null),/private/);
});
test('only encrypted-download records allow anonymous reads; private grants and no listing indexes remain enforced',async()=>{
  const schema=await readFile(new URL('../scripts/internal/schema.ckdb',import.meta.url),'utf8');const audit=auditDownloadSchema(schema);assert.equal(Object.keys(audit).length,5);
  assert.throws(()=>auditDownloadSchema(schema.replace('GRANT READ TO "_world",\n        GRANT CREATE, READ, WRITE TO InternalAdmin','GRANT READ, WRITE TO "_world",\n        GRANT CREATE, READ, WRITE TO InternalAdmin')));
  assert.throws(()=>auditDownloadSchema(schema.replace('asset ASSET','asset ASSET QUERYABLE')));
  assert.throws(()=>auditDownloadSchema(schema.replace('GRANT READ TO InternalEmployee','GRANT READ TO "_world"')));
});
test('generic public page contains no embedded links, account sign-in, storage cache or private artifacts',async()=>{
  const dir=new URL('../static/internal/download/',import.meta.url);for(const file of await readdir(dir)){
    assert.ok(['index.html','download.css','download.mjs','crypto.mjs'].includes(file));const source=await readFile(new URL(file,dir),'utf8');
    assert.doesNotMatch(source,/\/Users\/|BEGIN PRIVATE KEY|localStorage|sessionStorage|indexedDB|ckWebAuthToken|setUpAuth|innerHTML\s*=/);
    assert.doesNotMatch(source,/https:\/\/www\.orbitusrobotics\.com\/internal\/download\/#[A-Za-z0-9_-]{43}/);
  }
  const html=await readFile(new URL('index.html',dir),'utf8');assert.match(html,/noindex,nofollow,noarchive/);assert.match(html,/no-referrer/);
  const js=await readFile(new URL('download.mjs',dir),'utf8');assert.match(js,/location.hash/);assert.match(js,/credentials:'omit'/);assert.match(js,/revokeObjectURL/);
});
