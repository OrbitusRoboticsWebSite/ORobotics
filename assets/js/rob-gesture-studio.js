import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildCalibratedRig } from './rob-calibrated-rig.mjs';
import { GESTURES, validateGesture, sampleGesture, previewBounds } from './rob-gesture-core.mjs';
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
  const rig=buildCalibratedRig(await response.json());scene.add(rig.root);
  const ground=new GroundContactPreview(rig.profile);
  let clip=structuredClone(GESTURES[0]),time=0,playing=false,manual={},last=performance.now();
  const curb=createCurbWorkshop({container:$('curb-workshop'),scene,rig,onEnter:()=>{playing=false;$('play').textContent='Play';}});
  for(const [i,g] of GESTURES.entries())$('gesture').add(new Option(g.name,String(i)));
  for(const j of rig.profile.joints.filter(j=>['revolute','continuous'].includes(j.kind)))$('joint').add(new Option(j.name,j.name));
  $('joint').value='left_joint2';
  $('segments').addEventListener('change',()=>rig.showSegments($('segments').checked));
  $('new').addEventListener('click',()=>{clip={schemaVersion:1,simulationOnly:true,kind:'gesture',name:'My ROB gesture',duration:8,tracks:{}};script();reset();status.textContent='New gesture: choose a timeline point, move a joint, then capture its keyframe.';});
  function joint(){return rig.profile.joints.find(j=>j.name===$('joint').value);}
  function offsets(){return {...sampleGesture(clip,time),...manual};}
  function fields(){
    const j=joint(),b=previewBounds(j,rig.profile.previewPositions[j.name] || 0),v=offsets()[j.name] || 0;
    $('angle-input').min=b.min;$('angle-input').max=b.max;$('angle-input').value=v;$('angle').textContent=v.toFixed(1)+'°';
    $('joint-detail').textContent=j.name+' · '+b.min.toFixed(1)+'° to '+b.max.toFixed(1)+'° from reference'+(b.arm?' · cable travel unmeasured':'');
  }
  function present(){const pose=offsets(),support=ground.solve(pose);rig.pose(pose);rig.root.position.set(support.world.x,0,support.world.height);rig.root.rotation.y=support.world.pitch*Math.PI/180;rig.root.updateMatrixWorld(true);$('timeline').value=time;$('time').textContent=time.toFixed(2)+' / '+clip.duration.toFixed(1)+' s';$('play').textContent=playing?'Pause':'Play';fields();}
  function script(){
    $('script').value=JSON.stringify(clip,null,2);$('timeline').max=clip.duration;
    const preset=GESTURES.findIndex(g=>JSON.stringify(g)===JSON.stringify(clip));
    $('gesture').querySelector('option[value="custom"]')?.remove();
    if(preset<0)$('gesture').add(new Option(clip.name+' (custom)','custom'));
    $('gesture').value=preset<0?'custom':String(preset);
  }
  function reset(){curb.leave();playing=false;time=0;manual={};present();}
  $('play').disabled=false;$('play').addEventListener('click',()=>{curb.leave();manual={};if(time>=clip.duration)time=0;playing=!playing;present();});
  $('reset').addEventListener('click',reset);
  $('timeline').addEventListener('input',()=>{curb.leave();playing=false;manual={};time=Number($('timeline').value);present();});
  $('gesture').addEventListener('change',()=>{if($('gesture').value==='custom')return;clip=structuredClone(GESTURES[Number($('gesture').value)]);validateGesture(clip,rig.profile);script();reset();});
  $('joint').addEventListener('change',fields);
  $('angle-input').addEventListener('input',()=>{curb.leave();playing=false;manual[joint().name]=Number($('angle-input').value);present();});
  $('keyframe').addEventListener('click',()=>{
    if(time<=0 || time>=clip.duration){status.textContent='Choose a timeline point between the first and last frames.';return;}
    let next;try{next=JSON.parse($('script').value);validateGesture(next,rig.profile);}catch(e){status.textContent='Validate or repair the script before adding another keyframe: '+e.message;return;}
    const name=joint().name,keys=next.tracks[name] || [[0,0],[next.duration,0]],t=Math.round(time*100)/100;
    next.tracks[name]=[...keys.filter(k=>Math.abs(k[0]-t)>.005),[t,offsets()[name] || 0]].sort((a,b)=>a[0]-b[0]);
    $('script').value=JSON.stringify(next,null,2);
    status.textContent='Keyframe captured in the script. Validate & preview to apply it.';
  });
  $('apply').addEventListener('click',()=>{try{const c=JSON.parse($('script').value);validateGesture(c,rig.profile);clip=c;script();reset();status.textContent='Script validated for bounded simulation playback. Physical limits remain unverified.';}catch(e){playing=false;status.textContent='Script rejected: '+e.message;present();}});
  function download(text,name){const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  $('download').addEventListener('click',()=>{try{const c=JSON.parse($('script').value);validateGesture(c,rig.profile);download(JSON.stringify(c,null,2),'rob-gesture.json');}catch(e){status.textContent=e.message;}});
  $('import').addEventListener('change',async()=>{const file=$('import').files[0];if(!file)return;if(file.size>1000000){status.textContent='Use a script smaller than 1 MB.';return;}try{const c=JSON.parse(await file.text());validateGesture(c,rig.profile);clip=c;script();reset();status.textContent='Imported simulation gesture.';}catch(e){status.textContent='Import rejected: '+e.message;}});
  validateGesture(clip,rig.profile);script();present();status.textContent=rig.provenance.segments+' scan segments follow the approved joint frames. Drag to orbit; select a gesture to play.';
  function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.1);last=now;if(document.hidden)playing=false;if(curb.active)curb.tick(dt);else if(playing){time=Math.min(clip.duration,time+dt*Number($('speed').value));if(time>=clip.duration)playing=false;present();}controls.update();renderer.render(scene,camera);}requestAnimationFrame(frame);
}
