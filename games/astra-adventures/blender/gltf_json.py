# Writes a self-contained glTF JSON copy (<name>.gltf.json) beside each binary glTF in assets/: the same
# document with its buffer and images embedded as data URIs. The game loads these, because some static hosts
# (claude.ai artifacts among them) won't serve .glb. GLTFLoader reads either form.
#   python blender/gltf_json.py            (after ship_export.py / ship_mobile.py / rocks.py)
import base64
import glob
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ship_mobile import A, read_glb  # noqa: E402


def to_json(glb_path):
    doc, binc = read_glb(glb_path)
    views = doc['bufferViews']
    image_views = {img['bufferView']: i for i, img in enumerate(doc.get('images', [])) if 'bufferView' in img}
    # Images become their own data URIs; the remaining views are repacked into one buffer.
    blob, remap = bytearray(), {}
    for i, v in enumerate(views):
        raw = binc[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']]
        if i in image_views:
            img = doc['images'][image_views[i]]
            img['uri'] = f"data:{img.get('mimeType', 'image/png')};base64," + base64.b64encode(raw).decode('ascii')
            del img['bufferView']
            img.pop('mimeType', None)
            continue
        blob += b'\0' * (-len(blob) % 4)
        remap[i] = dict(v, byteOffset=len(blob))
        blob += raw
    new_index = {old: new for new, old in enumerate(sorted(remap))}
    doc['bufferViews'] = [remap[old] for old in sorted(remap)]
    for acc in doc.get('accessors', []):
        if 'bufferView' in acc:
            acc['bufferView'] = new_index[acc['bufferView']]
    doc['buffers'] = [{'byteLength': len(blob), 'uri': 'data:application/octet-stream;base64,' + base64.b64encode(bytes(blob)).decode('ascii')}]
    out = glb_path[:-4] + '.gltf.json'
    with open(out, 'w') as f:
        json.dump(doc, f, separators=(',', ':'))
    return out


if __name__ == '__main__':
    for p in sorted(glob.glob(os.path.join(A, '*.glb'))):
        out = to_json(p)
        print(os.path.basename(out), round(os.path.getsize(out) / 1e6, 2), 'MB')
