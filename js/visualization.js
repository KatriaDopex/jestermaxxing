// Neural Network Visualization Engine
class NeuralVisualization {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.nodes = new Map();
        this.traces = [];
        this.particles = [];
        this.centerNode = null;
        this.audioContext = null;
        this.soundEnabled = false;

        // Colors - Jester theme
        this.colors = {
            purple: '#9b4dca',
            gold: '#ffd700',
            red: '#ff4444',
            green: '#44ff88',
            cyan: '#44ffff',
            background: '#0a0a0f'
        };

        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.createCenterNode();
        this.initAudio();
        this.animate();
    }

    initAudio() {
        // Initialize audio on first user interaction
        const enableAudio = () => {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.soundEnabled = true;
                console.log('Audio enabled');
            }
            document.removeEventListener('click', enableAudio);
            document.removeEventListener('keydown', enableAudio);
        };

        document.addEventListener('click', enableAudio);
        document.addEventListener('keydown', enableAudio);
    }

    playTransactionSound(amount = 1, type = 'transfer') {
        if (!this.audioContext || !this.soundEnabled) return;

        try {
            const ctx = this.audioContext;

            // Create oscillator for Star Wars style blip
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gainNode = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            // Connect nodes
            osc1.connect(filter);
            osc2.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(ctx.destination);

            // Configure filter for that classic sci-fi sound
            filter.type = 'bandpass';
            filter.frequency.value = 1500;
            filter.Q.value = 5;

            // Base frequency varies by transaction size
            const baseFreq = 400 + Math.min(amount, 10000) / 20;

            // Oscillator settings - square wave for retro feel
            osc1.type = 'square';
            osc2.type = 'sawtooth';

            // Frequency sweep for that blip effect
            const now = ctx.currentTime;

            if (type === 'buy' || type === 'receive') {
                // Ascending blip for buys
                osc1.frequency.setValueAtTime(baseFreq, now);
                osc1.frequency.exponentialRampToValueAtTime(baseFreq * 2, now + 0.1);
                osc2.frequency.setValueAtTime(baseFreq * 1.5, now);
                osc2.frequency.exponentialRampToValueAtTime(baseFreq * 3, now + 0.1);
            } else {
                // Descending blip for sells
                osc1.frequency.setValueAtTime(baseFreq * 2, now);
                osc1.frequency.exponentialRampToValueAtTime(baseFreq, now + 0.1);
                osc2.frequency.setValueAtTime(baseFreq * 3, now);
                osc2.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.1);
            }

            // Volume envelope
            const volume = Math.min(0.15, 0.05 + Math.log10(amount + 1) / 50);
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(volume, now + 0.02);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

            // Start and stop
            osc1.start(now);
            osc2.start(now);
            osc1.stop(now + 0.2);
            osc2.stop(now + 0.2);

        } catch (e) {
            console.log('Audio error:', e);
        }
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;

        if (this.centerNode) {
            this.centerNode.x = this.centerX;
            this.centerNode.y = this.centerY;
            this.centerNode.targetX = this.centerX;
            this.centerNode.targetY = this.centerY;
        }

        // Reposition holder nodes if they exist
        this.repositionHolderNodes();
    }

    repositionHolderNodes() {
        let holderIndex = 0;
        const holderNodes = Array.from(this.nodes.values()).filter(n => n.isHolder && !n.isCenter);
        const totalHolders = holderNodes.length;

        holderNodes.forEach(node => {
            const pos = this.getHolderPosition(holderIndex, totalHolders, node.rank);
            node.targetX = pos.x;
            node.targetY = pos.y;
            holderIndex++;
        });
    }

    createCenterNode() {
        this.centerNode = {
            id: 'center',
            x: this.centerX,
            y: this.centerY,
            targetX: this.centerX,
            targetY: this.centerY,
            radius: 50,
            color: this.colors.purple,
            pulsePhase: 0,
            isCenter: true,
            isHolder: false,
            label: 'JESTER',
            alpha: 1
        };
        this.nodes.set('center', this.centerNode);
    }

    getHolderPosition(index, total, rank) {
        // Arrange holders in concentric circles based on rank
        // Top holders (1-20) in inner circle, 21-50 middle, 51-100 outer

        let ring, ringSize, ringIndex;

        if (rank <= 20) {
            ring = 0;
            ringSize = 20;
            ringIndex = rank - 1;
        } else if (rank <= 50) {
            ring = 1;
            ringSize = 30;
            ringIndex = rank - 21;
        } else {
            ring = 2;
            ringSize = 50;
            ringIndex = rank - 51;
        }

        const baseRadius = 120 + ring * 100;
        const angle = (ringIndex / ringSize) * Math.PI * 2 - Math.PI / 2;

        return {
            x: this.centerX + Math.cos(angle) * baseRadius,
            y: this.centerY + Math.sin(angle) * baseRadius
        };
    }

    loadHolders(holders) {
        console.log(`Loading ${holders.length} holders into visualization`);

        holders.forEach((holder, index) => {
            const pos = this.getHolderPosition(index, holders.length, holder.rank);

            // Size based on rank - top holders are bigger
            const radius = holder.rank <= 10 ? 15 :
                          holder.rank <= 30 ? 12 :
                          holder.rank <= 50 ? 10 : 8;

            // Color based on rank
            const color = holder.rank <= 10 ? this.colors.gold :
                         holder.rank <= 30 ? this.colors.purple :
                         holder.rank <= 50 ? this.colors.cyan : this.colors.purple;

            const node = {
                id: holder.address,
                x: this.centerX + (Math.random() - 0.5) * 100, // Start near center
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
                rank: holder.rank,
                balance: holder.balance,
                label: `#${holder.rank}`
            };

            this.nodes.set(holder.address, node);
        });
    }

    getOrCreateNode(address, isHolder = false, rank = null) {
        if (this.nodes.has(address)) {
            const node = this.nodes.get(address);
            node.lastActive = Date.now();
            node.activity++;
            // Pulse effect on activity
            node.radius = node.baseRadius * 1.5;
            return node;
        }

        // Create new node for non-holder (appears at random position)
        const angle = Math.random() * Math.PI * 2;
        const distance = 350 + Math.random() * 150;
        const x = this.centerX + Math.cos(angle) * distance;
        const y = this.centerY + Math.sin(angle) * distance;

        const node = {
            id: address,
            x: x,
            y: y,
            targetX: x,
            targetY: y,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            radius: 6,
            baseRadius: 6,
            color: this.colors.red, // Non-holders are red (outsiders)
            alpha: 1,
            pulsePhase: Math.random() * Math.PI * 2,
            lastActive: Date.now(),
            activity: 1,
            isHolder: false,
            rank: null,
            label: address.slice(0, 4) + '..' + address.slice(-2)
        };

        this.nodes.set(address, node);
        return node;
    }

    addTransaction(fromAddress, toAddress, amount, fromIsHolder, toIsHolder) {
        const fromNode = this.getOrCreateNode(fromAddress, fromIsHolder);
        const toNode = this.getOrCreateNode(toAddress, toIsHolder);

        // Determine transaction type based on holder status
        let type = 'transfer';
        if (!fromIsHolder && toIsHolder) {
            type = 'buy'; // Outsider sending to holder = they bought
        } else if (fromIsHolder && !toIsHolder) {
            type = 'sell'; // Holder sending to outsider = they sold
        }

        this.createTrace(fromNode, toNode, amount, type);
        this.createBurst(toNode.x, toNode.y, type);

        // Play sound
        this.playTransactionSound(amount, type);
    }

    createTrace(fromNode, toNode, amount = 1, type = 'transfer') {
        const color = type === 'buy' ? this.colors.green :
                      type === 'sell' ? this.colors.red : this.colors.gold;

        const intensity = Math.min(1, Math.log10(amount + 1) / 5);

        const trace = {
            from: fromNode,
            to: toNode,
            progress: 0,
            speed: 0.02 + Math.random() * 0.01,
            color: color,
            intensity: 0.4 + intensity * 0.6,
            width: 2 + intensity * 6,
            particles: []
        };

        // Create particles along the trace
        const particleCount = 8 + Math.floor(intensity * 15);
        for (let i = 0; i < particleCount; i++) {
            trace.particles.push({
                offset: i / particleCount,
                size: 2 + Math.random() * 4,
                speed: 0.6 + Math.random() * 0.4
            });
        }

        this.traces.push(trace);
    }

    createBurst(x, y, type) {
        const color = type === 'buy' ? this.colors.green :
                      type === 'sell' ? this.colors.red : this.colors.gold;

        for (let i = 0; i < 15; i++) {
            const angle = (i / 15) * Math.PI * 2;
            const speed = 3 + Math.random() * 4;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: 2 + Math.random() * 4,
                color: color,
                alpha: 1,
                decay: 0.025 + Math.random() * 0.02
            });
        }
    }

    update() {
        const now = Date.now();

        // Update nodes
        this.nodes.forEach((node, id) => {
            // Smooth movement towards target
            const dx = node.targetX - node.x;
            const dy = node.targetY - node.y;
            node.x += dx * 0.05;
            node.y += dy * 0.05;

            // Add slight drift for non-center nodes
            if (!node.isCenter) {
                node.x += node.vx || 0;
                node.y += node.vy || 0;

                // Damping
                if (node.vx) node.vx *= 0.98;
                if (node.vy) node.vy *= 0.98;
            }

            // Pulse animation
            node.pulsePhase += 0.03;

            // Radius returns to base
            if (node.radius > node.baseRadius) {
                node.radius = node.baseRadius + (node.radius - node.baseRadius) * 0.95;
            }

            // Fade out inactive non-holder nodes
            if (!node.isHolder && !node.isCenter) {
                const timeSinceActive = now - node.lastActive;
                if (timeSinceActive > 30000) {
                    node.alpha = Math.max(0.1, 1 - (timeSinceActive - 30000) / 30000);
                }
                if (timeSinceActive > 90000 && node.alpha < 0.2) {
                    this.nodes.delete(id);
                }
            }
        });

        // Update traces
        this.traces = this.traces.filter(trace => {
            trace.progress += trace.speed;
            trace.particles.forEach(p => {
                p.offset += trace.speed * p.speed;
                if (p.offset > 1) p.offset -= 1;
            });
            return trace.progress < 1.5;
        });

        // Update burst particles
        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.97;
            p.vy *= 0.97;
            p.alpha -= p.decay;
            return p.alpha > 0;
        });
    }

    draw() {
        // Clear with trail effect
        this.ctx.fillStyle = 'rgba(10, 10, 15, 0.12)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw ambient glow
        const gradient = this.ctx.createRadialGradient(
            this.centerX, this.centerY, 0,
            this.centerX, this.centerY, 400
        );
        gradient.addColorStop(0, 'rgba(155, 77, 202, 0.08)');
        gradient.addColorStop(1, 'rgba(155, 77, 202, 0)');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw connection lines to holders (faint web)
        this.ctx.lineWidth = 0.5;
        this.nodes.forEach(node => {
            if (node.isHolder && !node.isCenter && node.alpha > 0.3) {
                this.ctx.beginPath();
                this.ctx.moveTo(this.centerNode.x, this.centerNode.y);
                this.ctx.lineTo(node.x, node.y);
                this.ctx.strokeStyle = `rgba(155, 77, 202, ${node.alpha * 0.15})`;
                this.ctx.stroke();
            }
        });

        // Draw traces
        this.traces.forEach(trace => {
            const progress = Math.min(1, trace.progress);
            const fadeOut = trace.progress > 1 ? 1 - (trace.progress - 1) * 2 : 1;

            this.ctx.beginPath();
            this.ctx.moveTo(trace.from.x, trace.from.y);

            const currentX = trace.from.x + (trace.to.x - trace.from.x) * progress;
            const currentY = trace.from.y + (trace.to.y - trace.from.y) * progress;

            this.ctx.lineTo(currentX, currentY);
            this.ctx.strokeStyle = trace.color;
            this.ctx.lineWidth = trace.width;
            this.ctx.globalAlpha = trace.intensity * fadeOut;
            this.ctx.shadowColor = trace.color;
            this.ctx.shadowBlur = 25;
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;

            // Particles
            trace.particles.forEach(p => {
                if (p.offset <= progress) {
                    const px = trace.from.x + (trace.to.x - trace.from.x) * p.offset;
                    const py = trace.from.y + (trace.to.y - trace.from.y) * p.offset;

                    this.ctx.beginPath();
                    this.ctx.arc(px, py, p.size, 0, Math.PI * 2);
                    this.ctx.fillStyle = trace.color;
                    this.ctx.globalAlpha = trace.intensity * fadeOut;
                    this.ctx.shadowColor = trace.color;
                    this.ctx.shadowBlur = 20;
                    this.ctx.fill();
                    this.ctx.shadowBlur = 0;
                }
            });
        });
        this.ctx.globalAlpha = 1;

        // Draw nodes
        this.nodes.forEach(node => {
            const pulse = Math.sin(node.pulsePhase) * 0.15 + 1;
            const radius = node.radius * pulse;

            // Glow
            const glowGradient = this.ctx.createRadialGradient(
                node.x, node.y, 0,
                node.x, node.y, radius * 4
            );
            glowGradient.addColorStop(0, node.color + '50');
            glowGradient.addColorStop(1, node.color + '00');
            this.ctx.fillStyle = glowGradient;
            this.ctx.globalAlpha = node.alpha;
            this.ctx.fillRect(node.x - radius * 4, node.y - radius * 4, radius * 8, radius * 8);

            // Core
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
            this.ctx.fillStyle = node.color;
            this.ctx.shadowColor = node.color;
            this.ctx.shadowBlur = 15;
            this.ctx.fill();
            this.ctx.shadowBlur = 0;

            // Highlight
            this.ctx.beginPath();
            this.ctx.arc(node.x - radius * 0.25, node.y - radius * 0.25, radius * 0.35, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            this.ctx.fill();

            // Ring for top 10 holders
            if (node.isHolder && node.rank && node.rank <= 10) {
                this.ctx.beginPath();
                this.ctx.arc(node.x, node.y, radius + 4, 0, Math.PI * 2);
                this.ctx.strokeStyle = this.colors.gold;
                this.ctx.lineWidth = 2;
                this.ctx.shadowColor = this.colors.gold;
                this.ctx.shadowBlur = 10;
                this.ctx.stroke();
                this.ctx.shadowBlur = 0;
            }

            // Label for center and top holders
            if (node.isCenter || (node.isHolder && node.rank <= 20)) {
                this.ctx.font = node.isCenter ? 'bold 14px Orbitron' : '10px Orbitron';
                this.ctx.fillStyle = '#fff';
                this.ctx.textAlign = 'center';
                this.ctx.globalAlpha = node.alpha * 0.8;
                this.ctx.fillText(node.label, node.x, node.y + radius + 15);
            }
        });
        this.ctx.globalAlpha = 1;

        // Draw burst particles
        this.particles.forEach(p => {
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = p.alpha;
            this.ctx.shadowColor = p.color;
            this.ctx.shadowBlur = 10;
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        });
        this.ctx.globalAlpha = 1;
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
