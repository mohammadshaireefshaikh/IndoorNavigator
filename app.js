// WebXR AR + Three.js hit-test placement with GLTF model and reticle.
// Works best on Android Chrome with WebXR support
// On Windows: Shows 3D scene but AR features disabled (by design)

import { ARButton } from 'three/addons/webxr/ARButton.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let camera, scene, renderer;
let reticle;
let hitTestSource = null;
let hitTestSourceRequested = false;
let xrRefSpace = null;
let gltfScene = null;

// Debug logging
console.log('🚀 WebXR AR App initializing...');
console.log('Platform:', navigator.userAgent);
console.log('WebXR supported:', !!navigator.xr);

init();

function init() {
    console.log('📍 Initializing Three.js scene...');
    
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222);

    camera = new THREE.PerspectiveCamera(
        70,
        window.innerWidth / window.innerHeight,
        0.01,
        20
    );

    // Renderer - with WebGL safety settings
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false
    });
    
    // Add error handling for WebGL
    renderer.domElement.addEventListener('webglcontextlost', (event) => {
        console.error('❌ WebGL context lost!', event);
        event.preventDefault();
    }, false);

    renderer.domElement.addEventListener('webglcontextrestored', () => {
        console.log('✅ WebGL context restored');
    }, false);

    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);
    console.log('✅ Renderer created, canvas added to page');

    // Lighting: ambient + directional for more realistic shading
    const ambientLight = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(0, 10, 0);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = 20;
    scene.add(dirLight);
    console.log('✅ Lighting added');

    // Reticle for plane indication - simpler geometry to avoid shader issues
    const ringGeo = new THREE.RingGeometry(0.06, 0.08, 32);
    ringGeo.rotateX(-Math.PI / 2); // lie flat on horizontal surface
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        opacity: 0.9,
        transparent: true,
        side: THREE.DoubleSide
    });
    reticle = new THREE.Mesh(ringGeo, ringMat);
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);
    console.log('✅ Reticle created');

    // Load GLTF / GLB model
    const loader = new GLTFLoader();
    console.log('📦 Loading 3D model from Immersive Web examples...');
    
    loader.load(
        'https://immersive-web.github.io/webxr-samples/media/gltf/sunflower/sunflower.gltf',
        (gltf) => {
            gltfScene = gltf.scene;
            gltfScene.traverse((obj) => {
                if (obj.isMesh) {
                    obj.castShadow = true;
                    obj.receiveShadow = true;
                }
            });
            console.log('✅ Model loaded successfully!');
        },
        (progress) => {
            console.log('📦 Loading progress:', (progress.loaded / progress.total * 100).toFixed(0) + '%');
        },
        (error) => {
            console.error('❌ Error loading model:', error);
        }
    );

    // ARButton – handles feature detection and permission flow
    console.log('🔘 Creating AR Button...');
    try {
        const arButton = ARButton.createButton(renderer, {
            requiredFeatures: ['hit-test'],
            optionalFeatures: ['local-floor', 'bounded-floor', 'light-estimation'],
            domOverlay: { root: document.body }
        });
        document.body.appendChild(arButton);
        console.log('✅ AR Button created successfully');
    } catch (e) {
        console.error('❌ Error creating AR button:', e);
    }
    
    if (!navigator.xr) {
        console.warn('⚠️ WebXR not supported on this device (Windows/Desktop)');
        console.warn('   AR features will be disabled');
        console.log('💡 To test AR: Use Android Chrome on a supported device');
    }

    renderer.xr.addEventListener('sessionstart', onSessionStart);
    renderer.xr.addEventListener('sessionend', onSessionEnd);

    // Tap to place
    window.addEventListener('pointerdown', onPointerDown, false);

    // Resize
    window.addEventListener('resize', onWindowResize, false);

    // WebXR render loop
    renderer.setAnimationLoop((time, frame) => {
        try {
            render(time, frame);
        } catch (e) {
            console.error('❌ Render error:', e);
        }
    });
    console.log('✅ Render loop started');
}

async function onSessionStart() {
    console.log('🎯 AR Session started!');
    const session = renderer.xr.getSession();

    try {
        xrRefSpace = await session.requestReferenceSpace('local');
        const viewerSpace = await session.requestReferenceSpace('viewer');
        hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
        hitTestSourceRequested = true;
        console.log('✅ Hit test source initialized');
    } catch (e) {
        console.error('❌ Error initializing hit test:', e);
    }

    session.addEventListener('end', () => {
        hitTestSourceRequested = false;
        hitTestSource = null;
        xrRefSpace = null;
        reticle.visible = false;
        console.log('🛑 AR Session ended');
    });
}

function onSessionEnd() {
    console.log('🔌 Session ending, hiding reticle');
    reticle.visible = false;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onPointerDown() {
    // Only place if reticle is visible and model loaded
    if (!reticle.visible || !gltfScene) {
        console.log('⏭️ Tap ignored - reticle visible:', !!reticle.visible, 'model loaded:', !!gltfScene);
        return;
    }

    const session = renderer.xr.getSession();
    if (!session) {
        console.log('⏭️ Tap ignored - no active session');
        return;
    }

    try {
        console.log('📍 Model placed at hit test location');

        // Clone model so multiple placements are possible
        const clone = gltfScene.clone(true);

        // Use reticle matrix (from latest hit-test) for pose
        const poseMatrix = new THREE.Matrix4().fromArray(reticle.matrix.elements);
        clone.position.setFromMatrixPosition(poseMatrix);
        clone.quaternion.setFromRotationMatrix(poseMatrix);

        // Adjust scale if needed for realistic size (depends on model units)
        // clone.scale.set(1, 1, 1);

        // Simple shadow receiver under object for grounding
        const shadowGeo = new THREE.CircleGeometry(0.25, 32);
        shadowGeo.rotateX(-Math.PI / 2);
        const shadowMat = new THREE.MeshPhongMaterial({
            color: 0x000000,
            opacity: 0.3,
            transparent: true
        });
        const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
        shadowMesh.receiveShadow = true;
        shadowMesh.position.set(0, 0.001, 0); // slightly above plane
        clone.add(shadowMesh);

        scene.add(clone);
        console.log('✅ Model added to scene');
    } catch (e) {
        console.error('❌ Error placing model:', e);
    }
}

function render(timestamp, frame) {
    try {
        const session = renderer.xr.getSession();

        if (session && hitTestSourceRequested && frame && xrRefSpace && hitTestSource) {
            try {
                const hitTestResults = frame.getHitTestResults(hitTestSource);

                if (hitTestResults.length > 0) {
                    const hit = hitTestResults[0];
                    const pose = hit.getPose(xrRefSpace);

                    if (pose) {
                        reticle.visible = true;
                        reticle.matrix.fromArray(pose.transform.matrix);
                    }
                } else {
                    reticle.visible = false;
                }
            } catch (e) {
                console.error('❌ Hit test error:', e);
            }
        }

        renderer.render(scene, camera);
    } catch (e) {
        console.error('❌ Render loop error:', e);
    }
}