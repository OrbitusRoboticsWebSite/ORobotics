#!/usr/bin/env node
// Opt-in publisher. Paths, link keys, inventories and receipts stay outside Git.
import { readFile, writeFile, chmod, stat, mkdir, open } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { CloudClient, readProfile, callerIdentity, auditSchema, deniedLookup, verifyConsoleSchemaExport } from './cloud.mjs';
import { RECORD_TYPE, PART_BYTES, MAX_FILE_BYTES, newToken, recordName, seal, sealMetadata, openMetadata, validateMetadata, appleAssetURL, limitedBytes, downloadFile } from '../../static/internal/download/crypto.mjs';
export function auditDownloadSchema(schema) {
  const privateGrants = auditSchema(schema);
  const body = schema.match(/RECORD TYPE\s+"?InternalPublicDownload"?\s*\(([\s\S]*?)\);/)?.[1];
  if (!body || !/\basset\s+ASSET/.test(body) || !/\bpayloadJSON\s+STRING/.test(body) || /QUERYABLE|SEARCHABLE/.test(body)) throw new Error('Encrypted download schema is missing or unexpectedly indexed');
  const grants = [...body.matchAll(/GRANT\s+([A-Z,\s]+?)\s+TO\s+"?([\w]+)"?/g)].flatMap(m => m[1].split(',').map(p => `${m[2]}:${p.trim()}`)).sort();
  if (JSON.stringify(grants) !== JSON.stringify(['InternalAdmin:CREATE','InternalAdmin:READ','InternalAdmin:WRITE','_world:READ'].sort())) throw new Error('Unexpected encrypted download permissions');
  return { ...privateGrants, [RECORD_TYPE]: grants };
}
function outsideGit(filename) {
  const parent = path.dirname(path.resolve(filename));
  try { execFileSync('git', ['-C',parent,'rev-parse','--show-toplevel'], {stdio:'ignore'}); }
  catch { return; }
  throw new Error('Inventories, keys and receipts must be stored outside Git');
}
async function savePrivate(filename, value) { outsideGit(filename); await writeFile(filename, JSON.stringify(value,null,2)+'\n', {mode:0o600}); await chmod(filename,0o600); }
export async function preparePlan(inventory, output) {
  if (inventory.visibility !== 'public-link' || !Array.isArray(inventory.files) || inventory.files.length < 1 || inventory.files.length > 20) throw new Error('An explicit public-link inventory is required');
  await mkdir(path.dirname(path.resolve(output)),{recursive:true,mode:0o700}); outsideGit(output);
  const plan = { version:1, visibility:'public-link', title:inventory.title, createdAt:new Date().toISOString(), collectionToken:newToken(), files:[] };
  for (const file of inventory.files) {
    if (file.public !== true || !path.isAbsolute(file.path)) throw new Error('Every file must explicitly opt in to public-link sharing');
    const info = await stat(file.path); if (!info.isFile() || !info.size || info.size > MAX_FILE_BYTES) throw new Error('Unsupported file size');
    const bytes = await readFile(file.path), sha256 = createHash('sha256').update(bytes).digest('hex');
    if (file.sha256 && file.sha256 !== sha256) throw new Error('Input checksum changed');
    const metadata = validateMetadata({version:1,kind:'file',title:file.title,publishedAt:plan.createdAt,filename:path.basename(file.path),mime:file.mime,platform:file.platform,instructions:file.instructions,validation:file.validation,bytes:bytes.length,sha256,parts:Math.ceil(bytes.length/PART_BYTES)});
    plan.files.push({path:file.path,public:true,token:newToken(),metadata});
  }
  validateMetadata(collectionMetadata(plan));
  // Never replace an existing plan: its keys identify immutable editions.
  await writeFile(output,JSON.stringify(plan,null,2)+'\n',{mode:0o600,flag:'wx'}); return plan;
}
function collectionMetadata(plan) { return {version:1,kind:'collection',title:plan.title,publishedAt:plan.createdAt,files:plan.files.map(f=>({title:f.metadata.title,platform:f.metadata.platform,token:f.token}))}; }
async function lookup(client, name, anonymous=false) {
  const result=await client.call('records/lookup',{records:[{recordName:name}]},anonymous?'':null);
  if(result.httpStatus!==200 || result.serverErrorCode || result.records?.length!==1 || result.records[0].recordName!==name) throw new Error('CloudKit record lookup failed');
  const record=result.records[0];if(record.serverErrorCode==='NOT_FOUND')return null;
  if(record.serverErrorCode || record.recordType!==RECORD_TYPE)throw new Error('Download access failed');return record;
}
async function uploadAsset(client,name,encrypted) {
  const response=await client.call('assets/upload',{tokens:[{recordName:name,recordType:RECORD_TYPE,fieldName:'asset'}]});
  if(response.httpStatus!==200 || response.serverErrorCode || response.tokens?.length!==1 || response.tokens[0].recordName!==name)throw new Error('CloudKit asset upload was not authorized');
  const upload=await fetch(appleAssetURL(response.tokens[0].url),{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:encrypted,redirect:'error',signal:AbortSignal.timeout(120000)});
  if(!upload.ok)throw new Error(`Asset upload failed (${upload.status})`);
  const data=await upload.json(),asset=data.singleFile;
  if(!asset?.receipt || !asset.fileChecksum || asset.size!==encrypted.length)throw new Error('Asset receipt mismatch');
  // CloudKit infers the field type from the deployed schema. The upload receipt
  // is the Asset dictionary; "ASSET" is not a Web Services value-type tag.
  await client.create({recordName:name,recordType:RECORD_TYPE,fields:{payloadJSON:{value:'{"version":1,"kind":"encrypted-part"}'},asset:{value:asset}}});
}
async function publishMetadata(client,token,meta) {
  const name=await recordName(token),existing=await lookup(client,name);
  if(existing){if(JSON.stringify(await openMetadata(existing.fields?.payloadJSON?.value,token))!==JSON.stringify(meta))throw new Error('Existing share does not match this immutable edition');return;}
  await client.create({recordName:name,recordType:RECORD_TYPE,fields:{payloadJSON:{value:await sealMetadata(meta,token)}}});
}
export async function publishPlan(plan,client,receiptPath,grants,schemaEvidence) {
  if(plan.visibility!=='public-link' || plan.version!==1 || !plan.files?.length || plan.files.some(f=>f.public!==true))throw new Error('Files are private unless explicitly published');
  const profile=client.profile,owner=callerIdentity(await client.call('users/caller',{}));
  if(owner.userRecordName!==profile.expectedAdminRecordName)throw new Error('Administrator identity mismatch');
  const privateNames=['internal-catalog-v1','internal-admin-v1'];
  const denied=await client.call('records/lookup',{records:privateNames.map(recordName=>({recordName}))},'');
  if(!deniedLookup(denied,privateNames))throw new Error('Private records must remain denied to anonymous callers');
  const receipt={version:1,startedAt:new Date().toISOString(),container:profile.container,environment:profile.environment,grants,schemaEvidence,anonymousPrivateDenied:true,files:[]};
  for(const file of plan.files){
    const meta=validateMetadata(file.metadata),handle=await open(file.path,'r');
    try{
      const checksum=createHash('sha256');let offset=0;
      for(let index=0;index<meta.parts;index++){
        const length=Math.min(PART_BYTES,meta.bytes-offset),bytes=Buffer.alloc(length);
        const {bytesRead}=await handle.read(bytes,0,length,offset);if(bytesRead!==length)throw new Error('Local package was truncated');checksum.update(bytes);
        const name=await recordName(file.token,index),existing=await lookup(client,name);
        if(existing){
          const asset=existing.fields?.asset?.value;if(!asset||asset.size!==length+28)throw new Error('Existing encrypted part is invalid');
          const {unseal}=await import('../../static/internal/download/crypto.mjs');
          const response=await fetch(appleAssetURL(asset.downloadURL),{credentials:'omit',signal:AbortSignal.timeout(120000)});
          const encrypted=await limitedBytes(response,length+28);
          const plain=await unseal(encrypted,file.token,name);if(!Buffer.from(plain).equals(bytes))throw new Error('Existing part does not match local bytes');
        }else await uploadAsset(client,name,await seal(bytes,file.token,name));
        offset+=length;console.log(`${meta.filename}: encrypted part ${index+1}/${meta.parts}`);
      }
      if((await handle.stat()).size!==meta.bytes || checksum.digest('hex')!==meta.sha256)throw new Error('Local package checksum changed; manifest not published');
    }finally{await handle.close();}
    // Verify the entire artifact as an anonymous client before publishing its manifest.
    const verified=await downloadFile(meta,file.token,async name=>{const r=await lookup(client,name,true);if(!r)throw new Error('Anonymous encrypted part unavailable');return r;},(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(120000)}));
    if(verified.length!==meta.bytes)throw new Error('Read-back failed');
    await publishMetadata(client,file.token,meta);
    const readback=await lookup(client,await recordName(file.token),true);
    if(JSON.stringify(await openMetadata(readback.fields.payloadJSON.value,file.token))!==JSON.stringify(meta))throw new Error('Public metadata verification failed');
    receipt.files.push({filename:meta.filename,bytes:meta.bytes,sha256:meta.sha256,url:`https://www.orbitusrobotics.com/internal/download/#${file.token}`,anonymousDownloadVerified:true});
    await savePrivate(receiptPath,receipt);console.log(`${meta.filename}: anonymous bytes and SHA-256 verified`);
  }
  const collection=validateMetadata(collectionMetadata(plan));await publishMetadata(client,plan.collectionToken,collection);
  const saved=await lookup(client,await recordName(plan.collectionToken),true);await openMetadata(saved.fields.payloadJSON.value,plan.collectionToken);
  const after=await client.call('records/lookup',{records:privateNames.map(recordName=>({recordName}))},'');if(!deniedLookup(after,privateNames))throw new Error('Final private-access check failed');
  receipt.collectionURL=`https://www.orbitusrobotics.com/internal/download/#${plan.collectionToken}`;receipt.completedAt=new Date().toISOString();await savePrivate(receiptPath,receipt);return receipt;
}
async function main(){
  const args=Object.fromEntries(process.argv.slice(2).reduce((a,v,i,all)=>{if(v.startsWith('--'))a.push([v.slice(2),all[i+1]]);return a;},[]));
  if(args.prepare){const plan=await preparePlan(JSON.parse(await readFile(args.prepare,'utf8')),args.plan);console.log(`Prepared ${plan.files.length} opt-in downloads; keys saved privately. Nothing uploaded.`);return;}
  if(!args.publish || !args.plan || !args.profile || !args.receipt || !args['schema-receipt'])throw new Error('Use --prepare inventory.json --plan /private/plan.json; or --publish yes --plan ... --profile ... --schema-receipt ... --receipt ...');
  if(args.publish!=='yes')throw new Error('Explicit publication is required');
  outsideGit(args.plan);outsideGit(args.receipt);
  const profile=await readProfile(args.profile),proof=JSON.parse(await readFile(args['schema-receipt'],'utf8')),schema=await readFile(proof.schemaFile,'utf8');
  const evidence=verifyConsoleSchemaExport(proof,schema,profile),grants=auditDownloadSchema(schema);
  await publishPlan(JSON.parse(await readFile(args.plan,'utf8')),new CloudClient(profile),args.receipt,grants,evidence);console.log('All downloads verified. Link receipt saved privately.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error(error.message);process.exitCode=1;});
