(function(window) {
    'use strict';
    window.SIMULOBJET = window.SIMULOBJET || {};
    if (typeof THREE === 'undefined') { console.error('Three.js has not been loaded.'); return; }

    class Viewer {
        constructor(container) {
            this.container = container;
            this.solidModelGroup = new THREE.Group();
            this.meshModelGroup = new THREE.Group();
            this.resultModelGroup = new THREE.Group();
            this.meshData = null;
            this.viewMode = 'solid'; // 'solid', 'mesh', 'result'
            this.axisCameraDist = 4;
            this.init();
            this.animate();
        }

        init() {
            this.scene = new THREE.Scene();
            this.camera = new THREE.PerspectiveCamera(50, this.container.clientWidth / this.container.clientHeight, 0.1, 1000);
            this.camera.position.set(150, 150, 150);
            this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            this.renderer.setPixelRatio(window.devicePixelRatio);
            this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
            this.renderer.autoClear = false;
            this.container.appendChild(this.renderer.domElement);
            this.scene.add(this.solidModelGroup);
            this.scene.add(this.meshModelGroup);
            this.scene.add(this.resultModelGroup);
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
            this.scene.add(ambientLight);
            const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
            directionalLight.position.set(1, 1, 1);
            this.scene.add(directionalLight);
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = false;
            this.clippingPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 50);
            this.renderer.clippingPlanes.push(this.clippingPlane);
            this.renderer.localClippingEnabled = false;
            this.axisScene = new THREE.Scene();
            this.axisCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
            const axisGizmo = new THREE.Group();
            const arrowLength = 1.0, textOffset = 1.2;
            axisGizmo.add(new THREE.ArrowHelper(new THREE.Vector3(1,0,0), new THREE.Vector3(0,0,0), arrowLength, 0xff0000, 0.2, 0.1));
            const xLabel = this.createAxisLabel("X", "#ff0000"); xLabel.position.set(textOffset, 0, 0); axisGizmo.add(xLabel);
            axisGizmo.add(new THREE.ArrowHelper(new THREE.Vector3(0,1,0), new THREE.Vector3(0,0,0), arrowLength, 0x00ff00, 0.2, 0.1));
            const yLabel = this.createAxisLabel("Y", "#00ff00"); yLabel.position.set(0, textOffset, 0); axisGizmo.add(yLabel);
            axisGizmo.add(new THREE.ArrowHelper(new THREE.Vector3(0,0,1), new THREE.Vector3(0,0,0), arrowLength, 0x0000ff, 0.2, 0.1));
            const zLabel = this.createAxisLabel("Z", "#0000ff"); zLabel.position.set(0, 0, textOffset); axisGizmo.add(zLabel);
            this.axisScene.add(axisGizmo);
            window.addEventListener('resize', this.handleResize.bind(this));
            this.handleResize();
        }
        
        setMeshData(meshData) {
            this.meshData = meshData;
            this.displayMeshModel();
        }

        toggleViewMode() {
            const modes = ['solid', 'mesh'];
            if (this.resultModelGroup.children.length > 0) {
                modes.push('result');
            }
            const currentIndex = modes.indexOf(this.viewMode);
            const nextIndex = (currentIndex + 1) % modes.length;
            this.setViewMode(modes[nextIndex]);
        }
        
        setViewMode(mode) {
            this.viewMode = mode;
            this.solidModelGroup.visible = (mode === 'solid');
            this.meshModelGroup.visible = (mode === 'mesh');
            this.resultModelGroup.visible = (mode === 'result');
        }

        clearGroup(group) {
            while(group.children.length > 0) group.remove(group.children[0]);
        }
        
        displaySolidModel(layersData) {
            this.clearGroup(this.solidModelGroup);
            layersData.forEach(layerData => this.addLayer(layerData));
            this.setViewMode('solid');
        }

        displayMeshModel() {
            this.clearGroup(this.meshModelGroup);
            if (!this.meshData) return;
            const { nodes, elements } = this.meshData;
            const positions = new Float32Array(nodes.flat());
            const fullGeometry = new THREE.BufferGeometry();
            fullGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            const materialCache = {};
            for (const el of elements) {
                if (el.type === 'WEDGE6') {
                    const n = el.nodes;
                    const indices = [
                        n[0], n[1], n[1], n[2], n[2], n[0], n[3], n[4],
                        n[4], n[5], n[5], n[3], n[0], n[3], n[1], n[4], n[2], n[5]
                    ];
                    const geometry = new THREE.BufferGeometry();
                    geometry.setAttribute('position', fullGeometry.getAttribute('position'));
                    geometry.setIndex(indices);
                    if (!materialCache[el.color]) materialCache[el.color] = new THREE.LineBasicMaterial({ color: el.color });
                    this.meshModelGroup.add(new THREE.LineSegments(geometry, materialCache[el.color]));
                }
            }
        }

        displaySimulationResult(meshData, temperatures) {
            this.clearGroup(this.resultModelGroup);
            const { nodes, elements } = meshData;
            const numNodes = nodes.length;
            const minTemp = Math.min(...temperatures), maxTemp = Math.max(...temperatures);
            const positions = new Float32Array(nodes.flat());
            const colors = new Float32Array(numNodes * 3);
            for (let i = 0; i < numNodes; i++) {
                const color = this.getContourColor(temperatures[i], minTemp, maxTemp);
                colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b;
            }
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            const indices = [];
            for (const el of elements) {
                if (el.type === 'WEDGE6') {
                    const n = el.nodes;
                    indices.push(n[0], n[1], n[3],  n[1], n[4], n[3], n[1], n[2], n[4], n[2], n[5], n[4],
                                  n[2], n[0], n[5],  n[0], n[3], n[5], n[0], n[2], n[1], n[3], n[4], n[5]);
                }
            }
            geometry.setIndex(indices);
            geometry.computeVertexNormals();
            const material = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide });
            const resultMesh = new THREE.Mesh(geometry, material);
            this.resultModelGroup.add(resultMesh);
        }

        addLayer(layerData) {
            const geometry = new THREE.BoxGeometry(layerData.dimensions.w, layerData.dimensions.h, layerData.dimensions.d);
            const material = new THREE.MeshStandardMaterial({
                color: layerData.color, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
                clippingPlanes: [this.clippingPlane], clipShadows: true
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(layerData.position.x, layerData.position.y, layerData.position.z);
            mesh.name = layerData.name;
            const edges = new THREE.EdgesGeometry(geometry);
            const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
            mesh.add(line);
            this.solidModelGroup.add(mesh);
        }

        getLayerNames(layersData) { return layersData.map(layer => layer.name); }
        setLayerVisibility(layerName, isVisible) {
            const layerGroup = this.solidModelGroup.children.find(c => c.name === layerName);
            if(layerGroup) layerGroup.visible = isVisible;
        }
        createAxisLabel(text, color) {
            const canvas = document.createElement('canvas');
            const size = 64;
            canvas.width = size; canvas.height = size;
            const context = canvas.getContext('2d');
            context.fillStyle = color;
            context.font = '30px Arial';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(text, size / 2, size / 2);
            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.scale.set(0.5, 0.5, 0.5);
            return sprite;
        }
        setFov(fov) {
            const newFov = parseInt(fov, 10);
            const oldMainFov = this.camera.fov;
            const oldMainDistance = this.camera.position.length();
            const FoVratio = (Math.tan(THREE.Math.degToRad(oldMainFov) / 2) / Math.tan(THREE.Math.degToRad(newFov) / 2));
            this.camera.fov = newFov;
            this.camera.position.setLength(oldMainDistance * FoVratio);
            this.camera.updateProjectionMatrix();
            const oldAxisFov = this.axisCamera.fov;
            const FoVratio2 = (Math.tan(THREE.Math.degToRad(oldAxisFov) / 2) / Math.tan(THREE.Math.degToRad(newFov) / 2)) ** 0.73;
            this.axisCameraDist = this.axisCameraDist * FoVratio2;
            this.axisCamera.fov = newFov;
            this.axisCamera.updateProjectionMatrix();
        }
        animate() {
            requestAnimationFrame(this.animate.bind(this));
            this.controls.update();
            this.renderer.clear();
            this.renderer.render(this.scene, this.camera);
            this.renderer.clearDepth();
            const axisViewportSize = 120;
            this.renderer.setViewport(10, 10, axisViewportSize, axisViewportSize);
            const quaternion = this.camera.quaternion;
            this.axisCamera.position.set(0, 0, this.axisCameraDist);
            this.axisCamera.position.applyQuaternion(quaternion);
            this.axisCamera.lookAt(0, 0, 0);
            this.renderer.render(this.axisScene, this.axisCamera);
            this.renderer.setViewport(0, 0, this.container.clientWidth, this.container.clientHeight);
        }
        handleResize() {
            const width = this.container.clientWidth;
            const height = this.container.clientHeight;
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        }
        setBackgroundColor(colorCode) { this.scene.background = new THREE.Color(colorCode); }
        enableClipping(isEnabled) { this.renderer.localClippingEnabled = isEnabled; }
        setClippingPosition(position) { this.clippingPlane.constant = position; }
        getContourColor(value, min, max) {
            if (max === min) return new THREE.Color(0x0000ff);
            const hue = (1 - (value - min) / (max - min)) * 240;
            return new THREE.Color(`hsl(${hue}, 100%, 50%)`);
        }
        createLegend(max, min) {
            const canvas = document.createElement('canvas');
            canvas.width = 30; canvas.height = 150;
            const ctx = canvas.getContext('2d');
            const gradient = ctx.createLinearGradient(0, 0, 0, 150);
            gradient.addColorStop(0, 'hsl(0, 100%, 50%)');
            gradient.addColorStop(0.5, 'hsl(120, 100%, 50%)');
            gradient.addColorStop(1, 'hsl(240, 100%, 50%)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 30, 150);
            const legendWrapper = document.createElement('div');
            legendWrapper.style.display = 'flex';
            legendWrapper.style.alignItems = 'center';
            const textDiv = document.createElement('div');
            textDiv.style.marginLeft = '10px';
            textDiv.innerHTML = `${max.toFixed(1)} °C <div style="height: 100px;"></div> ${min.toFixed(1)} °C`;
            legendWrapper.appendChild(canvas);
            legendWrapper.appendChild(textDiv);
            return legendWrapper;
        }
    }
    window.SIMULOBJET.Viewer = Viewer;
})(window);