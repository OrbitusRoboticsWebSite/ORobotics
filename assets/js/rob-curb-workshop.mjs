import * as THREE from 'three';
import { CURB_SEQUENCE, SIGNALS, SequencePreview } from './rob-curb-sequence.mjs';
import { CURB_TERRAIN } from './rob-ground-contact.mjs';

export function createCurbWorkshop({container,scene,rig,onEnter}) {
  container.id='curb-workshop';container.className='curb-workshop';
  container.innerHTML='<div class="curb-heading"><div><p class="gesture-eyebrow">Guarded gesture / research preview</p><h2>A curb climb, one confirmed step at a time</h2><p>Rehearse tread advance, brake hold, flipper transfer and leveling. The flipper wheels must touch terrain before they can lift ROB. Height and tilt come from simulated contact.</p></div><span class="gesture-badge">Not authorized for hardware</span></div><div class="curb-layout"><div><div class="gesture-buttons"><button type="button" data-curb-run>Run rehearsal</button><button type="button" data-curb-stop>Abort</button><button type="button" data-curb-reset>Reset rehearsal</button></div><label><input type="checkbox" data-curb-auto checked> Auto-confirm simulated observations (terrain contacts still required)</label><label>Inject a simulated fault<select data-curb-fault><option value="">No fault</option><option value="vision">Camera loses pose</option><option value="rollback">Rollback detected</option><option value="brake">Brake fails to hold</option><option value="obstacle">Path becomes blocked</option><option value="operator">Operator releases control</option></select></label><button type="button" data-curb-confirm>Confirm this simulation checkpoint</button><p class="curb-state" role="status" data-curb-state>Ready. No physical robot is connected.</p><p data-curb-contact></p><ol data-curb-steps></ol><p class="gesture-note">An abort freezes this rehearsal and blocks the next step. On ROB, recovery must use the tested stop/hold response; a brake command alone cannot prove that rollback is prevented.</p></div><div><label>Sequence JSON<textarea data-curb-script spellcheck="false" aria-label="Curb sequence JSON"></textarea></label><div class="gesture-buttons"><button type="button" data-curb-apply>Validate sequence</button><button type="button" data-curb-download>Download sequence</button><button type="button" data-curb-log>Download rehearsal log</button></div><p>Planar contact preview using the reviewed wheel radii and tread envelope. Mass, traction, balance and real brake holding force are not simulated. Physical deployment also needs a supported curb envelope, observed contact and pitch, verified braking, fresh joint references, cable limits, clearance, a dead-man control and an approved recovery procedure.</p></div></div>';
  const $=name=>container.querySelector('[data-curb-'+name+']');
  let script=structuredClone(CURB_SEQUENCE),runner=new SequencePreview(script,rig.profile),active=false,paused=true,confirmed=new Set();
  const platform=new THREE.Mesh(new THREE.BoxGeometry(1.5,1.2,script.platformHeightM),new THREE.MeshBasicMaterial({color:0x294958}));
  platform.position.set((CURB_TERRAIN.start+CURB_TERRAIN.end)/2,0,script.platformHeightM/2);platform.visible=false;scene.add(platform);
  const edge=new THREE.Mesh(new THREE.BoxGeometry(.018,1.22,.018),new THREE.MeshBasicMaterial({color:0xf3be67}));
  edge.position.set(CURB_TERRAIN.start,0,script.platformHeightM+.009);edge.visible=false;scene.add(edge);
  function signals(){
    const all=Object.fromEntries(Object.keys(SIGNALS).map(k=>[k,$('auto').checked || confirmed.has(k)]));
    all.pose_visible=true;all.operator_present=true;all.path_clear=true;
    switch($('fault').value){case 'vision':all.pose_visible=false;break;case 'rollback':all.rollback=true;break;case 'brake':all.brake_failed=true;all.hold_verified=false;break;case 'obstacle':all.path_clear=false;break;case 'operator':all.operator_present=false;break;}
    return all;
  }
  function rows(){
    $('steps').replaceChildren(...script.steps.map((s,i)=>{const li=document.createElement('li');li.textContent=s.label;li.dataset.step=String(i);return li;}));
    $('script').value=JSON.stringify(script,null,2);
  }
  function show(){
    const s=runner.sample();if(active){rig.pose(s.offsets);rig.root.position.set(s.world.x,0,s.world.height);rig.root.rotation.y=s.world.pitch*Math.PI/180;rig.root.updateMatrixWorld(true);}
    $('contact').textContent='Flipper wheels: '+(s.contactSignals.front_flipper_contact?'supporting in front':s.contactSignals.rear_flipper_contact?'supporting behind':'clear of the supporting surface')+' · Chassis tilt '+s.world.pitch.toFixed(1)+'°';
    const label=s.phase==='aborted'?'Aborted: '+s.fault:s.phase==='complete'?'Rehearsal complete — synthetic confirmations only':s.step+' · '+s.phase+(paused?' · paused':'');
    $('state').textContent=label+' · Brake '+(s.brake==='hold'?'hold requested':'released')+(s.required.length?' · Awaiting: '+s.required.map(k=>SIGNALS[k]).join(', '):'');
    $('run').textContent=!paused && active?'Pause rehearsal':s.phase==='complete' || s.phase==='aborted'?'Restart rehearsal':active?'Resume rehearsal':'Run rehearsal';
    $('confirm').disabled=!active || !['before','after'].includes(runner.phase) || $('auto').checked;
    for(const li of $('steps').children){li.classList.toggle('is-active',Number(li.dataset.step)===runner.index);li.classList.toggle('is-done',Number(li.dataset.step)<runner.index || runner.phase==='complete');}
  }
  function activate(){onEnter();active=true;platform.visible=edge.visible=true;}
  function reset(){runner=new SequencePreview(script,rig.profile);confirmed.clear();paused=true;activate();show();}
  function leave(){active=false;paused=true;platform.visible=edge.visible=false;rig.root.position.set(0,0,0);rig.root.rotation.set(0,0,0);rig.pose();show();}
  $('run').addEventListener('click',()=>{activate();if(['complete','aborted'].includes(runner.phase)){runner.reset();confirmed.clear();}if(runner.phase==='ready')runner.start();paused=!paused;show();});
  $('reset').addEventListener('click',reset);
  $('stop').addEventListener('click',()=>{runner.abort();paused=true;show();});
  $('confirm').addEventListener('click',()=>{runner.required.forEach(s=>confirmed.add(s));show();});
  $('auto').addEventListener('change',()=>{confirmed.clear();show();});
  $('fault').addEventListener('change',()=>{if(active && !paused)runner.tick(0,signals());show();});
  $('apply').addEventListener('click',()=>{try{const candidate=JSON.parse($('script').value),next=new SequencePreview(candidate,rig.profile);script=candidate;runner=next;platform.geometry.dispose();platform.geometry=new THREE.BoxGeometry(1.5,1.2,script.platformHeightM);platform.position.z=script.platformHeightM/2;edge.position.z=script.platformHeightM+.009;rows();reset();}catch(e){paused=true;$('state').textContent='Sequence rejected: '+e.message;}});
  function save(object,name){const url=URL.createObjectURL(new Blob([JSON.stringify(object,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  $('download').addEventListener('click',()=>{try{const c=JSON.parse($('script').value);new SequencePreview(c,rig.profile);save(c,'rob-curb-simulation.json');}catch(e){$('state').textContent='Export rejected: '+e.message;}});
  $('log').addEventListener('click',()=>save({schemaVersion:1,simulationOnly:true,hardwareAuthorized:false,syntheticObservations:true,contactModel:'planar-quasi-static',contacts:runner.sample().contacts,profileSHA256:rig.provenance.profileSHA256,sequence:script,phase:runner.phase,fault:runner.fault,events:runner.events},'rob-curb-rehearsal-log.json'));
  rows();show();
  return {get active(){return active;},leave,tick(dt){
    if(document.hidden)paused=true;
    if(active && !paused){const i=runner.index;runner.tick(dt,signals());if(i!==runner.index)confirmed.clear();if(['complete','aborted'].includes(runner.phase))paused=true;show();}
  }};
}
