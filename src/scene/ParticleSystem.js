import * as THREE from 'three';

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.particles = null;
        this.count = 5000; // Increased count for better visuals
        this.geometry = null;
        this.material = null;

        this.init();
    }

    init() {
        this.geometry = new THREE.BufferGeometry();
        this.initialPositions = new Float32Array(this.count * 3);
        this.targetPositions = new Float32Array(this.count * 3);
        const positions = new Float32Array(this.count * 3);
        const colors = new Float32Array(this.count * 3);

        const color = new THREE.Color();
        // Default to a very dark grey/black for contrast against white
        this.baseColor = new THREE.Color(0x222222);

        // Initialize with Sphere
        this.calculateShapePositions('sphere', this.initialPositions);
        this.calculateShapePositions('sphere', this.targetPositions);

        // Copy to current positions
        for (let i = 0; i < this.count * 3; i++) {
            positions[i] = this.initialPositions[i];
        }

        for (let i = 0; i < this.count; i++) {
            this.updateParticleColor(color, i);
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }

        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const sprite = new THREE.TextureLoader().load('https://threejs.org/examples/textures/sprites/disc.png');

        this.material = new THREE.PointsMaterial({
            size: 0.03, // Smaller, more refined particles
            vertexColors: true,
            map: sprite,
            // Normal blending works better for dark particles on white background
            blending: THREE.NormalBlending,
            depthWrite: false,
            transparent: true,
            opacity: 0.6
        });

        this.particles = new THREE.Points(this.geometry, this.material);
        this.scene.add(this.particles);
    }

    calculateShapePositions(shape, array) {
        for (let i = 0; i < this.count; i++) {
            let x, y, z;

            if (shape === 'sphere') {
                const r = 2 * Math.cbrt(Math.random());
                const theta = Math.random() * 2 * Math.PI;
                const phi = Math.acos(2 * Math.random() - 1);
                x = r * Math.sin(phi) * Math.cos(theta);
                y = r * Math.sin(phi) * Math.sin(theta);
                z = r * Math.cos(phi);
            } else if (shape === 'cube') {
                x = (Math.random() - 0.5) * 3;
                y = (Math.random() - 0.5) * 3;
                z = (Math.random() - 0.5) * 3;
            } else if (shape === 'torus') {
                const u = Math.random() * Math.PI * 2;
                const v = Math.random() * Math.PI * 2;
                const R = 1.5;
                const r = 0.5;
                x = (R + r * Math.cos(v)) * Math.cos(u);
                y = (R + r * Math.cos(v)) * Math.sin(u);
                z = r * Math.sin(v);
                // Add some volume
                x += (Math.random() - 0.5) * 0.2;
                y += (Math.random() - 0.5) * 0.2;
                z += (Math.random() - 0.5) * 0.2;
            } else { // Random Cloud
                x = (Math.random() - 0.5) * 5;
                y = (Math.random() - 0.5) * 5;
                z = (Math.random() - 0.5) * 5;
            }

            array[i * 3] = x;
            array[i * 3 + 1] = y;
            array[i * 3 + 2] = z;
        }
    }

    setShape(shape) {
        this.calculateShapePositions(shape, this.targetPositions);
    }

    setColor(hexColor) {
        this.baseColor.set(hexColor);
        const colors = this.geometry.attributes.color.array;
        const color = new THREE.Color();

        for (let i = 0; i < this.count; i++) {
            this.updateParticleColor(color, i);
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;
        }
        this.geometry.attributes.color.needsUpdate = true;
    }

    updateParticleColor(colorObj, index) {
        colorObj.copy(this.baseColor);
        // Very subtle variation
        const hsl = {};
        colorObj.getHSL(hsl);
        colorObj.setHSL(hsl.h, hsl.s, hsl.l + (Math.random() * 0.1 - 0.05));
    }

    update(time, gestureState = 1.0) {
        if (this.particles) {
            // Slow, elegant rotation
            this.particles.rotation.y = time * 0.05;
            this.particles.rotation.z = time * 0.02;

            // Breathing Effect: Sine wave for size/opacity
            // We can modify the material size slightly to simulate breathing
            const breath = Math.sin(time * 2.0) * 0.005;
            this.material.size = 0.03 + breath;

            // Morphing logic
            const positions = this.geometry.attributes.position.array;
            const lerpFactor = 0.05;

            for (let i = 0; i < this.count * 3; i++) {
                positions[i] += (this.targetPositions[i] - positions[i]) * lerpFactor;
            }
            this.geometry.attributes.position.needsUpdate = true;

            // Gesture Interaction
            const targetScale = 0.1 + (gestureState * 0.9);
            const currentScale = this.particles.scale.x;
            const newScale = currentScale + (targetScale - currentScale) * 0.1;

            this.particles.scale.set(newScale, newScale, newScale);
        }
    }
}
