/**
 * Career Constellation - Three.js 3D Visualization
 * Interactive career node visualization with physics simulation
 */

(function () {
    'use strict';

    // Career data nodes
    const careerNodes = [
        // Education
        {
            id: 'usc',
            name: 'University of South Carolina',
            type: 'education',
            description: 'M.Ed. in Learning Design & Technologies. Focus on instructional systems design and adult learning theory.',
            year: '2024-2026'
        },
        {
            id: 'gatech-cs',
            name: 'Georgia Tech - Computer Science',
            type: 'education',
            description: 'M.S. in Computer Science: Interactive Intelligence. Focus on AI Ethics, HCI, Health Informatics, Cognitive Science.',
            year: '2019-2022'
        },
        {
            id: 'gatech-mba',
            name: 'Georgia Tech - MBA',
            type: 'education',
            description: 'M.B.A. in Strategic Innovation. Focus on technology strategy, product development, innovation management.',
            year: '2017-2019'
        },
        {
            id: 'iowa-state',
            name: 'Iowa State University',
            type: 'education',
            description: 'M.S. in Human-Computer Interaction. Focus on user-centered design and cognitive engineering.',
            year: '2008-2010'
        },
        {
            id: 'uf',
            name: 'University of Florida',
            type: 'education',
            description: 'M.S. in Entrepreneurship. Focus on technology commercialization and venture creation.',
            year: '2012-2014'
        },
        // Industry
        {
            id: 'aws',
            name: 'AWS Training & Certification',
            type: 'industry',
            description: 'Created ML Essentials lab series reaching 10,000+ learners, building pathways from basics to advanced cloud skills.',
            year: '2020-2022'
        },
        {
            id: '2u',
            name: '2U / Trilogy Education',
            type: 'industry',
            description: 'Used learning analytics to identify at-risk students and personalize support across 15 universities.',
            year: '2018-2020'
        },
        {
            id: 'solutions-architect',
            name: 'Solutions Architect',
            type: 'industry',
            description: 'Enterprise AI systems transforming how organizations learn and grow. Supporting clients in industry and academia.',
            year: 'Present'
        },
        // Teaching
        {
            id: 'gatech-teaching',
            name: 'Georgia Tech Instructor',
            type: 'teaching',
            description: 'Teaching at College of Lifelong Learning and Scheller College of Business since 2017. Evidence-based methods improving learning outcomes.',
            year: '2017-Present'
        },
        // Research
        {
            id: 'ai-learning',
            name: 'AI & Learning Research',
            type: 'research',
            description: 'Investigating how AI-powered environments change knowledge building, and designing learning that builds critical thinking alongside technical skill.',
            year: 'Ongoing'
        }
    ];

    // Pre-defined connection narratives (simulated GenAI responses)
    const connectionNarratives = {
        'usc|gatech-cs': {
            title: 'From Code to Curriculum',
            narrative: 'The journey from Georgia Tech\'s Computer Science program to USC\'s Learning Design program represents a profound shift in perspective. At Georgia Tech, I learned to build intelligent systems—algorithms that could process, learn, and adapt. At USC, I\'m learning to build intelligent learning experiences for humans. The AI ethics and cognitive science foundations from GT now inform how I think about designing instruction that respects learner autonomy while leveraging technology\'s power. This combination positions me to bridge the gap between what AI can do and what learners actually need.'
        },
        'usc|gatech-mba': {
            title: 'Strategy Meets Pedagogy',
            narrative: 'The MBA\'s focus on strategic innovation prepared me to think about learning design as a product—something that needs market fit, scalable delivery, and measurable outcomes. Now at USC, I\'m applying those business frameworks to educational challenges. How do we "scale" personalized learning? What\'s the "MVP" for a new training program? This business-education synthesis helps me speak both languages: the ROI metrics executives need and the learning outcomes educators pursue.'
        },
        'usc|iowa-state': {
            title: 'User-Centered Learning Design',
            narrative: 'Iowa State\'s HCI program taught me that good design starts with understanding users—their mental models, their frustrations, their contexts. At USC, this translates directly into learner-centered design. The cognitive engineering principles I studied—reducing cognitive load, supporting task performance, designing for error recovery—are precisely what instructional designers need. My HCI background means I don\'t just ask "what should learners know?" but "how do learners actually think and learn?"'
        },
        'usc|uf': {
            title: 'Entrepreneurial Education',
            narrative: 'The entrepreneurship training at UF taught me to spot opportunities and build ventures. Education is ripe for innovation—the gap between traditional instruction and what technology enables represents an enormous opportunity. My USC studies give me the pedagogical rigor to build solutions that actually work, while my entrepreneurial training pushes me to think about impact, scale, and sustainability. Together, they\'re preparing me to create educational innovations that can thrive beyond the classroom.'
        },
        'gatech-cs|gatech-mba': {
            title: 'The Technical Business Leader',
            narrative: 'Having both degrees from Georgia Tech creates a unique advantage: I can dive deep into technical architectures in morning meetings and pivot to strategic planning in the afternoon. The CS program taught me what\'s technically possible; the MBA taught me what\'s strategically viable. This combination is essential for AI product leadership, where you need to understand both the transformer architecture details and the go-to-market strategy.'
        },
        'gatech-cs|iowa-state': {
            title: 'Intelligence Meets Interaction',
            narrative: 'Iowa State\'s HCI program established my foundation in how humans and computers should work together. Georgia Tech\'s Interactive Intelligence track built on this, exploring how AI can be a partner in that interaction rather than just a tool. The progression from designing interfaces to designing intelligent agents represents the evolution of the field itself—from HCI to Human-AI Collaboration.'
        },
        'gatech-cs|uf': {
            title: 'Technical Founder Mindset',
            narrative: 'The combination of deep technical knowledge from GT\'s CS program with entrepreneurial skills from UF creates the technical founder archetype. I can prototype AI solutions myself, understand their limitations, and simultaneously evaluate market potential. This matters in AI especially—too many ventures fail because founders don\'t understand the technology, or technologists don\'t understand the market.'
        },
        'gatech-mba|iowa-state': {
            title: 'Design-Driven Strategy',
            narrative: 'Iowa State taught me to start with user needs; Georgia Tech\'s MBA taught me to align those needs with business strategy. This combination produces design-driven business thinking: strategies that don\'t just chase profits but create genuine value through superior experiences. In a world where customer experience increasingly differentiates products, this synthesis is a competitive advantage.'
        },
        'gatech-mba|uf': {
            title: 'Innovation Ecosystem Fluency',
            narrative: 'Both programs emphasized innovation, but from different angles. UF focused on creating new ventures from scratch—the entrepreneurial journey. Georgia Tech\'s MBA focused on driving innovation within large organizations—intrapreneurship and strategic transformation. Together, they provide a complete view of how innovation happens, whether you\'re a startup founder or a corporate innovation leader.'
        },
        'iowa-state|uf': {
            title: 'Design-Driven Ventures',
            narrative: 'UF taught me to launch ventures; Iowa State taught me to design products people actually want to use. This sequence matters—many startups fail not because of bad business models but because of poor product design. My HCI training ensures that any venture I pursue starts with deep user understanding and builds products that fit naturally into people\'s lives and workflows.'
        },
        'aws|2u': {
            title: 'Scaling Learning Excellence',
            narrative: 'Both AWS and 2U operate at massive scale—thousands of learners, complex logistics, high stakes. At 2U, I learned to use analytics to personalize support; at AWS, I applied those insights to build self-paced learning that scales infinitely. The progression taught me that scale and quality aren\'t opposites—with the right design, you can achieve both.'
        },
        'aws|gatech-teaching': {
            title: 'Industry Informs Academy',
            narrative: 'Teaching at Georgia Tech while creating content at AWS creates a powerful feedback loop. Industry experience brings real-world relevance to academic instruction; academic rigor improves industry training quality. Students benefit from current, practical examples; AWS content benefits from evidence-based pedagogical approaches. This bridge role—connecting industry and academia—is increasingly vital in fast-moving technical fields.'
        },
        'aws|solutions-architect': {
            title: 'From Creator to Consultant',
            narrative: 'Building training at AWS gave me deep expertise in cloud and AI technologies. As a Solutions Architect, I apply that knowledge to help organizations implement these technologies effectively. The training development experience also helps me understand how organizations can build internal capability—not just implement technology, but develop the human skills to leverage it.'
        },
        'gatech-teaching|ai-learning': {
            title: 'Research-Informed Practice',
            narrative: 'Teaching at Georgia Tech provides a living laboratory for my research interests in AI and learning. Every semester brings new observations about how students interact with AI tools, what helps and what hinders their learning. This grounds my research in real educational contexts while making my teaching more reflective and evidence-based. The combination pushes both the scholarship and the practice forward.'
        },
        'ai-learning|gatech-cs': {
            title: 'Building What I Study',
            narrative: 'The Computer Science program gave me the technical skills to build AI systems; my research focus examines how those systems affect learning. This means I can both construct AI-powered learning tools and critically analyze their impact. It\'s one thing to study AI in education; it\'s another to deeply understand the technology\'s capabilities and limitations from the inside.'
        },
        'solutions-architect|usc': {
            title: 'Designing Learning Systems',
            narrative: 'As a Solutions Architect, I help organizations implement complex technical systems. At USC, I\'m learning to design complex learning systems. The parallels are striking: both require understanding requirements, managing stakeholders, and building solutions that actually get adopted. The technical architecture skills translate directly to instructional architecture—mapping content, sequencing experiences, and designing for scale.'
        },
        '2u|gatech-teaching': {
            title: 'Analytics-Enhanced Instruction',
            narrative: '2U taught me to use data to identify struggling students before they failed. At Georgia Tech, I apply those same principles—using early warning signals to intervene, analyzing patterns to improve course design. The combination of edtech analytics expertise with direct teaching experience creates a feedback-rich practice where data informs every instructional decision.'
        },
        'aws|ai-learning': {
            title: 'Cloud-Powered Learning Research',
            narrative: 'AWS provided not just a workplace but a platform. The cloud infrastructure that powers enterprise AI can also power learning research at scale. My time at AWS taught me to think about learning technology as infrastructure—scalable, reliable, and capable of supporting complex adaptive systems. This technical fluency accelerates my ability to prototype and test AI-powered learning interventions.'
        },
        'solutions-architect|gatech-cs': {
            title: 'Theory to Production',
            narrative: 'Georgia Tech\'s CS program provided the theoretical foundations: algorithms, machine learning, system design. The Solutions Architect role applies those foundations at enterprise scale. The program taught me how AI works; the role teaches me how to make AI work in real organizations with real constraints. It\'s the difference between knowing the algorithms and deploying systems that survive contact with production.'
        },
        'solutions-architect|gatech-mba': {
            title: 'Strategic Technical Advisory',
            narrative: 'The MBA\'s strategic frameworks combine with the Solutions Architect role to create a trusted advisor position. I don\'t just recommend technical solutions; I connect them to business outcomes. Executives need someone who can translate between technical possibilities and strategic priorities—that\'s precisely what this combination enables. Technology decisions become business decisions, properly scoped and justified.'
        }
    };

    // Color schemes for different themes
    function getThemeColors() {
        const theme = document.documentElement.getAttribute('data-theme') || 'dark';
        const schemes = {
            dark: {
                education: 0x4fc3f7,
                industry: 0x81c784,
                teaching: 0xffb74d,
                research: 0xba68c8,
                line: 0x666666,
                background: 0x151716,
                particle: 0xffffff
            },
            light: {
                education: 0x0288d1,
                industry: 0x388e3c,
                teaching: 0xf57c00,
                research: 0x7b1fa2,
                line: 0xcccccc,
                background: 0xf9f9f9,
                particle: 0x333333
            },
            skiatron: {
                // High contrast dark tones against light background
                education: 0x1a1a1a,
                industry: 0x3d3d3d,
                teaching: 0x2a2a2a,
                research: 0x4f4f4f,
                line: 0x606060,
                background: 0xb8b8b0,
                particle: 0x1a1a1a
            },
            telequipment: {
                // Bright phosphor greens with more variation
                education: 0x00ff88,
                industry: 0x00dd66,
                teaching: 0x66ffbb,
                research: 0x00bb55,
                line: 0x004422,
                background: 0x0a1810,
                particle: 0x00ff88
            },
            amdek: {
                // Bright amber/orange phosphor with more variation
                education: 0xffbb00,
                industry: 0xdd9900,
                teaching: 0xffdd55,
                research: 0xbb7700,
                line: 0x553300,
                background: 0x1a0f00,
                particle: 0xffbb00
            },
            vectrex: {
                // Bright blue-white phosphor with more variation
                education: 0xbbddff,
                industry: 0x99ccff,
                teaching: 0xddeeff,
                research: 0x77aadd,
                line: 0x335577,
                background: 0x0a0a12,
                particle: 0xbbddff
            }
        };
        return schemes[theme] || schemes.dark;
    }

    // Check if current theme is a CRT/MUTHUR theme
    function isCRTTheme() {
        const theme = document.documentElement.getAttribute('data-theme') || 'dark';
        return ['skiatron', 'telequipment', 'amdek', 'vectrex'].includes(theme);
    }

    // Get enhanced opacity values for CRT themes
    function getNodeOpacities() {
        if (isCRTTheme()) {
            return {
                core: 1.0,      // Full opacity for node core
                glow: 0.7,      // Much brighter glow
                ring: 0.8       // Brighter ring
            };
        }
        return {
            core: 0.9,
            glow: 0.3,
            ring: 0.5
        };
    }

    // Three.js setup
    let scene, camera, renderer, raycaster, mouse;
    let nodeMeshes = [];
    let particleSystems = [];
    let connectionLines = [];
    let selectedNodes = [];
    let hoveredNode = null;
    let animationId;
    let rotationX = 0;
    let rotationY = 0;

    // Physics: rotation inertia
    let rotationVelocityX = 0;
    let rotationVelocityY = 0;
    const rotationDamping = 0.95; // How quickly rotation slows down
    const rotationSensitivity = 0.008;

    // Physics: node properties
    let nodePhysics = []; // Stores velocity and forces for each node

    // Drag state (needs to be accessible in animate)
    let isDragging = false;
    let isDraggingNode = false;
    let draggedNode = null;
    let draggedNodeIndex = -1;

    const container = document.getElementById('constellation-container');
    const canvas = document.getElementById('constellation-canvas');
    const tooltip = document.getElementById('node-tooltip');
    const modal = document.getElementById('narrative-modal');

    // Track initialization state for lazy loading
    let isInitialized = false;

    function init() {
        if (isInitialized) return;
        isInitialized = true;

        const colors = getThemeColors();

        // Scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(colors.background);

        // Camera (positioned further back for larger node spread)
        const aspect = container.clientWidth / container.clientHeight;
        camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
        camera.position.z = 20;

        // Renderer with WebGL2 and performance optimizations
        renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true,
            powerPreference: 'high-performance',
            stencil: false,
            depth: true
        });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Raycaster for mouse interaction
        raycaster = new THREE.Raycaster();
        mouse = new THREE.Vector2();

        // Create nodes
        createNodes();

        // Create connection lines
        createConnections();

        // Create background particles
        createBackgroundParticles();

        // Create pixelated cityscape
        createPixelatedCity();

        // Event listeners
        canvas.addEventListener('mousemove', onMouseMove);
        canvas.addEventListener('click', onClick);
        window.addEventListener('resize', onResize);

        // Add orbit-like controls (full 3-axis with inertia)
        let previousMouseX = 0;
        let previousMouseY = 0;
        let lastDragTime = 0;

        canvas.addEventListener('mousedown', (e) => {
            previousMouseX = e.clientX;
            previousMouseY = e.clientY;
            lastDragTime = Date.now();

            // Check if clicking on a node
            const rect = canvas.getBoundingClientRect();
            mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse, camera);
            const intersects = raycaster.intersectObjects(nodeMeshes);

            if (intersects.length > 0) {
                // Dragging a node
                isDraggingNode = true;
                isDragging = false;
                draggedNode = intersects[0].object;
                draggedNodeIndex = draggedNode.userData.index;
                canvas.style.cursor = 'move';
            } else {
                // Dragging the scene (rotation)
                isDragging = true;
                isDraggingNode = false;
                draggedNode = null;
                draggedNodeIndex = -1;
                // Stop current inertia when grabbing
                rotationVelocityX *= 0.5;
                rotationVelocityY *= 0.5;
                canvas.style.cursor = 'grabbing';
            }
        });

        canvas.addEventListener('mouseup', () => {
            if (isDraggingNode && draggedNodeIndex >= 0 && nodePhysics[draggedNodeIndex]) {
                // Give the node some velocity based on recent movement for a "throw" effect
                const physics = nodePhysics[draggedNodeIndex];
                physics.velocityX *= 1.5;
                physics.velocityY *= 1.5;
                physics.velocityZ *= 1.5;
            }
            isDragging = false;
            isDraggingNode = false;
            draggedNode = null;
            draggedNodeIndex = -1;
            canvas.style.cursor = hoveredNode ? 'pointer' : 'grab';
        });

        canvas.addEventListener('mouseleave', () => {
            isDragging = false;
            isDraggingNode = false;
            draggedNode = null;
            draggedNodeIndex = -1;
        });

        canvas.addEventListener('mousemove', (e) => {
            const deltaX = e.clientX - previousMouseX;
            const deltaY = e.clientY - previousMouseY;
            const now = Date.now();
            const dt = Math.max(now - lastDragTime, 1) / 16.67; // Normalize to ~60fps

            if (isDraggingNode && draggedNodeIndex >= 0 && nodePhysics[draggedNodeIndex]) {
                // Move the individual node
                const physics = nodePhysics[draggedNodeIndex];

                // Convert screen movement to 3D offset
                // Scale factor based on camera distance
                const scaleFactor = camera.position.z * 0.003;

                // Calculate movement in camera-relative coordinates
                // then transform based on current rotation
                const moveX = deltaX * scaleFactor;
                const moveY = -deltaY * scaleFactor;

                // Apply inverse rotation to get movement in local space
                const cosY = Math.cos(-rotationY);
                const sinY = Math.sin(-rotationY);
                const cosX = Math.cos(-rotationX);
                const sinX = Math.sin(-rotationX);

                // Transform screen X movement (affects local X and Z)
                const localX = moveX * cosY;
                const localZ = moveX * sinY;

                // Transform screen Y movement (affects local Y and Z based on X rotation)
                const localY = moveY * cosX;
                const localZFromY = moveY * sinX;

                // Apply to physics offset
                physics.offsetX += localX;
                physics.offsetY += localY;
                physics.offsetZ += localZ + localZFromY;

                // Also set velocity for smooth continuation
                physics.velocityX = localX * 0.5;
                physics.velocityY = localY * 0.5;
                physics.velocityZ = (localZ + localZFromY) * 0.5;

                // Expand max offset when dragging to allow more movement
                const maxDragOffset = 3.0;
                physics.offsetX = Math.max(-maxDragOffset, Math.min(maxDragOffset, physics.offsetX));
                physics.offsetY = Math.max(-maxDragOffset, Math.min(maxDragOffset, physics.offsetY));
                physics.offsetZ = Math.max(-maxDragOffset, Math.min(maxDragOffset, physics.offsetZ));

            } else if (isDragging) {
                // Rotate the scene
                // Apply rotation with velocity tracking for inertia
                rotationVelocityY = deltaX * rotationSensitivity / dt;
                rotationVelocityX = deltaY * rotationSensitivity / dt;

                rotationY += deltaX * rotationSensitivity;
                rotationX += deltaY * rotationSensitivity;
                // Clamp vertical rotation to prevent flipping
                rotationX = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, rotationX));
            }

            previousMouseX = e.clientX;
            previousMouseY = e.clientY;
            lastDragTime = now;
        });

        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            camera.position.z += e.deltaY * 0.015;
            camera.position.z = Math.max(10, Math.min(35, camera.position.z));
        });

        // Start animation
        animate();
    }

    function createNodes() {
        const colors = getThemeColors();
        const opacities = getNodeOpacities();
        const crtMode = isCRTTheme();
        nodeMeshes = [];

        // Position nodes in a 3D constellation pattern
        const positions = generateConstellationPositions(careerNodes.length);

        // Initialize physics for each node
        initializeNodePhysics(careerNodes.length);

        careerNodes.forEach((node, index) => {
            // Simplified geometry for better performance
            const nodeSize = crtMode ? 0.4 : 0.3;
            const geometry = new THREE.SphereGeometry(nodeSize, 8, 8); // Reduced segments
            const material = new THREE.MeshBasicMaterial({
                color: colors[node.type],
                transparent: true,
                opacity: opacities.core
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(positions[index]);
            mesh.userData = { ...node, basePosition: positions[index].clone(), index: index };

            // Single glow effect (removed bloom layer for performance)
            const glowSize = crtMode ? 0.6 : 0.45;
            const glowGeometry = new THREE.SphereGeometry(glowSize, 6, 6); // Reduced segments
            const glowMaterial = new THREE.MeshBasicMaterial({
                color: colors[node.type],
                transparent: true,
                opacity: crtMode ? opacities.glow * 1.3 : opacities.glow // Brighter for CRT to compensate
            });
            const glow = new THREE.Mesh(glowGeometry, glowMaterial);
            mesh.add(glow);

            // Simplified ring with fewer segments
            const ringInner = crtMode ? 0.7 : 0.5;
            const ringOuter = crtMode ? 0.78 : 0.55;
            const ringGeometry = new THREE.RingGeometry(ringInner, ringOuter, 12); // Reduced segments
            const ringMaterial = new THREE.MeshBasicMaterial({
                color: colors[node.type],
                transparent: true,
                opacity: opacities.ring,
                side: THREE.DoubleSide
            });
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.userData.phase = Math.random() * Math.PI * 2;
            mesh.add(ring);

            scene.add(mesh);
            nodeMeshes.push(mesh);
        });
    }

    function generateConstellationPositions(count) {
        const positions = [];
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));

        // Increased spread: radius 6->9, height 4->6
        for (let i = 0; i < count; i++) {
            const y = 1 - (i / (count - 1)) * 2;
            const radius = Math.sqrt(1 - y * y);
            const theta = goldenAngle * i;

            positions.push(new THREE.Vector3(
                Math.cos(theta) * radius * 9,
                y * 6,
                Math.sin(theta) * radius * 9
            ));
        }

        return positions;
    }

    function initializeNodePhysics(count) {
        nodePhysics = [];
        for (let i = 0; i < count; i++) {
            nodePhysics.push({
                // Current offset from base position
                offsetX: 0,
                offsetY: 0,
                offsetZ: 0,
                // Velocity
                velocityX: 0,
                velocityY: 0,
                velocityZ: 0,
                // Physics properties (slight variation per node)
                mass: 0.8 + Math.random() * 0.4,
                springStrength: 0.02 + Math.random() * 0.01,
                damping: 0.92 + Math.random() * 0.05,
                // Orbital wobble parameters
                wobblePhase: Math.random() * Math.PI * 2,
                wobbleSpeed: 0.3 + Math.random() * 0.4,
                wobbleAmplitude: 0.15 + Math.random() * 0.1
            });
        }
    }

    function createConnections() {
        const colors = getThemeColors();
        connectionLines = [];

        // Create lines between related nodes
        const connections = [
            [0, 1], [0, 2], [1, 2], [1, 3], [2, 4],
            [5, 6], [5, 7], [6, 8], [7, 9],
            [0, 9], [1, 9], [8, 9], [3, 8]
        ];

        connections.forEach(([i, j]) => {
            if (nodeMeshes[i] && nodeMeshes[j]) {
                const points = [
                    nodeMeshes[i].position.clone(),
                    nodeMeshes[j].position.clone()
                ];
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const material = new THREE.LineBasicMaterial({
                    color: colors.line,
                    transparent: true,
                    opacity: 0.3
                });
                const line = new THREE.Line(geometry, material);
                line.userData = { start: i, end: j };
                scene.add(line);
                connectionLines.push(line);
            }
        });
    }

    function createBackgroundParticles() {
        const colors = getThemeColors();
        // Reduced particle count for better performance
        const particleCount = 150;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 40;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 40;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 40;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: colors.particle,
            size: 0.05,
            transparent: true,
            opacity: 0.6,
            sizeAttenuation: true
        });

        const particles = new THREE.Points(geometry, material);
        scene.add(particles);
        particleSystems.push(particles);
    }

    // Pixelated cityscape variables
    let cityGroup;
    let cityBuildings = [];

    function createPixelatedCity() {
        const colors = getThemeColors();
        const theme = document.documentElement.getAttribute('data-theme') || 'dark';

        // City color scheme based on theme
        const cityColors = {
            dark: { building: 0x1a1a2e, glow: 0x4fc3f7, window: 0xffcc00 },
            light: { building: 0x2d3436, glow: 0x0984e3, window: 0xfdcb6e },
            skiatron: { building: 0x1a1a1a, glow: 0x888888, window: 0xaaaaaa },
            telequipment: { building: 0x001a0d, glow: 0x00ff88, window: 0x00ff88 },
            amdek: { building: 0x1a0f00, glow: 0xffaa00, window: 0xffaa00 },
            vectrex: { building: 0x0a0a15, glow: 0xaaddff, window: 0xaaddff }
        };

        const cColors = cityColors[theme] || cityColors.dark;

        // Remove old city if exists
        if (cityGroup) {
            scene.remove(cityGroup);
        }

        cityGroup = new THREE.Group();
        cityBuildings = [];

        // City parameters - reduced for performance
        const cityWidth = 40;
        const cityDepth = 20;
        const buildingCount = 25; // Reduced from 40
        const baseY = -8; // Position below the constellation

        // Create buildings with pixelated/blocky appearance
        for (let i = 0; i < buildingCount; i++) {
            // Randomize building dimensions (pixelated look with integer-like sizes)
            const width = Math.floor(Math.random() * 3 + 1) * 0.4;
            const depth = Math.floor(Math.random() * 3 + 1) * 0.4;
            const height = Math.floor(Math.random() * 8 + 2) * 0.5;

            // Position along the bottom edge
            const x = (Math.random() - 0.5) * cityWidth;
            const z = Math.random() * cityDepth - 5;

            // Main building geometry
            const buildingGeom = new THREE.BoxGeometry(width, height, depth);
            const buildingMat = new THREE.MeshBasicMaterial({
                color: cColors.building,
                transparent: true,
                opacity: 0.9
            });

            const building = new THREE.Mesh(buildingGeom, buildingMat);
            building.position.set(x, baseY + height / 2, z);

            // Add glowing edge lines for that CRT look
            const edges = new THREE.EdgesGeometry(buildingGeom);
            const edgeMat = new THREE.LineBasicMaterial({
                color: cColors.glow,
                transparent: true,
                opacity: 0.6
            });
            const edgeLines = new THREE.LineSegments(edges, edgeMat);
            building.add(edgeLines);

            // Add window lights (reduced for performance - only on taller buildings)
            if (height > 2) {
                const windowRows = Math.min(Math.floor(height / 0.8), 4); // Cap at 4 rows
                const windowCols = Math.min(Math.floor(width / 0.4), 3); // Cap at 3 cols

                for (let row = 0; row < windowRows; row++) {
                    for (let col = 0; col < windowCols; col++) {
                        if (Math.random() > 0.6) { // 40% chance of lit window
                            const windowGeom = new THREE.PlaneGeometry(0.1, 0.1);
                            const windowMat = new THREE.MeshBasicMaterial({
                                color: cColors.window,
                                transparent: true,
                                opacity: 0.8,
                                side: THREE.DoubleSide
                            });
                            const windowMesh = new THREE.Mesh(windowGeom, windowMat);

                            windowMesh.position.set(
                                (col - windowCols / 2) * 0.25,
                                (row - windowRows / 2) * 0.5,
                                depth / 2 + 0.01
                            );
                            // Static windows - no flickering for performance
                            building.add(windowMesh);
                        }
                    }
                }
            }

            cityGroup.add(building);
            cityBuildings.push(building);
        }

        // Add ground plane with grid lines
        const groundGeom = new THREE.PlaneGeometry(cityWidth, cityDepth, 20, 10);
        const groundMat = new THREE.MeshBasicMaterial({
            color: cColors.building,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        const ground = new THREE.Mesh(groundGeom, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set(0, baseY, cityDepth / 2 - 5);

        // Add grid lines on ground
        const gridHelper = new THREE.GridHelper(cityWidth, 40, cColors.glow, cColors.glow);
        gridHelper.position.set(0, baseY + 0.01, cityDepth / 2 - 5);
        gridHelper.material.transparent = true;
        gridHelper.material.opacity = 0.2;

        cityGroup.add(ground);
        cityGroup.add(gridHelper);

        // Add atmospheric glow at horizon
        const horizonGeom = new THREE.PlaneGeometry(cityWidth * 1.5, 4);
        const horizonMat = new THREE.MeshBasicMaterial({
            color: cColors.glow,
            transparent: true,
            opacity: 0.15,
            side: THREE.DoubleSide
        });
        const horizon = new THREE.Mesh(horizonGeom, horizonMat);
        horizon.position.set(0, baseY + 2, cityDepth - 5);

        cityGroup.add(horizon);

        scene.add(cityGroup);
    }

    function updateCityColors() {
        createPixelatedCity(); // Recreate city with new colors
    }

    function onMouseMove(event) {
        const rect = canvas.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(nodeMeshes);

        if (intersects.length > 0) {
            const node = intersects[0].object;
            if (hoveredNode !== node) {
                if (hoveredNode) {
                    hoveredNode.scale.setScalar(1);
                }
                hoveredNode = node;
                showTooltip(event, node.userData);
                canvas.style.cursor = 'pointer';

                // Highlight node
                node.scale.setScalar(1.3);
            }
            updateTooltipPosition(event);
        } else {
            if (hoveredNode) {
                hoveredNode.scale.setScalar(1);
                hoveredNode = null;
            }
            hideTooltip();
            canvas.style.cursor = 'grab';
        }
    }

    function onClick(event) {
        if (!hoveredNode) return;

        const nodeData = hoveredNode.userData;

        // Check if already selected
        const existingIndex = selectedNodes.findIndex(n => n.id === nodeData.id);

        if (existingIndex !== -1) {
            // Deselect
            selectedNodes.splice(existingIndex, 1);
            hoveredNode.children[0].material.opacity = 0.3;
        } else {
            // Select
            selectedNodes.push({ id: nodeData.id, mesh: hoveredNode });
            hoveredNode.children[0].material.opacity = 0.8;

            // If two nodes selected, show narrative
            if (selectedNodes.length === 2) {
                showNarrative(selectedNodes[0].id, selectedNodes[1].id);

                // Reset selection after showing narrative
                setTimeout(() => {
                    selectedNodes.forEach(n => {
                        if (n.mesh && n.mesh.children[0]) {
                            n.mesh.children[0].material.opacity = 0.3;
                        }
                    });
                    selectedNodes = [];
                }, 500);
            }
        }
    }

    function showTooltip(event, data) {
        tooltip.querySelector('.node-type').textContent = data.type;
        tooltip.querySelector('h3').textContent = data.name;
        tooltip.querySelector('p').textContent = `${data.year} — ${data.description}`;
        tooltip.classList.add('visible');
        updateTooltipPosition(event);
    }

    function updateTooltipPosition(event) {
        const rect = container.getBoundingClientRect();
        let x = event.clientX - rect.left + 15;
        let y = event.clientY - rect.top + 15;

        // Keep tooltip within container
        const tooltipRect = tooltip.getBoundingClientRect();
        if (x + tooltipRect.width > rect.width) {
            x = event.clientX - rect.left - tooltipRect.width - 15;
        }
        if (y + tooltipRect.height > rect.height) {
            y = event.clientY - rect.top - tooltipRect.height - 15;
        }

        tooltip.style.left = x + 'px';
        tooltip.style.top = y + 'px';
    }

    function hideTooltip() {
        tooltip.classList.remove('visible');
    }

    function showNarrative(id1, id2) {
        const key = [id1, id2].sort().join('|');
        const narrative = connectionNarratives[key];

        const modalContent = modal.querySelector('.narrative-content');
        const titleEl = modalContent.querySelector('.connection-title');
        const nodesEl = modalContent.querySelector('.connection-nodes');
        const textEl = modalContent.querySelector('.narrative-text');

        // Find node names
        const node1 = careerNodes.find(n => n.id === id1);
        const node2 = careerNodes.find(n => n.id === id2);

        nodesEl.textContent = `${node1.name} ↔ ${node2.name}`;

        if (narrative) {
            titleEl.textContent = narrative.title;

            // Simulate typing effect
            textEl.innerHTML = '<div class="generating"><span>Generating insight</span><div class="generating-dots"><span></span><span></span><span></span></div></div>';
            modal.classList.add('visible');

            setTimeout(() => {
                textEl.innerHTML = `<p>${narrative.narrative}</p>`;
            }, 1500);
        } else {
            titleEl.textContent = 'Connection Discovered';
            textEl.innerHTML = '<div class="generating"><span>Generating insight</span><div class="generating-dots"><span></span><span></span><span></span></div></div>';
            modal.classList.add('visible');

            setTimeout(() => {
                textEl.innerHTML = `<p>These two experiences—${node1.name} and ${node2.name}—represent different facets of a journey toward understanding how technology and learning intersect. Each brought unique insights that continue to inform current work and future directions.</p>`;
            }, 1500);
        }
    }

    // Close modal
    modal.querySelector('.close-modal').addEventListener('click', () => {
        modal.classList.remove('visible');
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('visible');
        }
    });

    function onResize() {
        const width = container.clientWidth;
        const height = container.clientHeight;

        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }

    // Frame rate control - target 30fps for better performance on low-end devices
    let lastFrameTime = 0;
    const targetFPS = 30;
    const frameInterval = 1000 / targetFPS;

    function animate(currentTime) {
        animationId = requestAnimationFrame(animate);

        // Handle first frame where currentTime may be undefined
        if (!currentTime) currentTime = performance.now();

        // Throttle frame rate
        if (currentTime - lastFrameTime < frameInterval) return;
        lastFrameTime = currentTime;

        const time = currentTime * 0.001;

        // Apply rotation inertia when not dragging
        if (!isDragging) {
            rotationY += rotationVelocityY;
            rotationX += rotationVelocityX;
            // Clamp vertical rotation
            rotationX = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, rotationX));
            // Apply damping
            rotationVelocityX *= rotationDamping;
            rotationVelocityY *= rotationDamping;
            // Stop tiny movements
            if (Math.abs(rotationVelocityX) < 0.0001) rotationVelocityX = 0;
            if (Math.abs(rotationVelocityY) < 0.0001) rotationVelocityY = 0;
        }

        // Calculate rotation change for physics perturbation
        const rotationSpeed = Math.abs(rotationVelocityX) + Math.abs(rotationVelocityY);

        // Animate nodes with physics
        nodeMeshes.forEach((mesh, index) => {
            const basePos = mesh.userData.basePosition;
            const physics = nodePhysics[index];

            if (physics) {
                // Check if this node is currently being dragged
                const isBeingDragged = isDraggingNode && draggedNodeIndex === index;

                if (!isBeingDragged) {
                    // Add gentle wobble force (ambient motion)
                    const wobbleForceX = Math.sin(time * physics.wobbleSpeed + physics.wobblePhase) * physics.wobbleAmplitude * 0.01;
                    const wobbleForceY = Math.cos(time * physics.wobbleSpeed * 0.7 + physics.wobblePhase) * physics.wobbleAmplitude * 0.01;
                    const wobbleForceZ = Math.sin(time * physics.wobbleSpeed * 0.5 + physics.wobblePhase + 1) * physics.wobbleAmplitude * 0.01;

                    // Add perturbation from rotation (nodes react to spinning)
                    const perturbX = rotationSpeed * (Math.random() - 0.5) * 0.5;
                    const perturbY = rotationSpeed * (Math.random() - 0.5) * 0.3;
                    const perturbZ = rotationSpeed * (Math.random() - 0.5) * 0.5;

                    // Spring force pulling back to origin (stronger when far from origin)
                    const distance = Math.sqrt(physics.offsetX ** 2 + physics.offsetY ** 2 + physics.offsetZ ** 2);
                    const springMultiplier = 1 + distance * 0.5; // Stronger spring when stretched further
                    const springForceX = -physics.offsetX * physics.springStrength * springMultiplier;
                    const springForceY = -physics.offsetY * physics.springStrength * springMultiplier;
                    const springForceZ = -physics.offsetZ * physics.springStrength * springMultiplier;

                    // Apply forces to velocity (F = ma, simplified)
                    physics.velocityX += (wobbleForceX + springForceX + perturbX) / physics.mass;
                    physics.velocityY += (wobbleForceY + springForceY + perturbY) / physics.mass;
                    physics.velocityZ += (wobbleForceZ + springForceZ + perturbZ) / physics.mass;

                    // Apply damping
                    physics.velocityX *= physics.damping;
                    physics.velocityY *= physics.damping;
                    physics.velocityZ *= physics.damping;

                    // Update offset
                    physics.offsetX += physics.velocityX;
                    physics.offsetY += physics.velocityY;
                    physics.offsetZ += physics.velocityZ;
                }

                // Clamp offset - larger range allowed for spring-back effect
                const maxOffset = isBeingDragged ? 5.0 : 3.0;
                physics.offsetX = Math.max(-maxOffset, Math.min(maxOffset, physics.offsetX));
                physics.offsetY = Math.max(-maxOffset, Math.min(maxOffset, physics.offsetY));
                physics.offsetZ = Math.max(-maxOffset, Math.min(maxOffset, physics.offsetZ));
            }

            // Get physics offset (or zero if not initialized)
            const offsetX = physics ? (physics.offsetX || 0) : 0;
            const offsetY = physics ? (physics.offsetY || 0) : 0;
            const offsetZ = physics ? (physics.offsetZ || 0) : 0;

            // Apply physics offset to base position
            const physicsX = basePos.x + offsetX;
            const physicsY = basePos.y + offsetY;
            const physicsZ = basePos.z + offsetZ;

            // Apply Y rotation (horizontal)
            let x = physicsX * Math.cos(rotationY) - physicsZ * Math.sin(rotationY);
            let z = physicsX * Math.sin(rotationY) + physicsZ * Math.cos(rotationY);
            let y = physicsY;

            // Apply X rotation (vertical)
            const newY = y * Math.cos(rotationX) - z * Math.sin(rotationX);
            const newZ = y * Math.sin(rotationX) + z * Math.cos(rotationX);

            // Guard against NaN before updating position
            if (!isNaN(x) && !isNaN(newY) && !isNaN(newZ)) {
                mesh.position.x = x;
                mesh.position.z = newZ;
                mesh.position.y = newY;
            }

            // Animate ring
            if (mesh.children[1]) {
                mesh.children[1].rotation.z = time + mesh.children[1].userData.phase;
                mesh.children[1].scale.setScalar(1 + Math.sin(time * 2 + mesh.children[1].userData.phase) * 0.1);
            }
        });

        // Update connection lines (with NaN guard)
        connectionLines.forEach(line => {
            const startNode = nodeMeshes[line.userData.start];
            const endNode = nodeMeshes[line.userData.end];
            if (!startNode || !endNode) return;

            const start = startNode.position;
            const end = endNode.position;

            // Guard against NaN values
            if (isNaN(start.x) || isNaN(end.x)) return;

            const positions = line.geometry.attributes.position.array;
            positions[0] = start.x;
            positions[1] = start.y;
            positions[2] = start.z;
            positions[3] = end.x;
            positions[4] = end.y;
            positions[5] = end.z;
            line.geometry.attributes.position.needsUpdate = true;
        });

        // Animate background particles - follow constellation rotation
        particleSystems.forEach(system => {
            system.rotation.y = rotationY + time * 0.02;
            system.rotation.x = rotationX;
        });

        // Animate city - follow constellation rotation
        if (cityGroup) {
            cityGroup.rotation.y = rotationY;
            cityGroup.rotation.x = rotationX;
        }

        renderer.render(scene, camera);
    }

    // Theme change handling
    function updateColors() {
        // Guard: don't update if scene not initialized yet
        if (!scene) return;

        const colors = getThemeColors();

        scene.background = new THREE.Color(colors.background);

        // Remove old nodes (CRT themes have different geometry/sizes)
        nodeMeshes.forEach(mesh => {
            scene.remove(mesh);
        });

        // Remove old connection lines
        connectionLines.forEach(line => {
            scene.remove(line);
        });

        // Recreate nodes with proper sizes/opacities for current theme
        createNodes();

        // Recreate connections
        createConnections();

        // Update particle colors
        particleSystems.forEach(system => {
            system.material.color.setHex(colors.particle);
        });

        // Update city colors
        updateCityColors();
    }

    // Watch for theme changes
    const themeObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'data-theme') {
                updateColors();
            }
        });
    });
    themeObserver.observe(document.documentElement, { attributes: true });

    // Lazy load: Initialize only when canvas is visible using Intersection Observer
    function setupLazyLoading() {
        if (!container) return;

        // Check if Intersection Observer is supported
        if ('IntersectionObserver' in window) {
            const lazyObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        init();
                        lazyObserver.disconnect(); // Stop observing after init
                    }
                });
            }, {
                rootMargin: '100px', // Start loading 100px before visible
                threshold: 0.01
            });
            lazyObserver.observe(container);
        } else {
            // Fallback: initialize immediately if IntersectionObserver not supported
            init();
        }
    }

    // Initialize lazy loading when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupLazyLoading);
    } else {
        setupLazyLoading();
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        cancelAnimationFrame(animationId);
        themeObserver.disconnect();
    });
})();
