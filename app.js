/**
 * ========================================================================
 * CAMERA FEED APPLICATION - VANILLA JAVASCRIPT
 * ========================================================================
 *
 * This application provides a live camera feed viewer with support for
 * rear camera on mobile devices. It includes permission handling, error
 * management, and responsive design for all screen sizes.
 *
 * ========================================================================
 * FEATURES
 * ========================================================================
 * ✅ Live real-time video feed from user's camera
 * ✅ Requests permission on page load
 * ✅ Prefers rear camera on mobile devices
 * ✅ Graceful error handling with user-friendly messages
 * ✅ Cross-browser compatibility (including fallback for older APIs)
 * ✅ Mobile responsive design
 * ✅ Placeholder for Three.js 3D model viewer integration
 * ✅ Permission management and device info
 *
 * ========================================================================
 * THREE.JS INTEGRATION GUIDE
 * ========================================================================
 *
 * To integrate a Three.js 3D model viewer:
 *
 * 1. IMPORT THREE.JS
 *    Add to your HTML before the script tag:
 *    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
 *
 * 2. CREATE CANVAS ELEMENT
 *    Replace or enhance the placeholder div with:
 *    <canvas id="threeCanvas" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></canvas>
 *
 * 3. INITIALIZE THREE.JS IN YOUR APPLICATION
 *
 *    const container = document.querySelector('.viewer-container');
 *    const canvas = document.getElementById('threeCanvas');
 *
 *    // Scene setup
 *    const scene = new THREE.Scene();
 *    const camera = new THREE.PerspectiveCamera(
 *        75,
 *        container.clientWidth / container.clientHeight,
 *        0.1,
 *        1000
 *    );
 *    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
 *    renderer.setSize(container.clientWidth, container.clientHeight);
 *    renderer.setClearColor(0x000000, 0.1); // Semi-transparent
 *
 *    // Load your 3D model (example: GLTF/GLB format)
 *    const loader = new THREE.GLTFLoader();
 *    loader.load('your-model.glb', (gltf) => {
 *        const model = gltf.scene;
 *        scene.add(model);
 *    });
 *
 *    // Add lighting
 *    const light = new THREE.DirectionalLight(0xffffff, 1);
 *    light.position.set(5, 5, 5);
 *    scene.add(light);
 *
 *    // Animation loop
 *    function animate() {
 *        requestAnimationFrame(animate);
 *        model.rotation.y += 0.01; // Auto-rotate
 *        renderer.render(scene, camera);
 *    }
 *    animate();
 *
 *    // Handle window resize
 *    window.addEventListener('resize', () => {
 *        camera.aspect = container.clientWidth / container.clientHeight;
 *        camera.updateProjectionMatrix();
 *        renderer.setSize(container.clientWidth, container.clientHeight);
 *    });
 *
 * 4. OPTIONAL: IMPLEMENT TOUCH CONTROLS FOR 3D MODEL
 *    Use OrbitControls from Three.js for interactive model viewing:
 *    <script src="https://cdn.jsdelivr.net/npm/three@r128/examples/js/controls/OrbitControls.js"></script>
 *
 *    const controls = new THREE.OrbitControls(camera, canvas);
 *    controls.autoRotate = true;
 *    controls.autoRotateSpeed = 5;
 *    Update animate loop: controls.update();
 *
 * ========================================================================
 * END THREE.JS INTEGRATION GUIDE
 * ========================================================================
 */

// ========================================================================
// STATE MANAGEMENT
// ========================================================================

const CameraApp = {
    // State variables
    mediaStream: null,
    isStreamActive: false,
    permissionStatus: 'unknown', // 'granted', 'denied', 'unknown', 'prompt'

    // DOM Elements (cached for performance)
    elements: {
        video: document.getElementById('videoElement'),
        startBtn: document.getElementById('startBtn'),
        stopBtn: document.getElementById('stopBtn'),
        permissionBtn: document.getElementById('permissionBtn'),
        statusMessage: document.getElementById('statusMessage'),
        deviceInfo: document.getElementById('deviceInfo'),
        toggleDeviceInfoBtn: document.getElementById('toggleDeviceInfoBtn'),
    },

    /**
     * Initialize the application
     * Called on page load
     */
    init() {
        console.log('🎬 Camera Application Initializing...');

        // Check browser support first
        if (!this.checkBrowserSupport()) {
            this.showStatus(
                'Your browser does not support the camera API. Please use Chrome, Firefox, Safari, or Edge.',
                'error'
            );
            this.disableControls(true);
            return;
        }

        // Bind event listeners
        this.attachEventListeners();

        // Update device information
        this.updateDeviceInfo();

        // Request camera permission on init (recommended for better UX)
        this.requestCameraPermission();

        console.log('✅ Camera Application Ready');
    },

    /**
     * Check if browser supports the MediaDevices API
     */
    checkBrowserSupport() {
        // Modern API
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            return true;
        }

        // Older browser check
        if (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia) {
            console.warn('⚠️ Using legacy camera API');
            return true;
        }

        return false;
    },

    /**
     * Attach event listeners to buttons
     */
    attachEventListeners() {
        this.elements.startBtn.addEventListener('click', () => this.startCamera());
        this.elements.stopBtn.addEventListener('click', () => this.stopCamera());
        this.elements.permissionBtn.addEventListener('click', () => this.checkPermissionStatus());
        document.getElementById('toggleDeviceInfo').addEventListener('click', () => this.toggleDeviceInfo());
    },

    /**
     * REQUEST CAMERA PERMISSION
     * This should ideally be called before starting the camera stream
     * to provide better UX with a single permission prompt
     */
    async requestCameraPermission() {
        try {
            console.log('🔐 Requesting camera permission...');

            // Attempt to get camera device info to trigger permission dialog
            // This uses minimal constraints to avoid starting an actual stream
            const constraints = {
                video: {
                    facingMode: { ideal: 'environment' }, // Prefer rear camera on mobile
                },
                audio: false, // We don't need audio
            };

            // Request access to determine permission status
            const stream = await navigator.mediaDevices.getUserMedia(constraints);

            // Stop the test stream immediately (we just wanted to trigger the dialog)
            this.stopStream(stream);

            this.permissionStatus = 'granted';
            console.log('✅ Camera permission granted');
            this.showStatus('Camera permission granted. Ready to start.', 'success');
        } catch (error) {
            this.handlePermissionError(error);
        }
    },

    /**
     * START CAMERA STREAM
     * Initiates the live video feed from the user's camera
     */
    async startCamera() {
        // Prevent duplicate streams
        if (this.isStreamActive) {
            console.warn('⚠️ Camera stream already active');
            return;
        }

        try {
            console.log('🎥 Starting camera stream...');
            this.showStatus('Starting camera...', 'info');

            // Camera constraints for optimal mobile experience
            const constraints = {
                video: {
                    facingMode: { ideal: 'environment' }, // Prefer rear camera on mobile
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    // Optional: frame rate constraint for performance
                    // frameRate: { ideal: 30 }
                },
                audio: false, // Audio not needed for viewing
            };

            // Request media stream
            this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

            // Bind stream to video element
            this.elements.video.srcObject = this.mediaStream;

            // Wait for video to load before playing
            this.elements.video.onloadedmetadata = () => {
                this.elements.video.play()
                    .then(() => {
                        this.isStreamActive = true;
                        this.updateUI();
                        console.log('✅ Camera stream started successfully');
                        this.showStatus(
                            `✅ Camera active | Resolution: ${this.elements.video.videoWidth}x${this.elements.video.videoHeight}`,
                            'success'
                        );
                    })
                    .catch((playError) => {
                        console.error('❌ Playback error:', playError);
                        this.showStatus('Failed to play video stream', 'error');
                    });
            };

            // Handle loading error
            this.elements.video.onerror = (error) => {
                console.error('❌ Video element error:', error);
                this.showStatus('Error loading video feed', 'error');
            };
        } catch (error) {
            console.error('❌ Error starting camera:', error);
            this.handleStreamError(error);
        }
    },

    /**
     * STOP CAMERA STREAM
     * Safely stops the video stream and releases camera resources
     */
    stopCamera() {
        if (!this.isStreamActive) {
            console.warn('⚠️ No active camera stream to stop');
            return;
        }

        try {
            console.log('⏹️ Stopping camera stream...');
            this.stopStream(this.mediaStream);
            this.elements.video.srcObject = null;
            this.mediaStream = null;
            this.isStreamActive = false;
            this.updateUI();
            this.showStatus('Camera stopped', 'info');
            console.log('✅ Camera stream stopped');
        } catch (error) {
            console.error('❌ Error stopping camera:', error);
            this.showStatus('Error stopping camera', 'error');
        }
    },

    /**
     * Helper: Stop all tracks in a media stream
     */
    stopStream(stream) {
        if (!stream) return;

        stream.getTracks().forEach((track) => {
            console.log(`📍 Stopping ${track.kind} track...`);
            track.stop();
        });
    },

    /**
     * HANDLE STREAM ERRORS
     * Provides user-friendly error messages for different failure scenarios
     */
    handleStreamError(error) {
        let errorMessage = 'An error occurred while accessing the camera.';

        // Error handling based on error name
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            errorMessage = '🚫 Camera permission denied. Please enable camera access in your browser settings.';
            this.permissionStatus = 'denied';
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            errorMessage = '📷 No camera device found. Please connect a camera.';
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            errorMessage = '⚠️ Camera is in use by another application. Please close it and try again.';
        } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintError') {
            errorMessage = '⚙️ Camera does not support the requested settings. Trying with default settings...';
            this.startCameraWithFallback();
            return;
        } else if (error.name === 'TypeError') {
            errorMessage = '❌ Camera configuration error. Please refresh the page.';
        } else if (error.name === 'AbortError') {
            errorMessage = 'Camera request was aborted.';
        } else {
            errorMessage = `❌ Error: ${error.message || error.name}`;
        }

        console.error('Camera Error:', error);
        this.showStatus(errorMessage, 'error');
        this.updateUI();
    },

    /**
     * HANDLE PERMISSION ERRORS
     */
    handlePermissionError(error) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            this.permissionStatus = 'denied';
            this.showStatus('🚫 Camera permission was denied. Click "Check Permissions" to enable.', 'warning');
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            this.showStatus('📷 No camera device found on this device.', 'warning');
        } else {
            console.log('Permission request handled:', error.name);
        }
    },

    /**
     * FALLBACK: Start camera with minimal constraints
     * Used when device doesn't support requested constraints
     */
    async startCameraWithFallback() {
        try {
            console.log('🔄 Attempting fallback camera setup...');
            const fallbackConstraints = {
                video: true, // Accept any video stream
                audio: false,
            };

            this.mediaStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
            this.elements.video.srcObject = this.mediaStream;
            this.isStreamActive = true;
            this.updateUI();
            this.showStatus('✅ Camera active (fallback mode)', 'info');
        } catch (fallbackError) {
            console.error('❌ Fallback failed:', fallbackError);
            this.handleStreamError(fallbackError);
        }
    },

    /**
     * CHECK CURRENT PERMISSION STATUS
     * Uses Permissions API (supported in most modern browsers)
     */
    async checkPermissionStatus() {
        try {
            console.log('🔍 Checking camera permission status...');

            // Permissions API (Chrome, Edge, newer Safari)
            if (navigator.permissions && navigator.permissions.query) {
                const result = await navigator.permissions.query({ name: 'camera' });
                console.log('📊 Permission status:', result.state);

                switch (result.state) {
                    case 'granted':
                        this.showStatus('✅ Camera access is granted', 'success');
                        break;
                    case 'denied':
                        this.showStatus(
                            '🚫 Camera access is denied. Enable in browser settings.',
                            'error'
                        );
                        break;
                    case 'prompt':
                        this.showStatus('❓ Camera permission not yet requested', 'info');
                        break;
                }
            } else {
                // Fallback for browsers without Permissions API (Firefox)
                this.showStatus('Permissions API not available in this browser', 'info');
            }
        } catch (error) {
            console.error('Error checking permissions:', error);
            this.showStatus('Could not determine permission status', 'warning');
        }
    },

    /**
     * UPDATE UI BUTTON STATES
     * Enable/disable buttons based on stream status
     */
    updateUI() {
        const isActive = this.isStreamActive;
        this.elements.startBtn.disabled = isActive;
        this.elements.stopBtn.disabled = !isActive;
    },

    /**
     * UPDATE DEVICE INFORMATION DISPLAY
     */
    updateDeviceInfo() {
        // Browser info
        const userAgent = navigator.userAgent;
        let browser = 'Unknown';

        if (userAgent.indexOf('Firefox') > -1) browser = 'Firefox';
        else if (userAgent.indexOf('Chrome') > -1) browser = 'Chrome';
        else if (userAgent.indexOf('Safari') > -1) browser = 'Safari';
        else if (userAgent.indexOf('Edge') > -1) browser = 'Edge';

        document.getElementById('browserInfo').textContent = browser;

        // Platform info
        const platform =
            navigator.userAgentData?.platform ||
            (navigator.platform === 'MacIntel' ? 'Mac' :
            navigator.platform === 'Linux' ? 'Linux' :
            navigator.platform.includes('Win') ? 'Windows' : 'Unknown');

        document.getElementById('platformInfo').textContent =
            /iPhone|iPad|iPod/.test(userAgent) ? 'iOS' :
            /Android/.test(userAgent) ? 'Android' :
            platform;

        // Viewport info
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        document.getElementById('viewportInfo').textContent =
            `${viewportWidth}x${viewportHeight} (${window.devicePixelRatio}x DPI)`;

        // Enumerate devices to count cameras
        this.enumerateDevices();
    },

    /**
     * ENUMERATE AVAILABLE MEDIA DEVICES
     * Lists all connected cameras
     */
    async enumerateDevices() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter((device) => device.kind === 'videoinput');
            document.getElementById('cameraCount').textContent = `${videoDevices.length}`;
            console.log(`📷 Found ${videoDevices.length} camera(s):`);
            videoDevices.forEach((device, index) => {
                console.log(`  ${index + 1}. ${device.label || `Camera ${index + 1}`}`);
            });
        } catch (error) {
            console.error('Error enumerating devices:', error);
            document.getElementById('cameraCount').textContent = 'N/A';
        }
    },

    /**
     * TOGGLE DEVICE INFO VISIBILITY
     */
    toggleDeviceInfo() {
        this.elements.deviceInfo.classList.toggle('show');
        const btn = document.getElementById('toggleDeviceInfo');
        btn.textContent = this.elements.deviceInfo.classList.contains('show')
            ? 'Hide Device Info'
            : 'Show Device Info';
    },

    /**
     * DISABLE CONTROLS (when not supported)
     */
    disableControls(disabled) {
        this.elements.startBtn.disabled = disabled;
        this.elements.stopBtn.disabled = disabled;
        this.elements.permissionBtn.disabled = disabled;
    },

    /**
     * SHOW STATUS MESSAGE
     * Displays user-friendly messages with automatic timeout
     */
    showStatus(message, type = 'info') {
        const statusEl = this.elements.statusMessage;
        statusEl.textContent = message;
        statusEl.className = `status-message show ${type}`;

        // Auto-hide after 5 seconds for non-error messages
        if (type !== 'error') {
            setTimeout(() => {
                statusEl.classList.remove('show');
            }, 5000);
        }
    },
};

// ========================================================================
// LIFECYCLE - Initialize application when DOM is ready
// ========================================================================

// Wait for DOM to fully load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        CameraApp.init();
    });
} else {
    // DOM already loaded
    CameraApp.init();
}

// Clean up camera stream when page is being unloaded
window.addEventListener('beforeunload', () => {
    if (CameraApp.isStreamActive) {
        CameraApp.stopCamera();
    }
});

// Also handle tab visibility changes (pause/resume based on tab focus)
document.addEventListener('visibilitychange', () => {
    if (document.hidden && CameraApp.isStreamActive) {
        console.log('📍 Page hidden - stopping camera');
        CameraApp.stopCamera();
    }
});

// ========================================================================
// END OF CAMERA APPLICATION
// ========================================================================
