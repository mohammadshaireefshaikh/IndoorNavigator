// WebXR AR + Three.js hit-test placement with GLTF model and reticle.
// Simplified version focused on AR stability

import { ARButton } from 'three/addons/webxr/ARButton.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let camera, scene, renderer;
let reticle;
let hitTestSource = null;
let hitTestSourceRequested = false;
let xrRefSpace = null;
let gltfScene = null;

console.log('🚀 WebXR AR App initializing...');

init();

function init() {
    console.log('📍 Initializing Three.js scene...');
    
    // Scene - keep it simple
    scene = new THREE.Scene();

    // Camera for AR (positioned at origin)
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );

    // Renderer - optimized for AR
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true
    });
    
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    renderer.xr.setFramebufferScaleFactor(1.0);
    
    // Disable shadow maps in AR (performance)
    renderer.shadowMap.enabled = false;
    
    document.body.appendChild(renderer.domElement);
    console.log('✅ Renderer created');

    // Minimal lighting for AR
    const light = new THREE.HemisphereLight(0xffffff, 0x000000, 1);
    scene.add(light);
    console.log('✅ Lighting added');

    // Reticle - simple white ring
    const ringGeom = new THREE.RingGeometry(0.06, 0.08, 32);
    ringGeom.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    reticle = new THREE.Mesh(ringGeom, ringMat);
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);
    console.log('✅ Reticle created');

    // Load model
    const loader = new GLTFLoader();
    loader.load(
        'https://immersive-web.github.io/webxr-samples/media/gltf/sunflower/sunflower.gltf',
        (gltf) => {
            gltfScene = gltf.scene;
            // Scale down the model for AR
            gltfScene.scale.set(0.5, 0.5, 0.5);
            console.log('✅ Model loaded and scaled');
        },
        undefined,
        (error) => {
            console.error('❌ Model load error:', error);
        }
    );

    // Create AR button
    const arButton = ARButton.createButton(renderer, {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay', 'dom-overlay-for-handheld-ar', 'light-estimation'],
        domOverlay: { root: document.body }
    });
    document.body.appendChild(arButton);
    console.log('✅ AR Button created');

    renderer.xr.addEventListener('sessionstart', onSessionStart);
    renderer.xr.addEventListener('sessionend', onSessionEnd);
    
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('resize', onWindowResize);

    // Start render loop
    renderer.setAnimationLoop((time, frame) => {
        render(time, frame);
    });
    console.log('✅ Render loop started');
}

async function onSessionStart() {
    console.log('🎯 AR Session started');
    const session = renderer.xr.getSession();
    
    try {
        // Request reference space
        xrRefSpace = await session.requestReferenceSpace('local');
        
        // Request hit test source
        const viewerSpace = await session.requestReferenceSpace('viewer');
        hitTestSource = await session.requestHitTestSource({ 
            space: viewerSpace 
        });
        hitTestSourceRequested = true;
        console.log('✅ Hit test initialized - move phone around to find surfaces');
    } catch (e) {
        console.error('❌ Hit test error:', e);
    }

    session.addEventListener('end', () => {
        hitTestSourceRequested = false;
        hitTestSource = null;
        xrRefSpace = null;
        reticle.visible = false;
        console.log('🛑 Session ended');
    });
}

function onSessionEnd() {
    reticle.visible = false;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onPointerDown(event) {
    if (!reticle.visible || !gltfScene) {
        console.log('⏭️ Cannot place - reticle visible:', reticle.visible, 'model ready:', !!gltfScene);
        return;
    }

    console.log('📍 Placing model...');

    const clone = gltfScene.clone(true);
    clone.matrix.copy(reticle.matrix);
    clone.matrixAutoUpdate = false;
    
    scene.add(clone);
    console.log('✅ Model placed');
}

function render(time, frame) {
    const session = renderer.xr.getSession();

    if (!session) {
        return;
    }

    // Check for hit test results
    if (hitTestSourceRequested && frame && xrRefSpace && hitTestSource) {
        const hitTestResults = frame.getHitTestResults(hitTestSource);

        if (hitTestResults.length > 0) {
            const hit = hitTestResults[0];
            const pose = hit.getPose(xrRefSpace);

            if (pose) {
                reticle.visible = true;
                reticle.matrix.fromArray(pose.transform.matrix);
                console.log('📍 Reticle visible - plane detected!');
            }
        } else {
            reticle.visible = false;
        }
    }

    renderer.render(scene, camera);
}
