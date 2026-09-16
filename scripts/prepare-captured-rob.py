#!/usr/bin/env python3
"""Build display assets from reviewed PLY reconstructions, never changing originals.

Requires the sibling ROBGeometryLab extraction helper and its Open3D environment.
The runtime surface partitions are illustrative bindings, not calibrated joints.
"""
import argparse, importlib.util, json, subprocess, tempfile
from pathlib import Path
import numpy as np
import open3d as o3d

ROOT=Path(__file__).resolve().parents[1]
helper=ROOT.parent/'ROBGeometryLab/Scripts/extract-splat.py'
spec=importlib.util.spec_from_file_location('splat_export',helper); export=importlib.util.module_from_spec(spec); spec.loader.exec_module(export)

def quat_matrix(q):
 x,y,z,w=np.asarray(q)/np.linalg.norm(q)
 return np.array([[1-2*y*y-2*z*z,2*x*y-2*z*w,2*x*z+2*y*w],[2*x*y+2*z*w,1-2*x*x-2*z*z,2*y*z-2*x*w],[2*x*z-2*y*w,2*y*z+2*x*w,1-2*x*x-2*y*y]])

def compact_mesh(path, target):
 mesh=o3d.io.read_triangle_mesh(str(path))
 mesh=mesh.simplify_quadric_decimation(target)
 mesh.remove_degenerate_triangles(); mesh.remove_duplicated_triangles(); mesh.remove_unreferenced_vertices(); mesh.compute_vertex_normals()
 return mesh

def build(source, output, runtime_only=False):
 output.mkdir(parents=True,exist_ok=True)
 catalog=json.loads((ROOT.parent/'ROBGeometryLab/Datasets/2026-09-16/extracted-scan-catalog.json').read_text())['scans']
 yaw={'rob-upright':-20,'rob-chess-scene':-90,'rob-flipper-up-head-forward':-106,'rob-head-backward-flipper-lifted':-25,'rob-head-forward-flipper-lifted':-8,'rob-head-upright-flipper-lifted':-19}
 records=[]
 for scan in ([] if runtime_only else catalog):
  folder=source/scan['folder']; manifest=json.loads((folder/'manifest.json').read_text()); path=folder/(scan['stem']+'-mesh.ply')
  assert export.digest(path)==manifest['files'][path.name]['sha256']
  mesh=compact_mesh(path,240000); p=np.asarray(mesh.vertices)
  center=(p.min(0)+p.max(0))/2; center[1]=p[:,1].min()
  angle=np.deg2rad(yaw[scan['stem']]); rotation=o3d.geometry.get_rotation_matrix_from_xyz([0,angle,0])
  mesh.translate(-center); mesh.rotate(rotation,center=[0,0,0]); mesh.compute_vertex_normals()
  target=output/(scan['stem']+'.glb')
  if target.exists(): target.unlink()
  export.write_glb(mesh,target,scan['name'])
  records.append({'source':Path(manifest['sourcePath']).name,'sourceSHA256':manifest['sourceSHA256'],'reconstructedMeshSHA256':manifest['files'][path.name]['sha256'],'file':target.name,'sha256':export.digest(target),'bytes':target.stat().st_size,'vertices':len(mesh.vertices),'triangles':len(mesh.triangles),'originalUnmodified':True,'displayTranslation':(-center).tolist(),'displayYawDegrees':yaw[scan['stem']],'units':'meters assumed; not calibrated','color':'Captured SH DC vertex color; unlit linear glTF colors'})
  print(target.name,len(mesh.triangles),target.stat().st_size,flush=True)
 if runtime_only:
  records=json.loads((output/'scan-provenance.json').read_text())['scans']
 else:
  (output/'scan-provenance.json').write_text(json.dumps({'date':'2026-09-16','note':'Display meshes reconstructed from reviewed Gaussian-splat crops. Display orientation and surface partitions are not robot calibration. Full splats and editable masters remain local.','scans':records},indent=2)+'\n')
 # Preserve all animation and feature nodes from the procedural rig, replacing its
 # surfaces with captured pieces while retaining the working flippers and face LEDs.
 with tempfile.TemporaryDirectory() as temporary:
  baseline=Path(temporary)/'baseline.json'
  subprocess.run(['node',str(ROOT/'scripts/export-rob-visual.mjs'),str(baseline)],check=True,cwd=ROOT)
  document=json.loads(baseline.read_text())
 nodes={}; matrices={}
 def visit(n,parent=np.eye(4),keep=False):
  transform=np.eye(4); transform[:3,:3]=quat_matrix(n['rotation'])@np.diag(n['scale']); transform[:3,3]=n['position']; world=parent@transform
  nodes[n['name']]=n; matrices[n['name']]=world
  keep=keep or n['name']=='Base Lift Flipper Assembly' or n['name'].startswith('Face Smiley')
  if not keep: n.pop('geometry',None); n.pop('material',None)
  for child in n['children']: visit(child,world,keep)
 visit(document['root'])
 folder=source/'ROB-upright'; mesh=compact_mesh(folder/'rob-upright-mesh.ply',120000)
 # Approximate presentation frame: upright, facing -Z, centered on the drive base.
 # Align the long drive-base axis with Z; the source scan is rotated 43 degrees
 # relative to the initial display orientation. Flippers then run parallel.
 rotation=o3d.geometry.get_rotation_matrix_from_xyz([0,np.deg2rad(203),0]); mesh.rotate(rotation,center=[0,0,0])
 p=np.asarray(mesh.vertices); base=p[p[:,1]<-.62]; center=(base.min(0)+base.max(0))/2; center[1]=-1.01365
 mesh.translate(-center); mesh.scale(1.04,center=[0,0,0]); mesh.compute_vertex_normals()
 faces=np.asarray(mesh.triangles); centers=np.asarray(mesh.vertices)[faces].mean(1)
 # Retain the procedural moving flippers: discard the captured outboard folded
 # flipper surfaces instead of showing an additional fixed copy during animation.
 keep=~((abs(centers[:,0])>.255)&(centers[:,1]<.42))
 mesh.remove_triangles_by_mask(~keep); mesh.remove_unreferenced_vertices(); mesh.compute_vertex_normals()
 uv=export.texture_atlas(mesh,output/'rob-captured-colors.png')
 p=np.asarray(mesh.vertices); normals=np.asarray(mesh.vertex_normals); faces=np.asarray(mesh.triangles); centers=p[faces].mean(1)
 labels=np.full(len(faces),'Cerebro Torso',dtype=object)
 labels[centers[:,1]<.40]='Tri-Wheel Chassis'
 for side,prefix in [(-1,'Left'),(1,'Right')]:
  labels[(side*centers[:,0]>.14)&(centers[:,1]<.40)]=prefix+' Tri-Wheel Tread'
  labels[(side*centers[:,0]>.175)&(centers[:,1]>=.40)]=prefix+' Upper Arm'
 labels[(abs(centers[:,0])<.14)&(centers[:,1]>.90)]='Neck Pan'
 labels[(abs(centers[:,0])<.16)&(centers[:,1]>1.105)]='Camera Head'
 labels[(centers[:,0]>.135)&(centers[:,1]>.96)]='Captured Shoulder Laser'
 binary=bytearray(); parts=[]
 for name in sorted(set(labels)):
  selected=np.flatnonzero(labels==name); triangles=faces[selected]; n=nodes[name]; inverse=np.linalg.inv(matrices[name])
  vertices=np.c_[p[triangles].reshape(-1,3),np.ones(len(selected)*3)]@inverse.T
  norm=normals[triangles].reshape(-1,3)@matrices[name][:3,:3]; norm/=np.maximum(np.linalg.norm(norm,axis=1,keepdims=True),1e-12)
  values=np.c_[vertices[:,:3],norm,uv[selected].reshape(-1,2)].astype('<f4')
  index=len(document['geometries']); document['geometries'].append({'buffer':{'byteOffset':len(binary),'vertexCount':len(values)}}); binary.extend(values.tobytes())
  n['geometry']=index; n['material']='captured' if name in ['Neck Pan','Left Tri-Wheel Tread','Right Tri-Wheel Tread','Captured Shoulder Laser'] else 'captured-body'
  parts.append({'node':name,'triangles':len(selected),'geometry':index})
 document['materials']['captured']={'color':[1,1,1],'metalness':0,'roughness':1,'texture':'rob-captured-colors.png','unlit':True}
 document['materials']['captured-body']=dict(document['materials']['captured'])
 document['version']='2026.09.16-captured'; document['geometryBuffer']='rob-captured.bin'
 document['purpose']='Captured appearance bound to illustrative animation nodes; not calibrated kinematics'
 document['capture']={'sourceSHA256':records[0]['sourceSHA256'],'source':'ROB head upright.ply','parts':parts,'triangles':len(faces),'displayRotationYDegrees':203,'displayTranslation':(-center).tolist(),'displayScale':1.04,'binding':'Spatial display partitions; existing flippers and face LEDs retained; no physical joint calibration'}
 (output/'rob-captured.bin').write_bytes(binary)
 (output/'rob-visual.json').write_text(json.dumps(document,separators=(',',':'))+'\n')
 print('Runtime capture:',len(faces),'triangles',len(binary),'bytes',flush=True)

if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__); parser.add_argument('source',type=Path); parser.add_argument('output',type=Path); parser.add_argument('--runtime-only',action='store_true'); a=parser.parse_args(); build(a.source.resolve(),a.output.resolve(),a.runtime_only)
