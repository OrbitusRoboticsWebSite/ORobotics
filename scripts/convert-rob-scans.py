#!/usr/bin/env python3
"""Convert the supplied single-mesh Scaniverse USDZs to bounded, textured GLBs.

macOS usdcat + numpy + Pillow. Originals remain unchanged. Cropping is a display
crop, not semantic segmentation; some ground/supports remain with each pose.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path
import re
import struct
import subprocess
import tempfile
import zipfile
import numpy as np
from PIL import Image


def convert(source, output):
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / 'scan.usda'
        subprocess.run(['/usr/bin/usdcat', str(source), '-o', str(path)], check=True)
        text = path.read_text()
    if text.count('def Mesh ') != 1 or 'xformOp:' in text or 'upAxis = "Y"' not in text:
        raise ValueError('Expected one untransformed Y-up mesh')
    if not re.search(r'metersPerUnit\s*=\s*1\s', text):
        raise ValueError('Expected declared meter units')
    def array(field, dtype, width):
        match = re.search(r'\b' + re.escape(field) + r'\s*=\s*\[([^\]]+)\]', text)
        if not match:
            raise ValueError('Missing '+field)
        return np.fromstring(match[1].translate(str.maketrans({'(': ' ', ')': ' ', ',': ' '})), sep=' ', dtype=dtype).reshape((-1, width))
    points = array('points', np.float32, 3)
    uv = array('primvars:st', np.float32, 2)
    indices = array('faceVertexIndices', np.uint32, 3)
    if not (array('faceVertexCounts', np.uint32, 1) == 3).all() or len(uv) != len(points):
        raise ValueError('Expected triangles and vertex UVs')
    center = np.median(points[points[:, 1] > .45], axis=0)
    keep = (np.abs(points[:, 0] - center[0]) < .64) & (np.abs(points[:, 2] - center[2]) < .68) & (points[:, 1] > .045)
    indices = indices[np.all(keep[indices], axis=1)]
    used, remap = np.unique(indices, return_inverse=True)
    remap = remap.reshape(-1)
    positions = points[used].copy(); positions[:, 0] -= center[0]; positions[:, 2] -= center[2]
    floor = float(positions[:, 1].min()); positions[:, 1] -= floor
    texcoords = uv[used].copy(); texcoords[:, 1] = 1 - texcoords[:, 1]
    with zipfile.ZipFile(source) as archive:
        texture = Image.open(io.BytesIO(archive.read('0/texgen_0.jpeg'))).convert('RGB')
        texture.thumbnail((2048, 2048), Image.Resampling.LANCZOS)
        jpeg = io.BytesIO(); texture.save(jpeg, format='JPEG', quality=86, optimize=True)
    blob = bytearray(); views = []
    def view(data, target=None):
        while len(blob) % 4: blob.append(0)
        value = {'buffer': 0, 'byteOffset': len(blob), 'byteLength': len(data)}
        if target: value['target'] = target
        views.append(value); blob.extend(data); return len(views)-1
    pos_view = view(positions.astype('<f4').tobytes(), 34962)
    uv_view = view(texcoords.astype('<f4').tobytes(), 34962)
    idx_view = view(remap.astype('<u4').tobytes(), 34963)
    image_view = view(jpeg.getvalue())
    doc = {'asset': {'version': '2.0', 'generator': 'Orbitus ROB scan display converter'},
        'extensionsUsed': ['KHR_materials_unlit'], 'scene': 0, 'scenes': [{'nodes': [0]}],
        'nodes': [{'name': source.stem, 'mesh': 0}],
        'meshes': [{'primitives': [{'attributes': {'POSITION': 0, 'TEXCOORD_0': 1}, 'indices': 2, 'material': 0}]}],
        'accessors': [
            {'bufferView': pos_view, 'componentType': 5126, 'count': len(positions), 'type': 'VEC3', 'min': positions.min(axis=0).tolist(), 'max': positions.max(axis=0).tolist()},
            {'bufferView': uv_view, 'componentType': 5126, 'count': len(texcoords), 'type': 'VEC2'},
            {'bufferView': idx_view, 'componentType': 5125, 'count': len(remap), 'type': 'SCALAR'}],
        'materials': [{'name': 'Original scan texture', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'metallicFactor': 0, 'roughnessFactor': 1}, 'extensions': {'KHR_materials_unlit': {}}}],
        'textures': [{'source': 0, 'sampler': 0}], 'samplers': [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 33071, 'wrapT': 33071}],
        'images': [{'bufferView': image_view, 'mimeType': 'image/jpeg'}],
        'buffers': [{'byteLength': len(blob)}], 'bufferViews': views}
    encoded = json.dumps(doc, separators=(',', ':')).encode(); encoded += b' ' * (-len(encoded) % 4)
    blob.extend(b'\0' * (-len(blob) % 4))
    output.write_bytes(struct.pack('<III', 0x46546c67, 2, 28 + len(encoded) + len(blob)) + struct.pack('<II', len(encoded), 0x4e4f534a) + encoded + struct.pack('<II', len(blob), 0x004e4942) + blob)
    return {'source': source.name, 'sourceSHA256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'file': output.name, 'sha256': hashlib.sha256(output.read_bytes()).hexdigest(), 'bytes': output.stat().st_size,
        'vertices': len(positions), 'triangles': len(indices), 'cropCenterXZ': [float(center[0]), float(center[2])],
        'floorOffset': floor, 'cropHalfWidthDepth': [.64, .68], 'minimumSourceY': .045,
        'textureSize': list(texture.size), 'originalUnmodified': True}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path); parser.add_argument('output', type=Path)
    args = parser.parse_args(); args.output.mkdir(parents=True, exist_ok=True)
    records = []
    for source in sorted(args.source.glob('*.usdz')):
        name = re.sub('[^a-z0-9]+', '-', source.stem.lower()).strip('-') + '.glb'
        record = convert(source, args.output / name); records.append(record)
        print(name, record['bytes'], 'bytes')
    if not records: raise ValueError('No scan files found')
    (args.output / 'scan-provenance.json').write_text(json.dumps({'date': '2026-09-15', 'note': 'Display crops retain original photographic texture. Scans are static poses and are not calibrated joint models.', 'scans': records}, indent=2)+'\n')
