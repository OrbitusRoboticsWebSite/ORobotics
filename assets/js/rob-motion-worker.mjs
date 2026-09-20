import { ArmClearancePreview } from './rob-arm-clearance.mjs';
let model;
self.onmessage=({data:{id,operation,payload}})=>{
  try {
    let result;
    if(operation==='init'){model=new ArmClearancePreview(payload);result={ready:true};}
    else if(!model)throw Error('Collision model is not ready.');
    else if(operation==='gesture')result=model.validateMotion(payload);
    else if(operation==='transition')result=model.validateTransition(payload.from,payload.to);
    else throw Error('Unknown motion check.');
    self.postMessage({id,result});
  } catch(error) {self.postMessage({id,error:error.message});}
};
