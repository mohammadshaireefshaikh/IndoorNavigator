// Hybrid WebXR + 8th Wall AR Experience
// Automatically detects platform and uses appropriate AR system
// Android: Uses native WebXR
// iOS: Uses 8th Wall WebAR

import { ARButton } from 'three/addons/webxr/ARButton.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let camera, scene, renderer;
let reticle;
let hitTestSource = null;
let hitTestSourceRequested = false;
let xrRefSpace = null;
let gltfScene = null;

// Platform detection
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isAndroid = /Android/.test(navigator.userAgent);
const use8thWall = isIOS && window.XR8;

console.log('🚀 AR App initializing...');
console.log('📱 Platform:', isIOS ? 'iOS' : isAndroid ? 'Android' : 'Other');
console.log('🔧 Using:', use8thWall ? '8th Wall WebAR' : navigator.xr ? 'Native WebXR' : 'Fallback');

// Initialize appropriate AR system
if (use8thWall) {
    init8thWall();
} else {
    initWebXR();
}

// ============================================
// WEBXR IMPLEMENTATION (Android)
// ============================================
function initWebXR() {
    console.log('🤖 Initializing WebXR (Android)...');
    
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true
    });
    
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    renderer.xr.setFramebufferScaleFactor(1.0);
    renderer.shadowMap.enabled = false;
    document.body.appendChild(renderer.domElement);
    console.log('✅ WebXR Renderer created');
    
    setupScene();
    
    // AR Button for WebXR
    const arButton = ARButton.createButton(renderer, {
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay', 'dom-overlay-for-handheld-ar', 'light-estimation'],
        domOverlay: { root: document.body }
    });
    document.body.appendChild(arButton);
    
    renderer.xr.addEventListener('sessionstart', onWebXRSessionStart);
    renderer.xr.addEventListener('sessionend', onSessionEnd);
    
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('resize', onWindowResize);
    
    renderer.setAnimationLoop((time, frame) => {
        renderWebXR(time, frame);
    });
    console.log('✅ WebXR initialized');
}

// ============================================
// 8TH WALL IMPLEMENTATION (iOS)
// ============================================
function init8thWall() {
    console.log('🍎 Initializing 8th Wall (iOS)...');
    
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });
    
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    console.log('✅ 8th Wall Renderer created');
    
    setupScene();
    
    // 8th Wall AR setup
    XR8.addCameraPipelineModule({
        name: 'custom-ar',
        onCameraStatusChange: ({ status }) => {
            if (status === 'requesting') {
                console.log('📷 Requesting camera...');
            } else if (status === 'hasStream') {
                console.log('✅ Camera stream active');
            }
        },
        onProcessCpuResult: (result) => {
            if (result && result.pixelCounts && result.pixelCounts.length > 0) {
                reticle.visible = true;
                console.log('📍 Surface detected');
            } else {
                reticle.visible = false;
            }
        }
    });
    
    // Start AR with 8th Wall
    XR8.run({
        canvas: renderer.domElement,
        allowedDevices: ['phone']
    });
    
    // Create start button for 8th Wall
    const startBtn = document.createElement('button');
    startBtn.innerHTML = '▶️ Start AR';
    startBtn.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 12px 24px;
        background: #007AFF;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        z-index: 100;
    `;
    startBtn.onclick = () => {
        XR8.XrController.updateCameraConfig({ imageTargets: false });
        startBtn.style.display = 'none';
        console.log('🎯 8th Wall AR started');
    };
    document.body.appendChild(startBtn);
    
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('resize', onWindowResize);
    
    // Render loop for 8th Wall
    const renderLoop = () => {
        renderer.render(scene, camera);
        requestAnimationFrame(renderLoop);
    };
    renderLoop();
    
    console.log('✅ 8th Wall initialized');
}

// ============================================
// SHARED SETUP
// ============================================
function setupScene() {
    // Lighting
    const light = new THREE.HemisphereLight(0xffffff, 0x000000, 1);
    scene.add(light);
    console.log('✅ Lighting added');
    
    // Reticle
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
            gltfScene.scale.set(0.5, 0.5, 0.5);
            console.log('✅ Model loaded');
        },
        undefined,
        (error) => {
            console.error('❌ Model load error:', error);
        }
    );
}

// ============================================
// WEBXR EVENT HANDLERS
// ============================================
async function onWebXRSessionStart() {
    console.log('🎯 WebXR Session started');
    const session = renderer.xr.getSession();
    
    try {
        xrRefSpace = await session.requestReferenceSpace('local');
        const viewerSpace = await session.requestReferenceSpace('viewer');
        hitTestSource = await session.requestHitTestSource({ space: viewerSpace });
        hitTestSourceRequested = true;
        console.log('✅ Hit test initialized');
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

function onPointerDown() {
    if (!reticle.visible || !gltfScene) return;
    
    console.log('📍 Placing model...');
    
    const clone = gltfScene.clone(true);
    clone.matrix.copy(reticle.matrix);
    clone.matrixAutoUpdate = false;
    scene.add(clone);
    console.log('✅ Model placed');
}

// ============================================
// RENDER LOOPS
// ============================================
function renderWebXR(time, frame) {
    const session = renderer.xr.getSession();
    if (!session) return;
    
    if (hitTestSourceRequested && frame && xrRefSpace && hitTestSource) {
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