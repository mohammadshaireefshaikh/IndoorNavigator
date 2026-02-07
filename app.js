// WebXR AR + Three.js hit-test placement with GLTF model and reticle.
// No visible UI except:
// - Camera background (from WebXR)
// - Browser-required AR button
// - Subtle reticle only when plane detected

import { ARButton } from 'https://unpkg.com/three@0.163.0/examples/jsm/webxr/ARButton.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.163.0/examples/jsm/loaders/GLTFLoader.js';

let camera, scene, renderer;
let reticle;
let hitTestSource = null;
let hitTestSourceRequested = false;
let xrRefSpace = null;
let gltfScene = null;

init();

function init() {
    // Scene
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(
        70,
        window.innerWidth / window.innerHeight,
        0.01,
        20
    );

    // Renderer
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

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

    // Reticle for plane indication
    const ringGeo = new THREE.RingGeometry(0.06, 0.08, 32);
    ringGeo.rotateX(-Math.PI / 2); // lie flat on horizontal surface
    const ringMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        opacity: 0.9,
        transparent: true
    });
    reticle = new THREE.Mesh(ringGeo, ringMat);
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    // Load GLTF / GLB model
    const loader = new GLTFLoader();
    loader.load(
        // Replace with your own glb/gltf URL
        'https://immersive-web.github.io/webxr-samples/media/gltf/sunflower/sunflower.gltf',
        (gltf) => {
            gltfScene = gltf.scene;
            gltfScene.traverse((obj) => {
                if (obj.isMesh) {
                    obj.castShadow = true;
                    obj.receiveShadow = true;
                }
            });
        },
        undefined,
        (error) => {
            console.error('Error loading model', error);
        }
    );

    // ARButton – handles feature detection and permission flow
    const arButton = ARButton.createButton(renderer, {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['local-floor', 'bounded-floor', 'light-estimation']
    });
    document.body.appendChild(arButton);

    renderer.xr.addEventListener('sessionstart', onSessionStart);
    renderer.xr.addEventListener('sessionend', onSessionEnd);

    // Tap to place
    window.addEventListener('pointerdown', onPointerDown, false);

    // Resize
    window.addEventListener('resize', onWindowResize, false);

    // WebXR render loop
    renderer.setAnimationLoop(render);
}

async function onSessionStart() {
    const session = renderer.xr.getSession();
    // If permission is denied or AR unsupported, this is never called:
    // that automatically prevents AR session start.

    xrRefSpace = await session.requestReferenceSpace('local');

    const viewerSpace = await session.requestReferenceSpace('viewer');
    hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
    hitTestSourceRequested = true;

    session.addEventListener('end', () => {
        hitTestSourceRequested = false;
        hitTestSource = null;
        xrRefSpace = null;
        reticle.visible = false;
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

function onPointerDown() {
    // Only place if reticle is visible and model loaded
    if (!reticle.visible || !gltfScene) return;

    const session = renderer.xr.getSession();
    if (!session) return;

    // Clone model so multiple placements are possible
    const clone = gltfScene.clone(true);

    // Use reticle matrix (from latest hit-test) for pose
    const poseMatrix = new THREE.Matrix4().fromArray(reticle.matrix.elements);
    clone.position.setFromMatrixPosition(poseMatrix);
    clone.quaternion.setFromRotationMatrix(poseMatrix);

    // Adjust scale if needed for realistic size (depends on model units)
    // clone.scale.set(1, 1, 1);

    // Simple shadow receiver under object for grounding
    const shadowGeo = new THREE.CircleGeometry(0.25, 32).rotateX(-Math.PI / 2);
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
}

function render(timestamp, frame) {
    const session = renderer.xr.getSession();

    if (session && hitTestSourceRequested && frame && xrRefSpace && hitTestSource) {
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
    }

    renderer.render(scene, camera);
}
