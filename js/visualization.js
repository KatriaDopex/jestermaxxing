// Neural Network Visualization Engine
class NeuralVisualization {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.nodes = new Map();
        this.traces = [];
        this.particles = [];
        this.centerNode = null;

        // Colors - Jester theme
        this.colors = {
            purple: '#9b4dca',
            gold: '#ffd700',
            red: '#ff4444',
            green: '#44ff88',
            background: '#0a0a0f'
        };

        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.createCenterNode();
        this.animate();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;

        if (this.centerNode) {
            this.centerNode.x = this.centerX;
            this.centerNode.y = this.centerY;
        }
    }

    createCenterNode() {
        this.centerNode = {
            id: 'center',
            x: this.centerX,
            y: this.centerY,
            targetX: this.centerX,
            targetY: this.centerY,
            radius: 40,
            color: this.colors.purple,
            pulsePhase: 0,
            isCenter: true,
            label: 'JESTER'
        };
        this.nodes.set('center', this.centerNode);
    }

    getOrCreateNode(address, type = 'wallet') {
        if (this.nodes.has(address)) {
            const node = this.nodes.get(address);
            node.lastActive = Date.now();
            node.activity++;
            return node;
        }

        // Create new node at random position around center
        const angle = Math.random() * Math.PI * 2;
        const distance = 150 + Math.random() * 250;
        const x = this.centerX + Math.cos(angle) * distance;
        const y = this.centerY + Math.sin(angle) * distance;

        const node = {
            id: address,
            x: x,
            y: y,
            targetX: x,
            targetY: y,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            radius: 8 + Math.random() * 8,
            color: type === 'buy' ? this.colors.green :
                   type === 'sell' ? this.colors.red : this.colors.gold,
            alpha: 1,
            pulsePhase: Math.random() * Math.PI * 2,
            lastActive: Date.now(),
            activity: 1,
            label: address.slice(0, 4) + '...' + address.slice(-4)
        };

        this.nodes.set(address, node);
        return node;
    }

    createTrace(fromNode, toNode, amount = 1, type = 'transfer') {
        const color = type === 'buy' ? this.colors.green :
                      type === 'sell' ? this.colors.red : this.colors.gold;

        const intensity = Math.min(1, Math.log10(amount + 1) / 6);

        const trace = {
            from: fromNode,
            to: toNode,
            progress: 0,
            speed: 0.015 + Math.random() * 0.01,
            color: color,
            intensity: 0.3 + intensity * 0.7,
            width: 2 + intensity * 4,
            particles: []
        };

        // Create particles along the trace
        const particleCount = 5 + Math.floor(intensity * 10);
        for (let i = 0; i < particleCount; i++) {
            trace.particles.push({
                offset: i / particleCount,
                size: 2 + Math.random() * 3,
                speed: 0.5 + Math.random() * 0.5
            });
        }

        this.traces.push(trace);

        // Update node colors based on transaction type
        if (type === 'buy') {
            toNode.color = this.colors.green;
        } else if (type === 'sell') {
            fromNode.color = this.colors.red;
        }
    }

    addTransaction(fromAddress, toAddress, amount, type) {
        const fromNode = fromAddress === 'center' ? this.centerNode :
                         this.getOrCreateNode(fromAddress, type);
        const toNode = toAddress === 'center' ? this.centerNode :
                       this.getOrCreateNode(toAddress, type);

        this.createTrace(fromNode, toNode, amount, type);

        // Create burst effect at destination
        this.createBurst(toNode.x, toNode.y, type);
    }

    createBurst(x, y, type) {
        const color = type === 'buy' ? this.colors.green :
                      type === 'sell' ? this.colors.red : this.colors.gold;

        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const speed = 2 + Math.random() * 3;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: 2 + Math.random() * 3,
                color: color,
                alpha: 1,
                decay: 0.02 + Math.random() * 0.02
            });
        }
    }

    update() {
        const now = Date.now();

        // Update nodes
        this.nodes.forEach((node, id) => {
            if (node.isCenter) {
                node.pulsePhase += 0.02;
                return;
            }

            // Gentle drift
            node.x += node.vx;
            node.y += node.vy;

            // Boundary bounce
            const margin = 100;
            if (node.x < margin || node.x > this.canvas.width - margin) {
                node.vx *= -0.8;
                node.x = Math.max(margin, Math.min(this.canvas.width - margin, node.x));
            }
            if (node.y < margin || node.y > this.canvas.height - margin) {
                node.vy *= -0.8;
                node.y = Math.max(margin, Math.min(this.canvas.height - margin, node.y));
            }

            // Slight attraction to center
            const dx = this.centerX - node.x;
            const dy = this.centerY - node.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 400) {
                node.vx += dx * 0.00005;
                node.vy += dy * 0.00005;
            }

            // Damping
            node.vx *= 0.99;
            node.vy *= 0.99;

            // Fade out inactive nodes
            const timeSinceActive = now - node.lastActive;
            if (timeSinceActive > 30000) { // 30 seconds
                node.alpha = Math.max(0.1, 1 - (timeSinceActive - 30000) / 30000);
            }

            // Remove very old nodes
            if (timeSinceActive > 120000 && node.alpha < 0.2) {
                this.nodes.delete(id);
            }

            node.pulsePhase += 0.03;
        });

        // Update traces
        this.traces = this.traces.filter(trace => {
            trace.progress += trace.speed;

            // Update particles
            trace.particles.forEach(p => {
                p.offset += trace.speed * p.speed;
                if (p.offset > 1) p.offset -= 1;
            });

            return trace.progress < 1.5; // Keep slightly after completion for fade
        });

        // Update burst particles
        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.98;
            p.vy *= 0.98;
            p.alpha -= p.decay;
            return p.alpha > 0;
        });
    }

    draw() {
        // Clear with slight trail effect
        this.ctx.fillStyle = 'rgba(10, 10, 15, 0.15)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw ambient glow at center
        const gradient = this.ctx.createRadialGradient(
            this.centerX, this.centerY, 0,
            this.centerX, this.centerY, 300
        );
        gradient.addColorStop(0, 'rgba(155, 77, 202, 0.1)');
        gradient.addColorStop(1, 'rgba(155, 77, 202, 0)');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw connection lines (faint)
        this.ctx.strokeStyle = 'rgba(155, 77, 202, 0.1)';
        this.ctx.lineWidth = 1;
        this.nodes.forEach(node => {
            if (!node.isCenter && node.alpha > 0.3) {
                this.ctx.beginPath();
                this.ctx.moveTo(this.centerNode.x, this.centerNode.y);
                this.ctx.lineTo(node.x, node.y);
                this.ctx.globalAlpha = node.alpha * 0.3;
                this.ctx.stroke();
            }
        });
        this.ctx.globalAlpha = 1;

        // Draw traces
        this.traces.forEach(trace => {
            const progress = Math.min(1, trace.progress);
            const fadeOut = trace.progress > 1 ? 1 - (trace.progress - 1) * 2 : 1;

            // Draw trace line
            this.ctx.beginPath();
            this.ctx.moveTo(trace.from.x, trace.from.y);

            const currentX = trace.from.x + (trace.to.x - trace.from.x) * progress;
            const currentY = trace.from.y + (trace.to.y - trace.from.y) * progress;

            this.ctx.lineTo(currentX, currentY);
            this.ctx.strokeStyle = trace.color;
            this.ctx.lineWidth = trace.width;
            this.ctx.globalAlpha = trace.intensity * fadeOut;
            this.ctx.shadowColor = trace.color;
            this.ctx.shadowBlur = 20;
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;

            // Draw particles along trace
            trace.particles.forEach(p => {
                if (p.offset <= progress) {
                    const px = trace.from.x + (trace.to.x - trace.from.x) * p.offset;
                    const py = trace.from.y + (trace.to.y - trace.from.y) * p.offset;

                    this.ctx.beginPath();
                    this.ctx.arc(px, py, p.size, 0, Math.PI * 2);
                    this.ctx.fillStyle = trace.color;
                    this.ctx.globalAlpha = trace.intensity * fadeOut;
                    this.ctx.shadowColor = trace.color;
                    this.ctx.shadowBlur = 15;
                    this.ctx.fill();
                    this.ctx.shadowBlur = 0;
                }
            });
        });
        this.ctx.globalAlpha = 1;

        // Draw nodes
        this.nodes.forEach(node => {
            const pulse = Math.sin(node.pulsePhase) * 0.2 + 1;
            const radius = node.radius * pulse;

            // Glow
            const glowGradient = this.ctx.createRadialGradient(
                node.x, node.y, 0,
                node.x, node.y, radius * 3
            );
            glowGradient.addColorStop(0, node.color + '60');
            glowGradient.addColorStop(1, node.color + '00');
            this.ctx.fillStyle = glowGradient;
            this.ctx.globalAlpha = node.alpha;
            this.ctx.fillRect(node.x - radius * 3, node.y - radius * 3, radius * 6, radius * 6);

            // Core
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
            this.ctx.fillStyle = node.color;
            this.ctx.shadowColor = node.color;
            this.ctx.shadowBlur = 20;
            this.ctx.fill();
            this.ctx.shadowBlur = 0;

            // Inner highlight
            this.ctx.beginPath();
            this.ctx.arc(node.x - radius * 0.3, node.y - radius * 0.3, radius * 0.4, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.fill();

            // Label for center node
            if (node.isCenter) {
                this.ctx.font = 'bold 12px Orbitron';
                this.ctx.fillStyle = '#fff';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(node.label, node.x, node.y + radius + 20);
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

// Export for use in other files
window.NeuralVisualization = NeuralVisualization;
