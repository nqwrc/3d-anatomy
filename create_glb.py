import struct
import json

def create_glb(json_obj, binary_data=b''):
    """Create a valid GLB file from JSON and optional binary data."""
    json_str = json.dumps(json_obj, separators=(',', ':'))
    json_bytes = json_str.encode('utf-8')
    
    # Pad JSON to 4-byte alignment
    json_padding = (4 - (len(json_bytes) % 4)) % 4
    json_padded = json_bytes + b' ' * json_padding
    
    # Build GLB
    buffer = bytearray()
    
    # Header: magic(4) + version(4) + length(4)
    buffer.extend(struct.pack('<I', 0x46546C67))  # magic "glTF"
    buffer.extend(struct.pack('<I', 2))            # version
    buffer.extend(struct.pack('<I', 0))            # total length (placeholder)
    
    # JSON chunk: length(4) + type(4) + data
    buffer.extend(struct.pack('<I', len(json_padded)))  # chunk length
    buffer.extend(struct.pack('<I', 0x4E4F534A))        # chunk type "JSON"
    buffer.extend(json_padded)
    offset = 12 + 8 + len(json_padded)
    
    # Binary chunk (if any)
    if binary_data:
        bin_padding = (4 - (len(binary_data) % 4)) % 4
        bin_padded = binary_data + b'\x00' * bin_padding
        buffer.extend(struct.pack('<I', len(bin_padded)))
        buffer.extend(struct.pack('<I', 0x004E4942))  # chunk type "BIN\0"
        buffer.extend(bin_padded)
        offset += 8 + len(bin_padded)
    
    # Update total length
    struct.pack_into('<I', buffer, 8, offset)
    
    return bytes(buffer)

# Create muscular model with 10 box meshes
def create_model_json(mesh_count, positions, scales, names):
    json_obj = {
        "asset": {
            "version": "2.0",
            "generator": "z-anatomy",
            "extensionsUsed": [],
            "extensionsRequired": []
        },
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"name": "root", "children": list(range(1, mesh_count + 1))}],
        "meshes": [],
        "accessors": [],
        "bufferViews": [],
        "buffers": []
    }

    vertices = bytearray()
    indices = bytearray()

    for i in range(mesh_count):
        px, py, pz = positions[i]
        sx, sy, sz = scales[i]

        # Add mesh
        json_obj['meshes'].append({
            "name": names[i],
            "primitives": [{
                "attributes": {"POSITION": i * 2},
                "indices": i * 2 + 1,
                "mode": 4  # TRIANGLES
            }]
        })

        # Add node
        json_obj['nodes'].append({
            "name": names[i],
            "translation": [px, py, pz],
            "scale": [sx, sy, sz],
            "mesh": i
        })

        # Add accessors
        json_obj['accessors'].append({
            "bufferView": i * 2,
            "componentType": 5126,  # FLOAT
            "count": 8,
            "type": "VEC3",
            "max": [px + sx, py + sy, pz + sz],
            "min": [px - sx, py - sy, pz - sz]
        })

        json_obj['accessors'].append({
            "bufferView": i * 2 + 1,
            "componentType": 5123,  # UNSIGNED_SHORT
            "count": 36,
            "type": "SCALAR",
            "max": [35],
            "min": [0]
        })

        # Add bufferViews
        json_obj['bufferViews'].append({
            "buffer": 0,
            "byteOffset": i * 168,
            "byteLength": 96,
            "target": 34962  # ARRAY_BUFFER
        })

        json_obj['bufferViews'].append({
            "buffer": 0,
            "byteOffset": i * 168 + 96,
            "byteLength": 72,
            "target": 34963  # ELEMENT_ARRAY_BUFFER
        })

        # Generate box geometry
        box_verts = [
            [px - sx, py - sy, pz - sz],
            [px + sx, py - sy, pz - sz],
            [px + sx, py + sy, pz - sz],
            [px - sx, py + sy, pz - sz],
            [px - sx, py - sy, pz + sz],
            [px + sx, py - sy, pz + sz],
            [px + sx, py + sy, pz + sz],
            [px - sx, py + sy, pz + sz],
        ]

        for v in box_verts:
            vertices.extend(struct.pack('<fff', *v))

        # 12 triangles = 36 indices
        box_indices = [
            0, 1, 2, 0, 2, 3,  # front
            4, 5, 6, 4, 6, 7,  # back
            0, 4, 7, 0, 7, 3,  # left
            1, 5, 6, 1, 6, 2,  # right
            0, 1, 5, 0, 5, 4,  # bottom
            3, 2, 6, 3, 6, 7,  # top
        ]

        for idx in box_indices:
            indices.extend(struct.pack('<H', idx + i * 8))

    binary_data = bytes(vertices) + bytes(indices)
    json_obj["buffers"] = [{"byteLength": len(binary_data)}]

    return json_obj, binary_data

# Create muscular model
muscular_positions = [
    [15, 25, 0], [-15, 25, 0], [0, 38, 0], [0, 20, 10],
    [0, 10, -8], [0, 35, -2], [0, 5, 8], [8, 5, 5],
    [0, -20, 0], [0, -45, 0]
]
muscular_scales = [
    [3, 12, 3], [3, 12, 3], [8, 6, 6], [12, 8, 4],
    [14, 12, 4], [12, 8, 6], [4, 18, 3], [6, 18, 3],
    [4, 30, 4], [3, 25, 3]
]
muscular_names = [
    'Biceps_brachii', 'Triceps_brachii', 'Deltoid', 'Pectoralis_major',
    'Latissimus_dorsi', 'Trapezius', 'Rectus_abdominis', 'External_oblique',
    'Femur', 'Tibia'
]

muscular_json, muscular_binary = create_model_json(10, muscular_positions, muscular_scales, muscular_names)
muscular_glb = create_glb(muscular_json, muscular_binary)

with open('public/models/muscular.glb', 'wb') as f:
    f.write(muscular_glb)

print(f"Created muscular.glb: {len(muscular_glb)} bytes")

# Create skeletal model
skeletal_positions = [
    [0, 42, 0], [0, 5, 0], [0, 20, 0], [-12, 30, -4], [12, 30, -4],
    [-8, 38, 6], [8, 38, 6], [-18, 25, 0], [18, 25, 0], [-20, 5, 2],
    [20, 5, 2], [-22, 5, -2], [22, 5, -2], [0, -8, 0], [-8, -20, 0],
    [8, -20, 0], [-8, -38, 6], [8, -38, 6], [-8, -48, 0], [8, -48, 0],
    [-10, -48, 0], [10, -48, 0], [-15, -8, 0], [15, -8, 0], [-8, -65, 5], [8, -65, 5]
]
skeletal_scales = [
    [8, 8, 8], [4, 40, 4], [14, 12, 10], [6, 8, 2], [6, 8, 2],
    [10, 1, 1], [10, 1, 1], [3, 26, 3], [3, 26, 3], [2, 20, 2],
    [2, 20, 2], [2, 20, 2], [2, 20, 2], [16, 6, 10], [3, 34, 3],
    [3, 34, 3], [3, 3, 2], [3, 3, 2], [2, 30, 2], [2, 30, 2],
    [1.5, 30, 1.5], [1.5, 30, 1.5], [4, 3, 3], [4, 3, 3], [4, 2, 8], [4, 2, 8]
]
skeletal_names = [
    'Skull', 'Vertebral_column', 'Rib_cage', 'Scapula_left', 'Scapula_right',
    'Clavicle_left', 'Clavicle_right', 'Humerus_left', 'Humerus_right', 'Radius_left',
    'Radius_right', 'Ulna_left', 'Ulna_right', 'Pelvis', 'Femur_left',
    'Femur_right', 'Patella_left', 'Patella_right', 'Tibia_left', 'Tibia_right',
    'Fibula_left', 'Fibula_right', 'Hand_left', 'Hand_right', 'Foot_left', 'Foot_right'
]

skeletal_json, skeletal_binary = create_model_json(26, skeletal_positions, skeletal_scales, skeletal_names)
skeletal_glb = create_glb(skeletal_json, skeletal_binary)

with open('public/models/skeletal.glb', 'wb') as f:
    f.write(skeletal_glb)

print(f"Created skeletal.glb: {len(skeletal_glb)} bytes")
print("Done!")
