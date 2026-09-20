import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildCalibratedRig } from './rob-calibrated-rig.mjs';
import { GESTURES, validateGesture, sampleGesture, previewBounds, armReferenceConflicts } from './rob-gesture-core.mjs';
import { createCurbWorkshop } from './rob-curb-workshop.mjs';
import { GroundContactPreview } from './rob-ground-contact.mjs';

const root=document.querySelector('[data-gesture-studio]');
if(root) start().catch(error=>{root.querySelector('[data-status]').textContent='Could not load the preview: '+error.message+'. Reload to retry.';});
async function start() {
  const $=name=>root.querySelector('[data-'+name+']'), viewport=$('viewport'), status=$('status');
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x081019);
  const camera=new THREE.PerspectiveCamera(38,1,.01,30);camera.up.set(0,0,1);
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));viewport.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','Articulated ROB scan; drag to orbit and scroll to zoom');
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
  function resetView(){camera.position.set(2.1,1.8,1.35);controls.target.set(0,0,.62);controls.update();}resetView();
  $('reset-view').addEventListener('click',resetView);
  const grid=new THREE.GridHelper(3,30,0x396273,0x1c3344);grid.rotation.x=Math.PI/2;scene.add(grid);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(3,3),new THREE.MeshBasicMaterial({color:0x101e2a,side:THREE.DoubleSide}));floor.position.z=-.005;scene.add(floor);
  new ResizeObserver(()=>{const w=viewport.clientWidth,h=viewport.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}).observe(viewport);
  const response=await fetch(root.dataset.rigUrl);if(!response.ok)throw Error('scan response '+response.status);
  const rigDocument=await response.json(),rig=buildCalibratedRig(rigDocument);scene.add(rig.root);
  const worker=new Worker(root.dataset.motionWorkerUrl,{type:'module'}),requests=new Map(),checks=new Map();let requestID=0,checkerHealthy=true;
  worker.onmessage=({data})=>{const pending=requests.get(data.id);if(!pending)return;requests.delete(data.id);data.error?pending.reject(Error(data.error)):pending.resolve(data.result);};
  worker.onerror=()=>{checkerHealthy=false;for(const p of requests.values())p.reject(Error('Motion checker unavailable. Reload before playback.'));requests.clear();playing=false;clipReady=false;status.textContent='Motion checker unavailable. Reload before playback.';$('play').disabled=true;};
  function check(operation,payload){return new Promise((resolve,reject)=>{if(!checkerHealthy){reject(Error('Motion checker unavailable. Reload before playback.'));return;}const id=++requestID;requests.set(id,{resolve,reject});worker.postMessage({id,operation,payload});});}
  const checkerReady=check('init',rigDocument);
  async function checkClip(next){if(!checkerHealthy)throw Error('Motion checker unavailable. Reload before playback.');validateGesture(next,rig.profile);const key=JSON.stringify(next);if(!checks.has(key)){await checkerReady;checks.set(key,await check('gesture',next));}return checks.get(key);}
  const ground=new GroundContactPreview(rig.profile);
  let clip=structuredClone(GESTURES[0]),time=0,playing=false,manual={},last=performance.now(),clipReady=false,busy=false,editID=0;
  const curb=createCurbWorkshop({container:$('curb-workshop'),scene,rig,onEnter:()=>{editID++;busy=false;playing=false;$('play').textContent='Play';}});
  for(const [i,g] of GESTURES.entries()) {
    const option=new Option(g.name,String(i));
    try{validateGesture(g,rig.profile);}catch(error){option.text+=' — reference review needed';option.disabled=true;option.title=error.message;}
    $('gesture').add(option);
  }
  const conflicts=armReferenceConflicts(rig.profile);
  $('reference-review').textContent=conflicts.length?'Reference review: '+conflicts.map(c=>c.name+' is '+c.referenceDegrees.toFixed(1)+'° from upright ('+c.excessDegrees.toFixed(1)+'° outside the provisional limit)').join('; ')+'. The captured pose stays visible; gestures moving that joint are unavailable until its reference or travel is reconciled.':'';
  for(const j of rig.profile.joints.filter(j=>['revolute','continuous'].includes(j.kind)))$('joint').add(new Option(j.name,j.name));
  $('joint').value='left_joint2';
  $('segments').addEventListener('change',()=>rig.showSegments($('segments').checked));
  $('new').addEventListener('click',()=>activate({schemaVersion:1,simulationOnly:true,kind:'gesture',name:'My ROB gesture',duration:8,tracks:{}},'New gesture: choose a timeline point, move a joint, then capture its keyframe.'));
  function joint(){return rig.profile.joints.find(j=>j.name===$('joint').value);}
  function offsets(){return {...sampleGesture(clip,time),...manual};}
  function fields(){
    const j=joint(),b=previewBounds(j,rig.profile.previewPositions[j.name] || 0),v=offsets()[j.name] || 0;
    $('angle-input').min=b.arm?b.centeredMin:b.min;$('angle-input').max=b.arm?b.centeredMax:b.max;
    $('angle-input').value=b.arm?v+b.referenceDegrees:v;$('angle').textContent=(b.arm?v+b.referenceDegrees:v).toFixed(1)+'°';
    $('angle-label').textContent=b.arm?'Angle from upright zero':'Offset from scan';
    $('angle-input').disabled=busy || !clipReady || (b.arm && !b.referenceInRange);
    $('play').disabled=busy || !clipReady;
    $('timeline').disabled=busy || !clipReady;
    $('joint-detail').textContent=b.arm?j.name+' · scan reference '+b.referenceDegrees.toFixed(1)+'° · current offset '+v.toFixed(1)+'° · provisional centered range −120° to +120°. Cable travel unmeasured.':j.name+' · '+b.min.toFixed(1)+'° to '+b.max.toFixed(1)+'° from reference';
  }
  function present(){const pose=offsets(),support=ground.solve(pose);rig.pose(pose);rig.root.position.set(support.world.x,0,support.world.height);rig.root.rotation.y=support.world.pitch*Math.PI/180;rig.root.updateMatrixWorld(true);$('timeline').value=time;$('time').textContent=time.toFixed(2)+' / '+clip.duration.toFixed(1)+' s';$('play').textContent=playing?'Pause':'Play';fields();}
  function script(){
    $('script').value=JSON.stringify(clip,null,2);$('timeline').max=clip.duration;
    const preset=GESTURES.findIndex(g=>JSON.stringify(g)===JSON.stringify(clip));
    $('gesture').querySelector('option[value="custom"]')?.remove();
    if(preset<0)$('gesture').add(new Option(clip.name+' (custom)','custom'));
    $('gesture').value=preset<0?'custom':String(preset);
  }
  function reset(invalidate=true){if(invalidate){editID++;busy=false;}curb.leave();playing=false;time=0;manual={};present();}
  async function activate(next,message='Centered joint limits and head clearance checked throughout the gesture.') {
    const id=++editID;busy=true;playing=false;status.textContent='Checking joint limits and the full path around the head…';fields();
    try{await checkClip(next);if(id!==editID)return;clip=next;clipReady=true;script();reset(false);status.textContent=message;}
    catch(error){if(id===editID){status.textContent='Script rejected: '+error.message;playing=false;}}
    finally{if(id===editID){busy=false;present();}}
  }
  $('play').addEventListener('click',()=>{if(busy || !clipReady)return;editID++;curb.leave();manual={};if(time>=clip.duration)time=0;playing=!playing;present();});
  $('reset').addEventListener('click',()=>{reset();if(!clipReady)activate(clip);});
  $('timeline').addEventListener('input',()=>{editID++;busy=false;curb.leave();playing=false;manual={};time=Number($('timeline').value);present();});
  $('gesture').addEventListener('change',()=>{if($('gesture').value==='custom')return;activate(structuredClone(GESTURES[Number($('gesture').value)]));});
  $('joint').addEventListener('change',fields);
  $('angle-input').addEventListener('input',async()=>{
    curb.leave();playing=false;const j=joint(),b=previewBounds(j,rig.profile.previewPositions[j.name] || 0),from=offsets();
    const value=Number($('angle-input').value)-(b.arm?b.referenceDegrees:0),to={...from,[j.name]:value},id=++editID;
    busy=true;status.textContent='Checking this joint’s path around the head…';fields();
    try{await checkerReady;await check('transition',{from,to});if(id!==editID)return;manual[j.name]=value;status.textContent='Pose checked against the head and upper-camera clearance.';}
    catch(error){if(id===editID)status.textContent='Pose rejected: '+error.message;}
    finally{if(id===editID){busy=false;present();}}
  });
  $('keyframe').addEventListener('click',()=>{
    if(time<=0 || time>=clip.duration){status.textContent='Choose a timeline point between the first and last frames.';return;}
    let next;try{next=JSON.parse($('script').value);validateGesture(next,rig.profile);}catch(e){status.textContent='Validate or repair the script before adding another keyframe: '+e.message;return;}
    const name=joint().name,keys=next.tracks[name] || [[0,0],[next.duration,0]],t=Math.round(time*100)/100;
    next.tracks[name]=[...keys.filter(k=>Math.abs(k[0]-t)>.005),[t,offsets()[name] || 0]].sort((a,b)=>a[0]-b[0]);
    $('script').value=JSON.stringify(next,null,2);
    status.textContent='Keyframe captured in the script. Validate & preview to apply it.';
  });
  $('apply').addEventListener('click',()=>{try{activate(JSON.parse($('script').value));}catch(e){playing=false;status.textContent='Script rejected: '+e.message;present();}});
  function download(text,name){const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  $('download').addEventListener('click',async()=>{try{const c=JSON.parse($('script').value);status.textContent='Checking the script before download…';await checkClip(c);download(JSON.stringify(c,null,2),'rob-gesture.json');status.textContent='Checked simulation script downloaded.';}catch(e){status.textContent=e.message;}});
  $('import').addEventListener('change',async()=>{const file=$('import').files[0];if(!file)return;if(file.size>1000000){status.textContent='Use a script smaller than 1 MB.';return;}try{await activate(JSON.parse(await file.text()),'Imported gesture; full head-clearance path checked.');}catch(e){status.textContent='Import rejected: '+e.message;}});
  script();present();activate(clip);
  function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.1);last=now;if(document.hidden)playing=false;if(curb.active)curb.tick(dt);else if(playing){time=Math.min(clip.duration,time+dt*Number($('speed').value));if(time>=clip.duration)playing=false;present();}controls.update();renderer.render(scene,camera);}requestAnimationFrame(frame);
}
