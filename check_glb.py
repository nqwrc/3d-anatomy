from pygltflib import GLTF2
import sys

def check_glb(path):
    try:
        glb = GLTF2.load(path)
        print(f"{path}: VALID GLB")
        print(f"  Asset version: {glb.asset.version if glb.asset else 'missing'}")
        print(f"  Meshes: {len(glb.meshes) if glb.meshes else 0}")
        print(f"  Nodes: {len(glb.nodes) if glb.nodes else 0}")
        print(f"  Accessors: {len(glb.accessors) if glb.accessors else 0}")
        print(f"  BufferViews: {len(glb.bufferViews) if glb.bufferViews else 0}")
        print(f"  Buffers: {len(glb.buffers) if glb.buffers else 0}")
        if glb.meshes:
            print(f"  Mesh names: {[m.name for m in glb.meshes]}")
        if glb.nodes:
            print(f"  First 5 node names: {[n.name for n in glb.nodes[:5]]}")
        return True
    except Exception as e:
        print(f"{path}: INVALID - {e}")
        return False

check_glb('public/models/muscular.glb')
check_glb('public/models/skeletal.glb')
