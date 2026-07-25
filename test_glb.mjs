import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';

const loader = new GLTFLoader();
loader.load('file:///C:/Users/nico/Desktop/3d-anatomy/public/models/muscular.glb', (gltf) => {
    console.log('OK: loaded');
    gltf.scene.traverse(c => { if(c.isMesh) console.log('mesh:', c.name); });
}, undefined, (err) => {
    console.error('ERR:', err);
});
