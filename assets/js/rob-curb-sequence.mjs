import { previewBounds, smooth } from './rob-gesture-core.mjs';

export const SIGNALS = {
  pose_visible:'Fresh visible pose', operator_present:'Operator present',
  path_clear:'Approach clear', edge_aligned:'Aligned with the platform',
  front_contact:'Front tread contact', hold_verified:'Brake hold verified',
  rear_support:'Rear support verified', on_platform:'Both treads on the platform',
  level_verified:'Level and settled'
};
const pose=(flipper,lean=0)=>({left_flipper:flipper,right_flipper:flipper,body_lean:lean});
export const CURB_SEQUENCE={
  schemaVersion:1,simulationOnly:true,kind:'guarded_sequence',name:'Curb ascent rehearsal',
  platformHeightM:.12,timeoutSeconds:12,
  note:'Illustrative base path and provisional flipper angles. No physics or hardware authorization.',
  steps:[
    {id:'align',label:'Approach and align',seconds:8,brake:'released',driveM:.2,pose:pose(0),world:{forward:.2,height:0,pitch:0},before:['path_clear'],during:['path_clear'],after:['edge_aligned']},
    {id:'place_flippers',label:'Place the flippers toward the platform',seconds:5,brake:'hold',driveM:0,pose:pose(80),world:{forward:.2,height:0,pitch:0},before:['hold_verified'],during:['hold_verified'],after:['rear_support']},
    {id:'mount_front',label:'Advance until the front treads mount',seconds:8,brake:'released',driveM:.18,pose:pose(80,8),world:{forward:.38,height:.035,pitch:-8},before:['rear_support'],during:['rear_support','path_clear'],after:['front_contact']},
    {id:'brake',label:'Hold the treads and check for rollback',seconds:1,brake:'hold',driveM:0,pose:pose(80,8),world:{forward:.38,height:.035,pitch:-8},before:['front_contact'],during:['front_contact','hold_verified'],after:['hold_verified']},
    {id:'transfer',label:'Rotate the flippers back with brake hold',seconds:6,brake:'hold',driveM:0,pose:pose(-4,8),world:{forward:.38,height:.035,pitch:-8},before:['hold_verified'],during:['front_contact','hold_verified'],after:['rear_support']},
    {id:'advance',label:'Release, advance slowly and level',seconds:20,brake:'released',driveM:.52,pose:pose(-4,0),world:{forward:.9,height:.12,pitch:0},before:['rear_support','path_clear'],during:['rear_support','path_clear'],after:['on_platform']},
    {id:'settle',label:'Brake, settle and confirm level',seconds:4,brake:'hold',driveM:0,pose:pose(0),world:{forward:.9,height:.12,pitch:0},before:['on_platform'],during:['on_platform','hold_verified'],after:['hold_verified','level_verified']}
  ]
};
export function validateSequence(script,profile) {
  if(!script || script.schemaVersion!==1 || script.simulationOnly!==true || script.kind!=='guarded_sequence')throw Error('Use a version 1 simulation sequence.');
  if(!Array.isArray(script.steps) || script.steps.length<2 || script.steps.length>32)throw Error('Use 2–32 guarded steps.');
  if(!Number.isFinite(script.platformHeightM) || script.platformHeightM<=0 || script.platformHeightM>.25)throw Error('Preview platform height must be 0–0.25 m.');
  if(!Number.isFinite(script.timeoutSeconds) || script.timeoutSeconds<1 || script.timeoutSeconds>60)throw Error('Checkpoint timeout must be 1–60 seconds.');
  const ids=new Set(), joints=new Map(profile.joints.map(j=>[j.name,j]));
  let prior={pose:{},world:{forward:0,height:0,pitch:0}},total=0;
  for(const step of script.steps) {
    if(typeof step.id!=='string' || !/^[a-z][a-z0-9_]*$/.test(step.id) || ids.has(step.id) || typeof step.label!=='string' || !step.label.trim())throw Error('Steps need unique IDs and labels.');
    ids.add(step.id);
    if(!Number.isFinite(step.seconds) || step.seconds<.5 || step.seconds>60)throw Error('Step duration must be 0.5–60 seconds.');
    total+=step.seconds;if(total>300)throw Error('Sequence exceeds five minutes.');
    if(!['hold','released'].includes(step.brake) || !Number.isFinite(step.driveM) || step.driveM<0 || step.driveM>.6)throw Error('Invalid drive/brake state.');
    if(step.brake==='hold' && step.driveM!==0)throw Error('A held brake cannot also request drive.');
    if(1.875*step.driveM/step.seconds>.06)throw Error('Preview drive is too fast; lengthen the step.');
    if(!step.world || !['forward','height','pitch'].every(k=>Number.isFinite(step.world[k])) || step.world.height<0 || step.world.height>.4 || Math.abs(step.world.pitch)>20)throw Error('Invalid illustrative base pose.');
    if(Math.abs(step.world.forward-prior.world.forward-step.driveM)>1e-6)throw Error('Base advance must match the step distance.');
    for(const key of ['before','during','after']) if(!Array.isArray(step[key]) || !step[key].length || step[key].some(s=>!Object.hasOwn(SIGNALS,s)))throw Error('Use known confirmation signals before, during and after each step.');
    if(!step.pose || typeof step.pose!=='object' || Array.isArray(step.pose))throw Error('Missing joint pose.');
    for(const name of new Set([...Object.keys(prior.pose),...Object.keys(step.pose)])) {
      const joint=joints.get(name),value=step.pose[name]??0;
      if(!joint || !['revolute','continuous'].includes(joint.kind) || !Number.isFinite(value))throw Error('Invalid sequence joint: '+name);
      const b=previewBounds(joint,profile.previewPositions[name] || 0),change=Math.abs(value-(prior.pose[name]??0));
      if(value<b.min-1e-8 || value>b.max+1e-8 || 1.875*change/step.seconds>b.speed || 5.774*change/step.seconds**2>b.acceleration)throw Error(name+': sequence exceeds preview angle/rate limits.');
    }
    prior=step;
  }
  if(!script.steps.at(-1).after.includes('level_verified') || script.steps.at(-1).brake!=='hold')throw Error('End with brake hold and a level confirmation.');
  if(Math.abs(prior.world.height-script.platformHeightM)>1e-6 || Math.abs(prior.world.pitch)>2)throw Error('The final storyboard pose must be level at the platform height.');
  return script;
}
export class SequencePreview {
  constructor(script,profile){this.script=structuredClone(validateSequence(script,profile));this.reset();}
  reset(){this.index=0;this.elapsed=0;this.waited=0;this.phase='ready';this.fault=null;this.total=0;this.events=[];}
  get step(){return this.script.steps[this.index];}
  get required(){return this.phase==='before'?[...new Set([...this.step.before,...this.step.during,...(this.step.brake==='hold'?['hold_verified']:[])])]:this.phase==='after'?this.step.after:[];}
  start(){if(this.phase!=='ready')return;this.phase='before';this.events.push({step:this.step.id,event:'begin'});}
  abort(reason='OPERATOR_ABORT'){this.fault=reason;this.phase='aborted';this.events.push({step:this.step?.id,event:'abort',reason});}
  tick(dt,signals) {
    if(!['before','moving','after'].includes(this.phase))return;
    if(!Number.isFinite(dt) || dt<0 || dt>.25){this.abort('INVALID_CLOCK');return;}
    if(signals.pose_visible!==true){this.abort('POSE_UNCONFIRMED');return;}
    if(signals.operator_present!==true){this.abort('OPERATOR_ABSENT');return;}
    if(signals.rollback===true){this.abort('ROLLBACK_DETECTED');return;}
    if(signals.brake_failed===true){this.abort('BRAKE_HOLD_FAILED');return;}
    if(['moving','after'].includes(this.phase) && this.step.brake==='hold' && signals.hold_verified!==true){this.abort('BRAKE_HOLD_UNCONFIRMED');return;}
    if(this.phase==='moving' && this.step.driveM>0 && signals.path_clear!==true){this.abort('PATH_BLOCKED');return;}
    if(['moving','after'].includes(this.phase) && !this.step.during.every(k=>signals[k]===true)){this.abort('SUPPORT_UNCONFIRMED');return;}
    if(this.phase==='before' || this.phase==='after') {
      const needs=[...this.required,...(this.phase==='before' && this.step.brake==='hold'?['hold_verified']:[])];
      if(!needs.every(key=>signals[key]===true)){this.waited+=dt;if(this.waited>=this.script.timeoutSeconds)this.abort('CONFIRMATION_TIMEOUT');return;}
      this.waited=0;
      if(this.phase==='before'){this.phase='moving';this.events.push({step:this.step.id,event:'confirm_before'});}
      else {
        this.events.push({step:this.step.id,event:'confirm_after'});this.total+=this.step.seconds;
        if(this.index===this.script.steps.length-1){this.phase='complete';return;}
        this.index++;this.elapsed=0;this.phase='before';return;
      }
    }
    if(this.phase==='moving'){this.elapsed=Math.min(this.step.seconds,this.elapsed+dt);if(this.elapsed>=this.step.seconds)this.phase='after';}
  }
  sample(){
    const before=this.index?this.script.steps[this.index-1]:{pose:{},world:{forward:0,height:0,pitch:0}};
    const step=this.step,u=smooth(this.elapsed/step.seconds),mix=(a,b)=>a+(b-a)*u;
    const offsets=Object.fromEntries([...new Set([...Object.keys(before.pose),...Object.keys(step.pose)])].map(n=>[n,mix(before.pose[n]??0,step.pose[n]??0)]));
    const world=Object.fromEntries(['forward','height','pitch'].map(n=>[n,mix(before.world[n],step.world[n])]));
    return {offsets,world,brake:step.brake,phase:this.phase,step:step.label,required:this.required,fault:this.fault,hardwareAuthorized:false};
  }
}
