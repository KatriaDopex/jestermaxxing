// Neural Network Visualization Engine
class NeuralVisualization {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.nodes = new Map();
        this.traces = [];
        this.particles = [];
        this.connections = new Map(); // Persistent connections between nodes that have transacted
        this.ammNode = null;
        this.audioContext = null;
        this.soundEnabled = false;
        this.hoveredNode = null;
        this.mouseX = 0;
        this.mouseY = 0;
        this.maxBalance = 0;
        this.pulseTime = 0;

        this.colors = {
            purple: '#a855f7',
            gold: '#fbbf24',
            red: '#ef4444',
            green: '#22c55e',
            cyan: '#06b6d4',
            blue: '#3b82f6',
            background: '#0a0a12'
        };

        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.setupMouseEvents();
        this.initAudio();
        this.animate();
    }

    setupMouseEvents() {
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
            this.checkHover();
        });

        this.canvas.addEventListener('click', (e) => {
            if (!this.soundEnabled && this.audioContext) {
                this.audioContext.resume();
                this.soundEnabled = true;
            }

            if (this.hoveredNode && !this.hoveredNode.isAMM) {
                window.open(`https://solscan.io/account/${this.hoveredNode.id}`, '_blank');
            }
        });

        this.canvas.style.cursor = 'default';
    }

    checkHover() {
        let found = null;
        this.nodes.forEach(node => {
            const dx = this.mouseX - node.x;
            const dy = this.mouseY - node.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < node.radius + 5) found = node;
        });
        this.hoveredNode = found;
        this.canvas.style.cursor = found && !found.isAMM ? 'pointer' : 'default';
    }

    initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const resumeAudio = () => {
                if (this.audioContext && this.audioContext.state === 'suspended') {
                    this.audioContext.resume().then(() => {
                        this.soundEnabled = true;
                    });
                } else {
                    this.soundEnabled = true;
                }
            };
            document.addEventListener('click', resumeAudio, { once: true });
            document.addEventListener('touchstart', resumeAudio, { once: true });
        } catch (e) {
            console.error('Audio init error:', e);
        }
    }

    playTransactionSound(amount = 1, type = 'transfer') {
        if (!this.audioContext) return;
        if (this.audioContext.state === 'suspended') this.audioContext.resume();

        try {
            const ctx = this.audioContext;
            const now = ctx.currentTime;

            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gainNode = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            osc1.connect(filter);
            osc2.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(ctx.destination);

            filter.type = 'bandpass';
            filter.frequency.value = 2000;
            filter.Q.value = 3;

            const baseFreq = 300 + Math.min(amount, 10000) / 15;

            osc1.type = 'square';
            osc2.type = 'sawtooth';

            if (type === 'buy') {
                osc1.frequency.setValueAtTime(baseFreq, now);
                osc1.frequency.exponentialRampToValueAtTime(baseFreq * 2.5, now + 0.08);
                osc2.frequency.setValueAtTime(baseFreq * 1.5, now);
                osc2.frequency.exponentialRampToValueAtTime(baseFreq * 3.5, now + 0.08);
            } else if (type === 'sell') {
                osc1.frequency.setValueAtTime(baseFreq * 2, now);
                osc1.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, now + 0.1);
                osc2.frequency.setValueAtTime(baseFreq * 2.5, now);
                osc2.frequency.exponentialRampToValueAtTime(baseFreq * 0.8, now + 0.1);
            } else {
                osc1.frequency.setValueAtTime(baseFreq, now);
                osc1.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.06);
                osc2.frequency.setValueAtTime(baseFreq * 1.2, now);
                osc2.frequency.exponentialRampToValueAtTime(baseFreq * 1.8, now + 0.06);
            }

            const volume = Math.min(0.2, 0.08 + Math.log10(amount + 1) / 30);
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(volume, now + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

            osc1.start(now);
            osc2.start(now);
            osc1.stop(now + 0.2);
            osc2.stop(now + 0.2);
        } catch (e) {
            console.error('Audio error:', e);
        }
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;

        if (this.ammNode) {
            this.ammNode.x = this.centerX;
            this.ammNode.y = this.centerY;
            this.ammNode.targetX = this.centerX;
            this.ammNode.targetY = this.centerY;
        }

        this.repositionHolderNodes();
    }

    repositionHolderNodes() {
        const holderNodes = Array.from(this.nodes.values()).filter(n => n.isHolder && !n.isAMM);
        holderNodes.forEach((node, index) => {
            const pos = this.getHolderPosition(index, holderNodes.length);
            node.targetX = pos.x;
            node.targetY = pos.y;
        });
    }

    getHolderPosition(index, total) {
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));
        const angle = index * goldenAngle;

        const margin = 100;
        const maxRadius = Math.min(this.canvas.width, this.canvas.height) / 2 - margin;
        const minRadius = 150; // Increased from 120 to keep nodes away from center

        const t = (index + 1) / (total + 1);
        const radius = minRadius + (maxRadius - minRadius) * Math.sqrt(t);

        // Reduced jitter to prevent overlapping
        const jitter = 8;
        const jitterX = Math.sin(index * 7.3) * jitter;
        const jitterY = Math.cos(index * 11.7) * jitter;

        return {
            x: this.centerX + Math.cos(angle) * radius + jitterX,
            y: this.centerY + Math.sin(angle) * radius + jitterY
        };
    }

    getNodeRadius(balance, isAMM = false) {
        if (isAMM) return 60;
        if (!this.maxBalance || this.maxBalance === 0) return 14;

        const ratio = balance / this.maxBalance;
        const minRadius = 10;
        const maxRadius = 32; // Reduced from 40 to prevent overlapping

        return minRadius + (maxRadius - minRadius) * Math.sqrt(Math.min(1, ratio));
    }

    // Create a unique key for a connection between two nodes
    getConnectionKey(id1, id2) {
        return [id1, id2].sort().join('_');
    }

    // Add or update a connection between two nodes
    addConnection(fromId, toId, type) {
        const key = this.getConnectionKey(fromId, toId);
        const existing = this.connections.get(key);

        if (existing) {
            existing.count++;
            existing.lastActive = Date.now();
            existing.strength = Math.min(1, existing.strength + 0.1);
        } else {
            this.connections.set(key, {
                from: fromId,
                to: toId,
                count: 1,
                type: type,
                strength: 0.3,
                lastActive: Date.now()
            });
        }
    }

    loadHolders(holders) {
        console.log(`Loading ${holders.length} holders`);

        // Sort by balance descending to ensure #1 is the largest holder
        const sortedHolders = [...holders].sort((a, b) => (b.balance || 0) - (a.balance || 0));

        // #1 holder (largest balance) is ALWAYS the center node
        const topHolder = sortedHolders[0];
        const otherHolders = sortedHolders.slice(1);

        // Get max balance excluding top holder for scaling
        this.maxBalance = otherHolders.length > 0 ? Math.max(...otherHolders.map(h => h.balance || 0)) : 1;

        // Create center node for #1 holder
        if (topHolder) {
            this.ammNode = {
                id: topHolder.address,
                x: this.centerX,
                y: this.centerY,
                targetX: this.centerX,
                targetY: this.centerY,
                vx: 0,
                vy: 0,
                radius: 60,
                baseRadius: 60,
                color: this.colors.gold,
                alpha: 1,
                pulsePhase: 0,
                lastActive: Date.now(),
                activity: 0,
                isHolder: true,
                isAMM: true,
                rank: 1,
                balance: topHolder.balance,
                label: '#1'
            };
            this.nodes.set(topHolder.address, this.ammNode);
            console.log(`Center node (#1): ${topHolder.address}, balance: ${topHolder.balance}`);
        }

        // Create nodes for other holders (ranks 2-30)
        otherHolders.forEach((holder, index) => {
            const pos = this.getHolderPosition(index, otherHolders.length);
            const radius = this.getNodeRadius(holder.balance, false);
            const rank = index + 2; // Ranks 2, 3, 4, etc.

            // Color scheme based on rank
            const color = rank <= 5 ? this.colors.gold :
                         rank <= 10 ? this.colors.purple :
                         rank <= 20 ? this.colors.cyan : this.colors.blue;

            const node = {
                id: holder.address,
                x: this.centerX + (Math.random() - 0.5) * 100,
                y: this.centerY + (Math.random() - 0.5) * 100,
                targetX: pos.x,
                targetY: pos.y,
                vx: 0,
                vy: 0,
                radius: radius,
                baseRadius: radius,
                color: color,
                alpha: 1,
                pulsePhase: Math.random() * Math.PI * 2,
                lastActive: Date.now(),
                activity: 0,
                isHolder: true,
                isAMM: false,
                rank: rank,
                balance: holder.balance,
                label: `#${rank}`
            };

            this.nodes.set(holder.address, node);
        });

        console.log(`Created ${this.nodes.size} nodes (1 center + ${otherHolders.length} orbiting)`);
    }

    getOrCreateNode(address, balance = null, maxBalance = null) {
        if (this.nodes.has(address)) {
            const node = this.nodes.get(address);
            node.lastActive = Date.now();
            node.activity++;
            node.radius = Math.min(node.baseRadius * 1.5, node.baseRadius + 10);
            return node;
        }

        const angle = Math.random() * Math.PI * 2;
        const distance = Math.min(this.canvas.width, this.canvas.height) / 2 - 60;
        const x = this.centerX + Math.cos(angle) * distance;
        const y = this.centerY + Math.sin(angle) * distance;

        let radius = 14;
        if (balance !== null && maxBalance && maxBalance > 0) {
            const ratio = balance / maxBalance;
            radius = 10 + (30 - 10) * Math.sqrt(Math.min(1, ratio));
        }

        const node = {
            id: address,
            x: x,
            y: y,
            targetX: x,
            targetY: y,
            vx: (Math.random() - 0.5) * 0.2,
            vy: (Math.random() - 0.5) * 0.2,
            radius: radius,
            baseRadius: radius,
            color: this.colors.green,
            alpha: 1,
            pulsePhase: Math.random() * Math.PI * 2,
            lastActive: Date.now(),
            activity: 1,
            isHolder: false,
            isAMM: false,
            rank: null,
            balance: balance,
            label: address.slice(0, 4) + '..' + address.slice(-3)
        };

        this.nodes.set(address, node);
        return node;
    }

    addTransaction(tx) {
        const fromNode = this.getOrCreateNode(tx.from, null, tx.maxBalance);
        const toNode = this.getOrCreateNode(tx.to, tx.receiverBalance, tx.maxBalance);

        if (!toNode.isHolder && tx.receiverBalance) {
            toNode.balance = tx.receiverBalance;
            if (tx.maxBalance && tx.maxBalance > 0) {
                const ratio = tx.receiverBalance / tx.maxBalance;
                const newRadius = 10 + (30 - 10) * Math.sqrt(Math.min(1, ratio));
                toNode.baseRadius = newRadius;
                toNode.radius = newRadius * 1.4;
            }
        }

        if (tx.type === 'buy' && !tx.toIsHolder) {
            toNode.color = this.colors.green;
        } else if (tx.type === 'sell' && !tx.fromIsHolder) {
            fromNode.color = this.colors.red;
        }

        // Add persistent connection
        this.addConnection(tx.from, tx.to, tx.type);

        this.createTrace(fromNode, toNode, tx.amount, tx.type);
        this.createBurst(toNode.x, toNode.y, tx.type);
        this.playTransactionSound(tx.amount, tx.type);
    }

    createTrace(fromNode, toNode, amount = 1, type = 'transfer') {
        const color = type === 'buy' ? this.colors.green :
                      type === 'sell' ? this.colors.red : this.colors.purple;

        const intensity = Math.min(1, Math.log10(amount + 1) / 5);

        const trace = {
            from: fromNode,
            to: toNode,
            progress: 0,
            speed: 0.03 + Math.random() * 0.02,
            color: color,
            intensity: 0.7 + intensity * 0.3,
            width: 2 + intensity * 3,
            particles: []
        };

        const particleCount = 5 + Math.floor(intensity * 8);
        for (let i = 0; i < particleCount; i++) {
            trace.particles.push({
                offset: i / particleCount,
                size: 2 + Math.random() * 2,
                speed: 0.8 + Math.random() * 0.3
            });
        }

        this.traces.push(trace);
    }

    createBurst(x, y, type) {
        const color = type === 'buy' ? this.colors.green :
                      type === 'sell' ? this.colors.red : this.colors.purple;

        for (let i = 0; i < 10; i++) {
            const angle = (i / 10) * Math.PI * 2;
            const speed = 2 + Math.random() * 2;
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: 1.5 + Math.random() * 1.5,
                color,
                alpha: 0.8,
                decay: 0.025 + Math.random() * 0.02
            });
        }
    }

    update() {
        const now = Date.now();
        this.pulseTime += 0.015;

        this.nodes.forEach((node, id) => {
            // AMM node is ALWAYS locked to center
            if (node.isAMM) {
                node.x = this.centerX;
                node.y = this.centerY;
                node.targetX = this.centerX;
                node.targetY = this.centerY;
                return; // Skip all other updates for AMM
            }

            const dx = node.targetX - node.x;
            const dy = node.targetY - node.y;
            node.x += dx * 0.05;
            node.y += dy * 0.05;

            node.x += node.vx || 0;
            node.y += node.vy || 0;
            if (node.vx) node.vx *= 0.99;
            if (node.vy) node.vy *= 0.99;

            node.pulsePhase += 0.025;

            if (node.radius > node.baseRadius) {
                node.radius = node.baseRadius + (node.radius - node.baseRadius) * 0.92;
            }

            if (!node.isHolder && !node.isAMM) {
                const timeSinceActive = now - node.lastActive;
                if (timeSinceActive > 120000) {
                    node.alpha = Math.max(0.2, 1 - (timeSinceActive - 120000) / 120000);
                }
                if (timeSinceActive > 360000 && node.alpha < 0.25) {
                    this.nodes.delete(id);
                }
            }
        });

        // Fade connections over time
        this.connections.forEach((conn, key) => {
            const timeSinceActive = now - conn.lastActive;
            if (timeSinceActive > 300000) {
                conn.strength *= 0.999;
            }
            if (conn.strength < 0.05) {
                this.connections.delete(key);
            }
        });

        this.traces = this.traces.filter(trace => {
            trace.progress += trace.speed;
            trace.particles.forEach(p => {
                p.offset += trace.speed * p.speed;
                if (p.offset > 1) p.offset -= 1;
            });
            return trace.progress < 1.4;
        });

        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.95;
            p.vy *= 0.95;
            p.alpha -= p.decay;
            return p.alpha > 0;
        });
    }

    draw() {
        // Dark background
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Subtle grid pattern for neural network feel
        this.drawGrid();

        // Draw persistent connections (neural network synapses)
        this.drawConnections();

        // Draw faint lines from AMM to all holders
        this.drawAMMConnections();

        // Draw active traces
        this.drawTraces();

        // Draw nodes
        this.drawNodes();

        // Draw burst particles
        this.drawParticles();

        // Draw tooltip
        if (this.hoveredNode && !this.hoveredNode.isAMM) {
            this.drawTooltip(this.hoveredNode);
        }
    }

    drawGrid() {
        const gridSize = 60;
        const pulse = Math.sin(this.pulseTime * 0.5) * 0.3 + 0.7;

        this.ctx.strokeStyle = `rgba(100, 100, 150, ${0.03 * pulse})`;
        this.ctx.lineWidth = 0.5;

        for (let x = 0; x < this.canvas.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }

        for (let y = 0; y < this.canvas.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }

        // Center glow - subtle ambient glow around the center area
        const gradient = this.ctx.createRadialGradient(
            this.centerX, this.centerY, 100,
            this.centerX, this.centerY, 350
        );
        gradient.addColorStop(0, 'rgba(168, 85, 247, 0.06)');
        gradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.02)');
        gradient.addColorStop(1, 'transparent');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawConnections() {
        this.connections.forEach(conn => {
            const fromNode = this.nodes.get(conn.from);
            const toNode = this.nodes.get(conn.to);

            if (!fromNode || !toNode) return;
            if (fromNode.isAMM || toNode.isAMM) return; // Skip AMM connections here

            const pulse = Math.sin(this.pulseTime * 2 + conn.count) * 0.3 + 0.7;
            const alpha = conn.strength * pulse * 0.4;

            // Draw connection line
            this.ctx.beginPath();
            this.ctx.moveTo(fromNode.x, fromNode.y);
            this.ctx.lineTo(toNode.x, toNode.y);

            const color = conn.type === 'buy' ? this.colors.green :
                         conn.type === 'sell' ? this.colors.red : this.colors.purple;

            this.ctx.strokeStyle = color;
            this.ctx.globalAlpha = alpha;
            this.ctx.lineWidth = 1 + conn.strength;
            this.ctx.stroke();

            // Draw small dots along the connection
            const dotCount = Math.min(3, conn.count);
            for (let i = 0; i < dotCount; i++) {
                const t = (i + 1) / (dotCount + 1);
                const dotX = fromNode.x + (toNode.x - fromNode.x) * t;
                const dotY = fromNode.y + (toNode.y - fromNode.y) * t;

                this.ctx.beginPath();
                this.ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
                this.ctx.fillStyle = color;
                this.ctx.globalAlpha = alpha * 1.5;
                this.ctx.fill();
            }
        });
        this.ctx.globalAlpha = 1;
    }

    drawAMMConnections() {
        if (!this.ammNode) return;

        const pulse = Math.sin(this.pulseTime) * 0.3 + 0.7;
        const gifRadius = 65; // Start lines at edge of GIF

        this.nodes.forEach(node => {
            if (node.isAMM) return;
            if (node.alpha < 0.5) return;

            // Calculate direction from center to node
            const dx = node.x - this.centerX;
            const dy = node.y - this.centerY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < gifRadius) return; // Skip if node is inside GIF area

            // Start point at edge of GIF
            const startX = this.centerX + (dx / dist) * gifRadius;
            const startY = this.centerY + (dy / dist) * gifRadius;

            // Very subtle lines from GIF edge to all nodes
            this.ctx.beginPath();
            this.ctx.moveTo(startX, startY);
            this.ctx.lineTo(node.x, node.y);
            this.ctx.strokeStyle = node.color;
            this.ctx.globalAlpha = 0.06 * pulse * node.alpha;
            this.ctx.lineWidth = 0.5;
            this.ctx.stroke();
        });
        this.ctx.globalAlpha = 1;
    }

    drawTraces() {
        const gifRadius = 65;

        this.traces.forEach(trace => {
            const progress = Math.min(1, trace.progress);
            const fadeOut = trace.progress > 1 ? 1 - (trace.progress - 1) * 2.5 : 1;

            // Calculate actual start and end points (adjust for GIF if AMM node)
            let startX = trace.from.x;
            let startY = trace.from.y;
            let endX = trace.to.x;
            let endY = trace.to.y;

            // If from node is AMM, start from GIF edge
            if (trace.from.isAMM) {
                const dx = trace.to.x - this.centerX;
                const dy = trace.to.y - this.centerY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 0) {
                    startX = this.centerX + (dx / dist) * gifRadius;
                    startY = this.centerY + (dy / dist) * gifRadius;
                }
            }

            // If to node is AMM, end at GIF edge
            if (trace.to.isAMM) {
                const dx = trace.from.x - this.centerX;
                const dy = trace.from.y - this.centerY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 0) {
                    endX = this.centerX + (dx / dist) * gifRadius;
                    endY = this.centerY + (dy / dist) * gifRadius;
                }
            }

            // Draw trace line
            this.ctx.beginPath();
            this.ctx.moveTo(startX, startY);
            const currentX = startX + (endX - startX) * progress;
            const currentY = startY + (endY - startY) * progress;
            this.ctx.lineTo(currentX, currentY);
            this.ctx.strokeStyle = trace.color;
            this.ctx.lineWidth = trace.width;
            this.ctx.globalAlpha = trace.intensity * fadeOut;
            this.ctx.stroke();

            // Glow effect
            this.ctx.lineWidth = trace.width * 2;
            this.ctx.globalAlpha = trace.intensity * fadeOut * 0.3;
            this.ctx.stroke();

            // Draw particles
            trace.particles.forEach(p => {
                if (p.offset <= progress) {
                    const px = startX + (endX - startX) * p.offset;
                    const py = startY + (endY - startY) * p.offset;

                    this.ctx.beginPath();
                    this.ctx.arc(px, py, p.size, 0, Math.PI * 2);
                    this.ctx.fillStyle = '#fff';
                    this.ctx.globalAlpha = trace.intensity * fadeOut;
                    this.ctx.fill();
                }
            });
        });
        this.ctx.globalAlpha = 1;
    }

    drawCenterNode() {
        // Draw the #1 holder as a special pulsing node at center
        const pulse = Math.sin(this.pulseTime * 2) * 0.1 + 1;
        const radius = 60 * pulse;

        // Large outer glow
        const outerGlow = this.ctx.createRadialGradient(
            this.centerX, this.centerY, radius * 0.5,
            this.centerX, this.centerY, radius * 2.5
        );
        outerGlow.addColorStop(0, 'rgba(251, 191, 36, 0.4)');
        outerGlow.addColorStop(0.5, 'rgba(168, 85, 247, 0.2)');
        outerGlow.addColorStop(1, 'transparent');
        this.ctx.fillStyle = outerGlow;
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, radius * 2.5, 0, Math.PI * 2);
        this.ctx.fill();

        // Outer glow rings
        for (let i = 3; i >= 0; i--) {
            const glowRadius = radius + i * 12;
            const alpha = 0.25 - i * 0.05;
            this.ctx.beginPath();
            this.ctx.arc(this.centerX, this.centerY, glowRadius, 0, Math.PI * 2);
            this.ctx.strokeStyle = this.colors.gold;
            this.ctx.lineWidth = 2.5;
            this.ctx.globalAlpha = alpha * pulse;
            this.ctx.stroke();
        }

        // Main circle - solid gold/purple gradient
        const gradient = this.ctx.createRadialGradient(
            this.centerX - radius * 0.3, this.centerY - radius * 0.3, 0,
            this.centerX, this.centerY, radius
        );
        gradient.addColorStop(0, '#ffe066');
        gradient.addColorStop(0.4, '#fbbf24');
        gradient.addColorStop(0.7, '#a855f7');
        gradient.addColorStop(1, '#7c3aed');

        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, radius, 0, Math.PI * 2);
        this.ctx.fillStyle = gradient;
        this.ctx.globalAlpha = 1;
        this.ctx.fill();

        // Gold border
        this.ctx.strokeStyle = '#fbbf24';
        this.ctx.lineWidth = 4;
        this.ctx.globalAlpha = 1;
        this.ctx.stroke();

        // Inner highlight
        this.ctx.beginPath();
        this.ctx.arc(this.centerX - radius * 0.25, this.centerY - radius * 0.25, radius * 0.2, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.fill();

        // Draw "#1" label with shadow for better visibility
        this.ctx.font = `bold ${radius * 0.55}px 'Orbitron', monospace`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // Text shadow
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillText('#1', this.centerX + 2, this.centerY + 2);

        // Main text
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillText('#1', this.centerX, this.centerY);

        this.ctx.globalAlpha = 1;
    }

    drawNodes() {
        // ALWAYS draw center node (#1 holder) first
        this.drawCenterNode();

        // Sort nodes so larger ones are drawn last (on top)
        const sortedNodes = Array.from(this.nodes.values())
            .filter(n => !n.isAMM)
            .sort((a, b) => a.radius - b.radius);

        sortedNodes.forEach(node => {
            const isHovered = this.hoveredNode === node;
            const pulse = Math.sin(node.pulsePhase) * 0.08 + 1;
            const hoverScale = isHovered ? 1.2 : 1;
            const radius = node.radius * pulse * hoverScale;

            this.ctx.globalAlpha = node.alpha;

            // Outer glow
            const glowGradient = this.ctx.createRadialGradient(
                node.x, node.y, radius * 0.5,
                node.x, node.y, radius * 2
            );
            glowGradient.addColorStop(0, node.color + '40');
            glowGradient.addColorStop(0.5, node.color + '15');
            glowGradient.addColorStop(1, 'transparent');
            this.ctx.fillStyle = glowGradient;
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, radius * 2, 0, Math.PI * 2);
            this.ctx.fill();

            // Node body - solid circle with gradient
            const bodyGradient = this.ctx.createRadialGradient(
                node.x - radius * 0.3, node.y - radius * 0.3, 0,
                node.x, node.y, radius
            );
            bodyGradient.addColorStop(0, this.adjustColor(node.color, 60));
            bodyGradient.addColorStop(0.7, node.color);
            bodyGradient.addColorStop(1, this.adjustColor(node.color, -30));

            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
            this.ctx.fillStyle = bodyGradient;
            this.ctx.fill();

            // Ring
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
            this.ctx.strokeStyle = node.color;
            this.ctx.lineWidth = isHovered ? 2.5 : 1.5;
            this.ctx.globalAlpha = node.alpha * 0.8;
            this.ctx.stroke();

            // Inner highlight
            this.ctx.beginPath();
            this.ctx.arc(node.x - radius * 0.3, node.y - radius * 0.3, radius * 0.25, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.globalAlpha = node.alpha * 0.6;
            this.ctx.fill();

            // Draw rank number for top holders
            if (node.isHolder && node.rank && radius > 15) {
                this.ctx.globalAlpha = node.alpha;
                this.ctx.font = `bold ${Math.max(10, radius * 0.6)}px 'Orbitron', monospace`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillStyle = '#fff';
                this.ctx.fillText(node.rank.toString(), node.x, node.y);
            }
        });
        this.ctx.globalAlpha = 1;
    }

    drawParticles() {
        this.particles.forEach(p => {
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = p.alpha;
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1;
    }

    adjustColor(hex, amount) {
        const num = parseInt(hex.slice(1), 16);
        const r = Math.min(255, Math.max(0, (num >> 16) + amount));
        const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
        const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
        return '#' + (0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1);
    }

    drawTooltip(node) {
        const padding = 12;
        const lineHeight = 18;

        const balanceStr = node.balance !== null ?
            this.formatNumber(node.balance) + ' tokens' : 'New buyer';

        const addressStr = node.id.slice(0, 8) + '...' + node.id.slice(-8);
        const rankStr = node.rank ? `Rank #${node.rank}` : 'Outside Top 30';

        this.ctx.font = 'bold 12px Orbitron, monospace';
        const rankWidth = this.ctx.measureText(rankStr).width;

        this.ctx.font = '10px monospace';
        const addressWidth = this.ctx.measureText(addressStr).width;

        this.ctx.font = '11px Orbitron, monospace';
        const balanceWidth = this.ctx.measureText(balanceStr).width;

        const boxWidth = Math.max(rankWidth, addressWidth, balanceWidth) + padding * 2;
        const boxHeight = lineHeight * 3 + padding * 2 + 12;

        let tooltipX = node.x + node.radius + 15;
        let tooltipY = node.y - boxHeight / 2;

        if (tooltipX + boxWidth > this.canvas.width - 10) {
            tooltipX = node.x - node.radius - boxWidth - 15;
        }
        if (tooltipY < 10) tooltipY = 10;
        if (tooltipY + boxHeight > this.canvas.height - 160) {
            tooltipY = this.canvas.height - boxHeight - 160;
        }

        // Tooltip background
        this.ctx.fillStyle = 'rgba(10, 10, 20, 0.95)';
        this.ctx.strokeStyle = node.color;
        this.ctx.lineWidth = 1;

        this.ctx.beginPath();
        this.ctx.roundRect(tooltipX, tooltipY, boxWidth, boxHeight, 6);
        this.ctx.fill();
        this.ctx.stroke();

        let y = tooltipY + padding + 14;

        this.ctx.font = 'bold 12px Orbitron, monospace';
        this.ctx.fillStyle = node.color;
        this.ctx.textAlign = 'left';
        this.ctx.fillText(rankStr, tooltipX + padding, y);

        y += lineHeight;
        this.ctx.font = '10px monospace';
        this.ctx.fillStyle = '#888';
        this.ctx.fillText(addressStr, tooltipX + padding, y);

        y += lineHeight;
        this.ctx.font = '11px Orbitron, monospace';
        this.ctx.fillStyle = '#ddd';
        this.ctx.fillText(balanceStr, tooltipX + padding, y);

        this.ctx.font = '9px monospace';
        this.ctx.fillStyle = '#555';
        this.ctx.fillText('Click to view on Solscan', tooltipX + padding, tooltipY + boxHeight - 8);
    }

    formatNumber(num) {
        if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
        if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
        if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
        return num.toFixed(0);
    }

    animate() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.animate());
    }

    getNodeCount() {
        return this.nodes.size;
    }
}

window.NeuralVisualization = NeuralVisualization;
