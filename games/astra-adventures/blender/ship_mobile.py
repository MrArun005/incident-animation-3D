# Half-size copies of the ship for phones: assets/jupiter-1k.glb (every embedded image halved, same
# geometry and materials) and assets/jupiter-vega-1k.jpg. Run after ship_export.py.
#   python blender/ship_mobile.py
import io
import json
import os
import struct

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
A = os.path.join(HERE, '..', 'assets')


def read_glb(path):
    data = open(path, 'rb').read()
    magic, version, length = struct.unpack_from('<III', data, 0)
    assert magic == 0x46546C67 and version == 2, 'not a glTF 2 binary'
    off, doc, binc = 12, None, b''
    while off < length:
        n, kind = struct.unpack_from('<II', data, off)
        chunk = data[off + 8: off + 8 + n]
        if kind == 0x4E4F534A:
            doc = json.loads(chunk.decode('utf-8'))
        elif kind == 0x004E4942:
            binc = chunk
        off += 8 + n
    return doc, binc


def write_glb(path, doc, binc):
    js = json.dumps(doc, separators=(',', ':')).encode('utf-8')
    js += b' ' * (-len(js) % 4)
    binc += b'\0' * (-len(binc) % 4)
    out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(binc))
    out += struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(binc), 0x004E4942) + binc
    open(path, 'wb').write(out)


def halve(raw, mime):
    im = Image.open(io.BytesIO(raw))
    im = im.resize((max(1, im.width // 2), max(1, im.height // 2)), Image.LANCZOS)
    buf = io.BytesIO()
    if mime == 'image/png':
        im.save(buf, 'PNG', optimize=True)
    else:
        im.convert('RGB').save(buf, 'JPEG', quality=90, optimize=True)
    return buf.getvalue()


def main():
    doc, binc = read_glb(os.path.join(A, 'jupiter.glb'))
    views = doc['bufferViews']
    image_views = {img['bufferView']: img.get('mimeType', 'image/png') for img in doc.get('images', []) if 'bufferView' in img}
    # Rebuild the binary chunk view by view, swapping each image's bytes for the halved copy.
    blob, new_views = bytearray(), []
    for i, v in enumerate(views):
        raw = binc[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']]
        if i in image_views:
            raw = halve(raw, image_views[i])
        blob += b'\0' * (-len(blob) % 4)
        nv = dict(v, byteOffset=len(blob), byteLength=len(raw))
        blob += raw
        new_views.append(nv)
    doc['bufferViews'] = new_views
    doc['buffers'][0]['byteLength'] = len(blob)
    write_glb(os.path.join(A, 'jupiter-1k.glb'), doc, bytes(blob))
    im = Image.open(os.path.join(A, 'jupiter-vega.jpg'))
    im.resize((im.width // 2, im.height // 2), Image.LANCZOS).save(os.path.join(A, 'jupiter-vega-1k.jpg'), quality=90, optimize=True)
    print('jupiter-1k.glb', os.path.getsize(os.path.join(A, 'jupiter-1k.glb')), 'bytes;', len(image_views), 'images halved')


if __name__ == '__main__':
    main()
