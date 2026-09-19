import { previewBounds, smooth } from './rob-gesture-core.mjs';
import { GroundContactPreview, CURB_TERRAIN } from './rob-ground-contact.mjs';

export const SIGNALS = {
  pose_visible:'Fresh visible pose',operator_present:'Operator present',path_clear:'Approach clear',
  edge_aligned:'Aligned with the platform',front_flipper_contact:'Front flipper wheels touching',
  front_lifted:'Front treads above the curb',front_ready:'Front treads over the edge',
  front_contact:'Front tread contact',hold_verified:'Brake hold verified',
  rear_flipper_contact:'Flipper wheels touching behind ROB',rear_support:'Rear support verified',
  on_platform:'Both treads over the platform',level_verified:'Level and settled'
};
const pose=(flipper,lean=0)=>({left_flipper:flipper,right_flipper:flipper,body_lean:lean});
export const CURB_SEQUENCE={
  schemaVersion:2,simulationOnly:true,kind:'guarded_sequence',name:'Contact-driven curb ascent',
  platformHeightM:.12,timeoutSeconds:12,
  note:'Wheel/terrain collision determines chassis height and pitch. Planar quasi-static preview; traction, dynamics and hardware unvalidated.',
  steps:[
    {id:'align',label:'Approach and align',seconds:8,brake:'released',driveM:.2,pose:pose(0),before:['path_clear'],during:['path_clear'],after:['edge_aligned']},
    {id:'place_flippers',label:'Touch the ground, then lift the front',seconds:10,brake:'hold',driveM:0,pose:pose(139),before:['hold_verified'],during:['hold_verified'],after:['front_flipper_contact','front_lifted']},
    {id:'mount_front',label:'Advance until the front clears the edge',seconds:14,brake:'released',driveM:.4,pose:pose(139),until:'front_ready',before:['front_lifted'],during:['front_flipper_contact','path_clear'],after:['front_ready']},
    {id:'seat_front',label:'Raise the flippers and seat the front tread',seconds:8,brake:'hold',driveM:0,pose:pose(107),before:['front_ready'],during:['hold_verified'],after:['front_contact']},
    {id:'brake',label:'Hold the treads and check for rollback',seconds:1,brake:'hold',driveM:0,pose:pose(107),before:['front_contact'],during:['front_contact','hold_verified'],after:['hold_verified']},
    {id:'transfer',label:'Swing fully back until the rear wheels touch',seconds:18,brake:'hold',driveM:0,pose:pose(-97),before:['hold_verified','front_contact'],during:['front_contact','hold_verified'],after:['rear_flipper_contact']},
    {id:'advance',label:'Advance slowly with rear support',seconds:22,brake:'released',driveM:.6,pose:pose(-97),until:'on_platform',before:['rear_flipper_contact','path_clear'],during:['rear_support','path_clear'],after:['on_platform']},
    {id:'settle',label:'Brake, stow the flippers and settle level',seconds:10,brake:'hold',driveM:0,pose:pose(0),before:['on_platform'],during:['on_platform','hold_verified'],after:['hold_verified','level_verified']}
  ]
};
export function validateSequence(script,profile) {
  if(!script || script.schemaVersion!==2 || script.simulationOnly!==true || script.kind!=='guarded_sequence')throw Error('Use a version 2 contact-driven simulation sequence.');
  if(!Array.isArray(script.steps) || script.steps.length<2 || script.steps.length>32)throw Error('Use 2–32 guarded steps.');
  if(!Number.isFinite(script.platformHeightM) || script.platformHeightM<=0 || script.platformHeightM>.25)throw Error('Preview platform height must be 0–0.25 m.');
  if(!Number.isFinite(script.timeoutSeconds) || script.timeoutSeconds<1 || script.timeoutSeconds>60)throw Error('Checkpoint timeout must be 1–60 seconds.');
  const ids=new Set(),joints=new Map(profile.joints.map(j=>[j.name,j]));
  let prior={},total=0;
  for(const step of script.steps) {
    if(typeof step.id!=='string' || !/^[a-z][a-z0-9_]*$/.test(step.id) || ids.has(step.id) || typeof step.label!=='string' || !step.label.trim())throw Error('Steps need unique IDs and labels.');
    ids.add(step.id);
    if(!Number.isFinite(step.seconds) || step.seconds<.5 || step.seconds>60)throw Error('Step duration must be 0.5–60 seconds.');
    total+=step.seconds;if(total>300)throw Error('Sequence exceeds five minutes.');
    if(!['hold','released'].includes(step.brake) || !Number.isFinite(step.driveM) || step.driveM<0 || step.driveM>.6)throw Error('Invalid drive/brake state.');
    if(step.brake==='hold' && step.driveM!==0)throw Error('A held brake cannot also request drive.');
    if(1.875*step.driveM/step.seconds>.06)throw Error('Preview drive is too fast; lengthen the step.');
    if('world' in step)throw Error('Remove world height/pitch/position: terrain contact now computes the chassis pose.');
    if(step.until!==undefined && (!Object.hasOwn(SIGNALS,step.until) || !step.after?.includes(step.until)))throw Error('Stop-on-contact must use an after confirmation.');
    for(const key of ['before','during','after'])if(!Array.isArray(step[key]) || !step[key].length || step[key].some(s=>!Object.hasOwn(SIGNALS,s)))throw Error('Use known confirmation signals before, during and after each step.');
    if(!step.pose || typeof step.pose!=='object' || Array.isArray(step.pose))throw Error('Missing joint pose.');
    for(const name of new Set([...Object.keys(prior),...Object.keys(step.pose)])) {
      const joint=joints.get(name),value=step.pose[name]??0;
      if(!joint || !['revolute','continuous'].includes(joint.kind) || !Number.isFinite(value))throw Error('Invalid sequence joint: '+name);
      const b=previewBounds(joint,profile.previewPositions[name] || 0),change=Math.abs(value-(prior[name]??0));
      if(value<b.min-1e-8 || value>b.max+1e-8 || 1.875*change/step.seconds>b.speed || 5.774*change/step.seconds**2>b.acceleration)throw Error(name+': sequence exceeds preview angle/rate limits.');
    }
    if((step.pose.left_flipper??0)!==(step.pose.right_flipper??0))throw Error('Use matching flippers in this planar curb preview.');
    prior=step.pose;
  }
  if(!script.steps.at(-1).after.includes('level_verified') || script.steps.at(-1).brake!=='hold')throw Error('End with brake hold and a level confirmation.');
  return script;
}
export class SequencePreview {
  constructor(script,profile){this.profile=profile;this.script=structuredClone(validateSequence(script,profile));this.reset();}
  reset(){
    this.index=0;this.elapsed=0;this.waited=0;this.phase='ready';this.fault=null;this.events=[];
    this.offsets={};this.startOffsets={};this.commandedDistance=0;
    this.contact=new GroundContactPreview(this.profile,{...CURB_TERRAIN,height:this.script.platformHeightM},-.35);
  }
  get step(){return this.script.steps[this.index];}
  get required(){return this.phase==='before'?[...new Set([...this.step.before,...this.step.during,...(this.step.brake==='hold'?['hold_verified']:[])])]:this.phase==='after'?this.step.after:[];}
  start(){if(this.phase!=='ready')return;this.phase='before';this.events.push({step:this.step.id,event:'begin'});}
  abort(reason='OPERATOR_ABORT'){this.fault=reason;this.phase='aborted';this.events.push({step:this.step?.id,event:'abort',reason});}
  observations(signals) {
    const observed={...signals};
    // Synthetic/manual acknowledgments never manufacture a geometry contact.
    for(const [key,value] of Object.entries(this.contact.state.signals))observed[key]=value && signals[key]===true;
    return observed;
  }
  tick(dt,signals) {
    if(!['before','moving','after'].includes(this.phase))return;
    if(!Number.isFinite(dt) || dt<0 || dt>.25){this.abort('INVALID_CLOCK');return;}
    const observed=this.observations(signals);
    if(observed.pose_visible!==true){this.abort('POSE_UNCONFIRMED');return;}
    if(observed.operator_present!==true){this.abort('OPERATOR_ABSENT');return;}
    if(observed.rollback===true){this.abort('ROLLBACK_DETECTED');return;}
    if(observed.brake_failed===true){this.abort('BRAKE_HOLD_FAILED');return;}
    if(['moving','after'].includes(this.phase) && this.step.brake==='hold' && observed.hold_verified!==true){this.abort('BRAKE_HOLD_UNCONFIRMED');return;}
    if(this.phase==='moving' && this.step.driveM>0 && observed.path_clear!==true){this.abort('PATH_BLOCKED');return;}
    if(['moving','after'].includes(this.phase) && !this.step.during.every(k=>observed[k]===true)){this.abort('SUPPORT_UNCONFIRMED');return;}
    if(this.phase==='before' || this.phase==='after') {
      if(!this.required.every(key=>observed[key]===true)){this.waited+=dt;if(this.waited>=this.script.timeoutSeconds)this.abort('CONFIRMATION_TIMEOUT');return;}
      this.waited=0;
      if(this.phase==='before'){this.phase='moving';this.events.push({step:this.step.id,event:'confirm_before'});}
      else {
        this.events.push({step:this.step.id,event:'confirm_after',world:{...this.contact.state.world},contacts:this.contact.state.contacts.filter(c=>c.id!=='belt' && c.gap<=.001)});
        if(this.index===this.script.steps.length-1){this.phase='complete';return;}
        this.index++;this.elapsed=0;this.commandedDistance=0;this.startOffsets={...this.offsets};this.phase='before';return;
      }
    }
    if(this.phase==='moving') {
      this.elapsed=Math.min(this.step.seconds,this.elapsed+dt);
      const u=smooth(this.elapsed/this.step.seconds);
      this.offsets=Object.fromEntries([...new Set([...Object.keys(this.startOffsets),...Object.keys(this.step.pose)])].map(n=>[n,(this.startOffsets[n]??0)+((this.step.pose[n]??0)-(this.startOffsets[n]??0))*u]));
      const target=this.step.driveM*u,delta=Math.max(0,target-this.commandedDistance);this.commandedDistance=target;
      const state=this.contact.advance(this.offsets,delta);
      if(this.step.until && state.signals[this.step.until])this.phase='after';
      else if(state.driveBlocked)this.abort('TERRAIN_BLOCKED');
      else if(this.elapsed>=this.step.seconds)this.phase='after';
    }
  }
  sample(){return {offsets:{...this.offsets},world:{...this.contact.state.world},contacts:this.contact.state.contacts,contactSignals:this.contact.state.signals,
    brake:this.step.brake,phase:this.phase,step:this.step.label,required:this.required,fault:this.fault,hardwareAuthorized:false};}
}
