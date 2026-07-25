import struct, json

def create_glb(json_obj, binary_data=b''):
    json_str = json.dumps(json_obj, separators=(',', ':'))
    json_bytes = json_str.encode('utf-8')
    json_padding = (4 - (len(json_bytes) % 4)) % 4
    json_padded = json_bytes + b' ' * json_padding
    buffer = bytearray()
    buffer.extend(struct.pack('<I', 0x46546C67))
    buffer.extend(struct.pack('<I', 2))
    buffer.extend(struct.pack('<I', 0))
    buffer.extend(struct.pack('<I', len(json_padded)))
    buffer.extend(struct.pack('<I', 0x4E4F534A))
    buffer.extend(json_padded)
    offset = 12 + 8 + len(json_padded)
    if binary_data:
        bin_padding = (4 - (len(binary_data) % 4)) % 4
        bin_padded = binary_data + b'\x00' * bin_padding
        buffer.extend(struct.pack('<I', len(bin_padded)))
        buffer.extend(struct.pack('<I', 0x004E4942))
        buffer.extend(bin_padded)
        offset += 8 + len(bin_padded)
    struct.pack_into('<I', buffer, 8, offset)
    return bytes(buffer)

positions = [
    [0, 42, 0], [0, 5, 0], [0, 20, 0], [-12, 30, -4], [12, 30, -4],
    [-8, 38, 6], [8, 38, 6], [-18, 25, 0], [18, 25, 0], [-20, 5, 2],
    [20, 5, 2], [-22, 5, -2], [22, 5, -2], [0, -8, 0], [-8, -20, 0],
    [8, -20, 0], [-8, -38, 6], [8, -38, 6], [-8, -48, 0], [8, -48, 0],
    [-10, -48, 0], [10, -48, 0], [-15, -8, 0], [15, -8, 0], [-8, -65, 5], [8, -65, 5]
]
scales = [
    [8, 8, 8], [4, 40, 4], [14, 12, 10], [6, 8, 2], [6, 8, 2], [10, 1, 1], [10, 1, 1], [3, 26, 3], [3, 26, 3], [2, 20, 2], [2, 20, 2], [2, 20, 2], [2, 20, 2], [16, 6, 10], [3, 34, 3], [3, 34, 3], [3, 3, 2], [3, 3, 2], [2, 30, 2], [2, 30, 2], [1.5, 30, 1.5], [1.5, 30, 1.5], [4, 3, 3], [4, 3, 3], [4, 2, 8], [4, 2, 8]
]
names = [
    'Skull', 'Vertebral_column', 'Rib_cage', 'Scapula_left', 'Scapula_right',
    'Clavicle_left', 'Clavicle_right', 'Humerus_left', 'Humerus_right', 'Radius_left',
    'Radius_right', 'Ulna_left', 'Ulna_right', 'Pelvis', 'Femur_left',
    'Femur_right', 'Patella_left', 'Patella_right', 'Tibia_left', 'Tibia_right',
    'Fibula_left', 'Fibula_right', 'Hand_left', 'Hand_right', 'Foot_left', 'Foot_right'
]

json_obj = {
    'asset': {'version': '2.0', 'generator': 'z-anatomy'},
    'scene': 0,
    'scenes': [{'nodes': [0]}],
    'nodes': [{'name': 'skeletal', 'children': list(range(1, 27))}],
    'meshes': [],
    'accessors': [],
    'bufferViews': [],
    'buffers': []
}
vertices = bytearray()
indices = bytearray()
for i in range(26):
    px, py, pz = positions[i]
    sx, sy, sz = scales[i]
    json_obj['nodes'].append({'name': names[i], 'translation': [px, py, pz], 'scale': [sx, sy, sz], 'mesh': i})
    json_obj['meshes'].append({'name': names[i], 'primitives': [{'attributes': {'POSITION': i*3}, 'mode': 4}]})
    json_obj['accessors'].append({'bufferView': i*3, 'componentType': 5126, 'count': 8, 'type': 'VEC3', 'max': [px+sx, py+sy, pz+sz], 'min': [px-sx, py-sy, pz-sz]})
    json_obj['bufferViews'].append({'buffer': 0, 'byteOffset': i*96, 'byteLength': 96, 'target': 34962})
    json_obj['bufferViews'].append({'buffer': 0, 'byteOffset': i*96+96, 'byteLength': 36, 'target': 34963})
    box = [
        [px-sx, py-sy, pz-sz], [px+sx, py-sy, pz-sz], [px+sx, py+sy, pz-sz], [px-sx, py+sy, pz-sz],
        [px-sx, py-sy, pz+sz], [px+sx, py-sy, pz+sz], [px+sx, py+sy, pz+sz], [px-sx, py+sy, pz+sz]
    ]
    for v in box:
        vertices.extend(struct.pack('<fff', *v))
    for idx in [0,1,2,0,2,3,4,5,6,4,6,7,0,4,7,0,7,3,1,5,6,1,6,2,0,1,5,0,5,4,3,2,6,3,6,7]:
        indices.extend(struct.pack('<H', idx + i*8))
binary_data = bytes(vertices) + bytes(indices)
json_obj['buffers'] = [{'byteLength': len(binary_data)}]
glb = create_glb(json_obj, binary_data)
open('public/models/skeletal.glb', 'wb').write(glb)
print('skeletal.glb', len(glb))
