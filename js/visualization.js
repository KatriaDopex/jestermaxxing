// Neural Network Visualization Engine - Simplified & Reliable
class NeuralVisualization {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.holders = []; // Simple array of holder objects
        this.traces = [];
        this.particles = [];
        this.audioContext = null;
        this.soundEnabled = false;
        this.hoveredNode = null;
        this.mouseX = 0;
        this.mouseY = 0;
        this.pulseTime = 0;
        this.dataLoaded = false;

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
            if (this.hoveredNode && this.hoveredNode.rank !== 1) {
                window.open(`https://solscan.io/account/${this.hoveredNode.address}`, '_blank');
            }
        });
    }

    checkHover() {
        this.hoveredNode = null;
        for (const holder of this.holders) {
            const dx = this.mouseX - holder.x;
            const dy = this.mouseY - holder.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < holder.radius + 5) {
                this.hoveredNode = holder;
                break;
            }
        }
        this.canvas.style.cursor = this.hoveredNode && this.hoveredNode.rank !== 1 ? 'pointer' : 'default';
    }

    initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            document.addEventListener('click', () => {
                if (this.audioContext?.state === 'suspended') {
                    this.audioContext.resume();
                    this.soundEnabled = true;
                }
            }, { once: true });
        } catch (e) {
            console.error('Audio init error:', e);
        }
    }

    playSound(amount = 1, type = 'transfer') {
        if (!this.audioContext || this.audioContext.state === 'suspended') return;
        try {
            const ctx = this.audioContext;
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            const baseFreq = 400 + Math.min(amount, 5000) / 10;
            osc.type = 'sine';
            osc.frequency.setValueAtTime(baseFreq, now);
            osc.frequency.exponentialRampToValueAtTime(baseFreq * (type === 'buy' ? 1.5 : 0.7), now + 0.1);

            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

            osc.start(now);
            osc.stop(now + 0.2);
        } catch (e) {}
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
        this.recalculatePositions();
    }

    recalculatePositions() {
        if (!this.holders.length) return;

        // #1 holder always at center
        if (this.holders[0]) {
            this.holders[0].targetX = this.centerX;
            this.holders[0].targetY = this.centerY;
        }

        // Other holders in orbit
        const orbitHolders = this.holders.slice(1);
        const total = orbitHolders.length;

        orbitHolders.forEach((holder, i) => {
            const pos = this.getOrbitPosition(i, total);
            holder.targetX = pos.x;
            holder.targetY = pos.y;
        });
    }

    getOrbitPosition(index, total) {
        // Use golden angle for nice spiral distribution
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));
        const angle = index * goldenAngle;

        // Calculate radius - spread nodes between min and max
        const minDist = 140; // Minimum distance from center
        const maxDist = Math.min(this.canvas.width, this.canvas.height) / 2 - 80;

        // Distribute more evenly using sqrt for better spread
        const t = (index + 0.5) / total;
        const dist = minDist + (maxDist - minDist) * Math.sqrt(t);

        return {
            x: this.centerX + Math.cos(angle) * dist,
            y: this.centerY + Math.sin(angle) * dist
        };
    }

    loadHolders(holdersData) {
        console.log('Loading holders:', holdersData.length);

        // Sort by balance - largest first
        const sorted = [...holdersData].sort((a, b) => (b.balance || 0) - (a.balance || 0));

        // Get max balance for scaling (excluding #1)
        const maxBalance = sorted.length > 1 ? sorted[1].balance : 1;

        // Create holder objects
        this.holders = sorted.map((h, i) => {
            const rank = i + 1;
            const isCenter = rank === 1;

            // Calculate radius based on balance
            let radius;
            if (isCenter) {
                radius = 65; // Center node is big
            } else {
                const ratio = Math.min(1, (h.balance || 0) / maxBalance);
                radius = 12 + 20 * Math.sqrt(ratio); // 12-32px range
            }

            // Color based on rank
            let color;
            if (rank === 1) color = this.colors.gold;
            else if (rank <= 5) color = this.colors.gold;
            else if (rank <= 10) color = this.colors.purple;
            else if (rank <= 20) color = this.colors.cyan;
            else color = this.colors.blue;

            return {
                address: h.address,
                balance: h.balance,
                rank: rank,
                radius: radius,
                color: color,
                x: this.centerX + (Math.random() - 0.5) * 50,
                y: this.centerY + (Math.random() - 0.5) * 50,
                targetX: this.centerX,
                targetY: this.centerY,
                pulsePhase: Math.random() * Math.PI * 2,
                alpha: 1
            };
        });

        this.dataLoaded = true;
        this.recalculatePositions();
        console.log('Holders loaded:', this.holders.length, 'Center:', this.holders[0]?.address);
    }

    addTransaction(tx) {
        // Find nodes
        const fromNode = this.holders.find(h => h.address === tx.from);
        const toNode = this.holders.find(h => h.address === tx.to);

        if (fromNode && toNode) {
            this.createTrace(fromNode, toNode, tx.type);
        }

        this.playSound(tx.amount, tx.type);
    }

    createTrace(from, to, type) {
        const color = type === 'buy' ? this.colors.green :
                      type === 'sell' ? this.colors.red : this.colors.purple;

        this.traces.push({
            fromX: from.x,
            fromY: from.y,
            toX: to.x,
            toY: to.y,
            progress: 0,
            color: color,
            width: 3
        });

        // Burst at destination
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            this.particles.push({
                x: to.x,
                y: to.y,
                vx: Math.cos(angle) * 3,
                vy: Math.sin(angle) * 3,
                radius: 2,
                color: color,
                alpha: 1
            });
        }
    }

    update() {
        this.pulseTime += 0.02;

        // Update holder positions (smooth movement)
        this.holders.forEach(h => {
            h.x += (h.targetX - h.x) * 0.08;
            h.y += (h.targetY - h.y) * 0.08;
            h.pulsePhase += 0.03;
        });

        // Update traces
        this.traces = this.traces.filter(t => {
            t.progress += 0.04;
            return t.progress < 1.5;
        });

        // Update particles
        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.95;
            p.vy *= 0.95;
            p.alpha -= 0.03;
            return p.alpha > 0;
        });
    }

    draw() {
        const ctx = this.ctx;

        // Clear with background
        ctx.fillStyle = this.colors.background;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw subtle grid
        this.drawGrid();

        // Draw connection lines from center to all nodes
        this.drawConnections();

        // Draw traces
        this.drawTraces();

        // Draw all holder nodes
        this.drawHolders();

        // Draw particles
        this.drawParticles();

        // Draw tooltip
        if (this.hoveredNode) {
            this.drawTooltip(this.hoveredNode);
        }
    }

    drawGrid() {
        const ctx = this.ctx;
        ctx.strokeStyle = 'rgba(100, 100, 150, 0.03)';
        ctx.lineWidth = 1;

        for (let x = 0; x < this.canvas.width; x += 50) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y < this.canvas.height; y += 50) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.canvas.width, y);
            ctx.stroke();
        }
    }

    drawConnections() {
        if (this.holders.length < 2) return;

        const ctx = this.ctx;
        const center = this.holders[0];
        if (!center) return;

        const pulse = Math.sin(this.pulseTime) * 0.3 + 0.7;

        // Draw faint lines from center to all other nodes
        this.holders.slice(1).forEach(h => {
            ctx.beginPath();
            ctx.moveTo(center.x, center.y);
            ctx.lineTo(h.x, h.y);
            ctx.strokeStyle = h.color;
            ctx.globalAlpha = 0.08 * pulse;
            ctx.lineWidth = 1;
            ctx.stroke();
        });
        ctx.globalAlpha = 1;
    }

    drawTraces() {
        const ctx = this.ctx;

        this.traces.forEach(t => {
            const progress = Math.min(1, t.progress);
            const fade = t.progress > 1 ? 1 - (t.progress - 1) * 2 : 1;

            const x = t.fromX + (t.toX - t.fromX) * progress;
            const y = t.fromY + (t.toY - t.fromY) * progress;

            ctx.beginPath();
            ctx.moveTo(t.fromX, t.fromY);
            ctx.lineTo(x, y);
            ctx.strokeStyle = t.color;
            ctx.lineWidth = t.width;
            ctx.globalAlpha = 0.8 * fade;
            ctx.stroke();

            // Glow
            ctx.lineWidth = t.width * 3;
            ctx.globalAlpha = 0.2 * fade;
            ctx.stroke();
        });
        ctx.globalAlpha = 1;
    }

    drawHolders() {
        const ctx = this.ctx;

        // Draw in reverse order so #1 is on top
        for (let i = this.holders.length - 1; i >= 0; i--) {
            const h = this.holders[i];
            const isCenter = h.rank === 1;
            const pulse = Math.sin(h.pulsePhase) * 0.08 + 1;
            const isHovered = this.hoveredNode === h;
            const scale = isHovered ? 1.15 : 1;
            const r = h.radius * pulse * scale;

            // Outer glow
            const glow = ctx.createRadialGradient(h.x, h.y, r * 0.5, h.x, h.y, r * 2.5);
            glow.addColorStop(0, h.color + '60');
            glow.addColorStop(0.5, h.color + '20');
            glow.addColorStop(1, 'transparent');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(h.x, h.y, r * 2.5, 0, Math.PI * 2);
            ctx.fill();

            // Extra rings for center node
            if (isCenter) {
                for (let ring = 3; ring >= 1; ring--) {
                    ctx.beginPath();
                    ctx.arc(h.x, h.y, r + ring * 10, 0, Math.PI * 2);
                    ctx.strokeStyle = this.colors.gold;
                    ctx.lineWidth = 2;
                    ctx.globalAlpha = 0.2 / ring;
                    ctx.stroke();
                }
                ctx.globalAlpha = 1;
            }

            // Main circle
            const grad = ctx.createRadialGradient(
                h.x - r * 0.3, h.y - r * 0.3, 0,
                h.x, h.y, r
            );
            if (isCenter) {
                grad.addColorStop(0, '#ffe066');
                grad.addColorStop(0.5, '#fbbf24');
                grad.addColorStop(1, '#a855f7');
            } else {
                grad.addColorStop(0, this.lightenColor(h.color, 40));
                grad.addColorStop(1, h.color);
            }

            ctx.beginPath();
            ctx.arc(h.x, h.y, r, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();

            // Border
            ctx.strokeStyle = isCenter ? '#fbbf24' : h.color;
            ctx.lineWidth = isCenter ? 4 : 2;
            ctx.stroke();

            // Highlight
            ctx.beginPath();
            ctx.arc(h.x - r * 0.3, h.y - r * 0.3, r * 0.2, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.fill();

            // Rank number
            if (r > 14) {
                const fontSize = isCenter ? r * 0.5 : Math.max(10, r * 0.55);
                ctx.font = `bold ${fontSize}px 'Orbitron', sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                // Shadow
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillText(h.rank.toString(), h.x + 1, h.y + 1);

                // Text
                ctx.fillStyle = '#ffffff';
                ctx.fillText(h.rank.toString(), h.x, h.y);
            }
        }
    }

    drawParticles() {
        const ctx = this.ctx;
        this.particles.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.alpha;
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    drawTooltip(h) {
        if (h.rank === 1) return; // No tooltip for center

        const ctx = this.ctx;
        const padding = 10;
        const lines = [
            `Rank #${h.rank}`,
            h.address.slice(0, 6) + '...' + h.address.slice(-4),
            this.formatNumber(h.balance) + ' tokens'
        ];

        ctx.font = '12px monospace';
        const width = Math.max(...lines.map(l => ctx.measureText(l).width)) + padding * 2;
        const height = lines.length * 18 + padding * 2;

        let x = h.x + h.radius + 10;
        let y = h.y - height / 2;

        if (x + width > this.canvas.width - 10) x = h.x - h.radius - width - 10;
        if (y < 10) y = 10;
        if (y + height > this.canvas.height - 10) y = this.canvas.height - height - 10;

        // Background
        ctx.fillStyle = 'rgba(10, 10, 20, 0.9)';
        ctx.strokeStyle = h.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, 5);
        ctx.fill();
        ctx.stroke();

        // Text
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        lines.forEach((line, i) => {
            ctx.fillStyle = i === 0 ? h.color : '#aaaaaa';
            ctx.fillText(line, x + padding, y + padding + i * 18);
        });
    }

    formatNumber(n) {
        if (!n) return '0';
        if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
        if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
        if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
        return n.toFixed(0);
    }

    lightenColor(hex, amt) {
        let c = hex.replace('#', '');
        if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
        const num = parseInt(c, 16);
        let r = (num >> 16) + amt;
        let g = ((num >> 8) & 0xff) + amt;
        let b = (num & 0xff) + amt;
        r = Math.min(255, Math.max(0, r));
        g = Math.min(255, Math.max(0, g));
        b = Math.min(255, Math.max(0, b));
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    animate() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.animate());
    }

    getNodeCount() {
        return this.holders.length;
    }
}

window.NeuralVisualization = NeuralVisualization;
