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
        this.hoveredNode = null;
        this.mouseX = 0;
        this.mouseY = 0;
        this.maxBalance = 0;

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
        this.setupMouseEvents();
        this.createCenterNode();
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
            if (this.hoveredNode && this.hoveredNode.id !== 'center') {
                // Open Solscan for the wallet address
                const address = this.hoveredNode.id;
                window.open(`https://solscan.io/account/${address}`, '_blank');
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

            if (dist < node.radius + 10) {
                found = node;
            }
        });

        this.hoveredNode = found;
        this.canvas.style.cursor = found && found.id !== 'center' ? 'pointer' : 'default';
    }

    initAudio() {
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
            const osc1 = ctx.createOscillator();
            const osc2 = ctx.createOscillator();
            const gainNode = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            osc1.connect(filter);
            osc2.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(ctx.destination);

            filter.type = 'bandpass';
            filter.frequency.value = 1500;
            filter.Q.value = 5;

            const baseFreq = 400 + Math.min(amount, 10000) / 20;
            const now = ctx.currentTime;

            osc1.type = 'square';
            osc2.type = 'sawtooth';

            if (type === 'buy' || type === 'receive') {
                osc1.frequency.setValueAtTime(baseFreq, now);
                osc1.frequency.exponentialRampToValueAtTime(baseFreq * 2, now + 0.1);
                osc2.frequency.setValueAtTime(baseFreq * 1.5, now);
                osc2.frequency.exponentialRampToValueAtTime(baseFreq * 3, now + 0.1);
            } else {
                osc1.frequency.setValueAtTime(baseFreq * 2, now);
                osc1.frequency.exponentialRampToValueAtTime(baseFreq, now + 0.1);
                osc2.frequency.setValueAtTime(baseFreq * 3, now);
                osc2.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.1);
            }

            const volume = Math.min(0.15, 0.05 + Math.log10(amount + 1) / 50);
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(volume, now + 0.02);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

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

        this.repositionHolderNodes();
    }

    repositionHolderNodes() {
        const holderNodes = Array.from(this.nodes.values()).filter(n => n.isHolder && !n.isCenter);

        holderNodes.forEach((node, index) => {
            const pos = this.getHolderPosition(index, holderNodes.length, node.balance);
            node.targetX = pos.x;
            node.targetY = pos.y;
        });
    }

    createCenterNode() {
        this.centerNode = {
            id: 'center',
            x: this.centerX,
            y: this.centerY,
            targetX: this.centerX,
            targetY: this.centerY,
            radius: 45,
            baseRadius: 45,
            color: this.colors.purple,
            pulsePhase: 0,
            isCenter: true,
            isHolder: false,
            label: 'JESTER',
            alpha: 1
        };
        this.nodes.set('center', this.centerNode);
    }

    getHolderPosition(index, total, balance) {
        // Spread holders across the entire screen
        // Use golden angle for even distribution
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));
        const angle = index * goldenAngle;

        // Distance from center based on index, with some randomness
        // Keep holders away from center and edges
        const margin = 120;
        const maxRadius = Math.min(this.canvas.width, this.canvas.height) / 2 - margin;
        const minRadius = 100;

        // Spread based on sqrt for more even area distribution
        const t = (index + 1) / (total + 1);
        const radius = minRadius + (maxRadius - minRadius) * Math.sqrt(t);

        // Add slight randomness to avoid perfect spiral
        const jitter = 20;
        const jitterX = (Math.sin(index * 7.3) * jitter);
        const jitterY = (Math.cos(index * 11.7) * jitter);

        return {
            x: this.centerX + Math.cos(angle) * radius + jitterX,
            y: this.centerY + Math.sin(angle) * radius + jitterY
        };
    }

    getNodeRadius(balance, rank) {
        // Scale radius by balance - top holder biggest
        // Use logarithmic scale for better distribution
        if (!this.maxBalance || this.maxBalance === 0) return 10;

        const ratio = balance / this.maxBalance;
        const minRadius = 6;
        const maxRadius = 35;

        // Use sqrt for better visual scaling
        return minRadius + (maxRadius - minRadius) * Math.sqrt(ratio);
    }

    loadHolders(holders) {
        console.log(`Loading ${holders.length} holders into visualization`);

        // Find max balance for scaling
        this.maxBalance = Math.max(...holders.map(h => h.balance || 0));

        holders.forEach((holder, index) => {
            const pos = this.getHolderPosition(index, holders.length, holder.balance);
            const radius = this.getNodeRadius(holder.balance, holder.rank);

            // Color based on rank
            const color = holder.rank <= 5 ? this.colors.gold :
                         holder.rank <= 20 ? this.colors.purple :
                         holder.rank <= 50 ? this.colors.cyan : '#7b68ee';

            const node = {
                id: holder.address,
                x: this.centerX + (Math.random() - 0.5) * 50,
                y: this.centerY + (Math.random() - 0.5) * 50,
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
            node.radius = Math.min(node.baseRadius * 1.8, node.baseRadius + 15);
            return node;
        }

        // Create new node for non-holder
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.min(this.canvas.width, this.canvas.height) / 2 - 50;
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
            radius: 8,
            baseRadius: 8,
            color: this.colors.red,
            alpha: 1,
            pulsePhase: Math.random() * Math.PI * 2,
            lastActive: Date.now(),
            activity: 1,
            isHolder: false,
            rank: null,
            balance: null,
            label: address.slice(0, 4) + '..' + address.slice(-3)
        };

        this.nodes.set(address, node);
        return node;
    }

    addTransaction(fromAddress, toAddress, amount, fromIsHolder, toIsHolder) {
        const fromNode = this.getOrCreateNode(fromAddress, fromIsHolder);
        const toNode = this.getOrCreateNode(toAddress, toIsHolder);

        let type = 'transfer';
        if (!fromIsHolder && toIsHolder) {
            type = 'buy';
        } else if (fromIsHolder && !toIsHolder) {
            type = 'sell';
        }

        this.createTrace(fromNode, toNode, amount, type);
        this.createBurst(toNode.x, toNode.y, type);
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

        this.nodes.forEach((node, id) => {
            // Smooth movement towards target
            const dx = node.targetX - node.x;
            const dy = node.targetY - node.y;
            node.x += dx * 0.03;
            node.y += dy * 0.03;

            if (!node.isCenter) {
                node.x += node.vx || 0;
                node.y += node.vy || 0;
                if (node.vx) node.vx *= 0.99;
                if (node.vy) node.vy *= 0.99;
            }

            node.pulsePhase += 0.025;

            // Radius returns to base
            if (node.radius > node.baseRadius) {
                node.radius = node.baseRadius + (node.radius - node.baseRadius) * 0.96;
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
        this.ctx.fillStyle = 'rgba(10, 10, 15, 0.1)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw ambient glow
        const gradient = this.ctx.createRadialGradient(
            this.centerX, this.centerY, 0,
            this.centerX, this.centerY, 400
        );
        gradient.addColorStop(0, 'rgba(155, 77, 202, 0.06)');
        gradient.addColorStop(1, 'rgba(155, 77, 202, 0)');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw faint connection lines
        this.ctx.lineWidth = 0.3;
        this.nodes.forEach(node => {
            if (node.isHolder && !node.isCenter && node.alpha > 0.3) {
                this.ctx.beginPath();
                this.ctx.moveTo(this.centerNode.x, this.centerNode.y);
                this.ctx.lineTo(node.x, node.y);
                this.ctx.strokeStyle = `rgba(155, 77, 202, ${node.alpha * 0.08})`;
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

        // Draw nodes (skip center node - GIF is displayed there via HTML)
        this.nodes.forEach(node => {
            // Skip center node - the dancing jester GIF is shown there
            if (node.isCenter) return;

            const isHovered = this.hoveredNode === node;
            const pulse = Math.sin(node.pulsePhase) * 0.12 + 1;
            const hoverScale = isHovered ? 1.3 : 1;
            const radius = node.radius * pulse * hoverScale;

            // Glow
            const glowGradient = this.ctx.createRadialGradient(
                node.x, node.y, 0,
                node.x, node.y, radius * 4
            );
            glowGradient.addColorStop(0, node.color + '40');
            glowGradient.addColorStop(1, node.color + '00');
            this.ctx.fillStyle = glowGradient;
            this.ctx.globalAlpha = node.alpha;
            this.ctx.fillRect(node.x - radius * 4, node.y - radius * 4, radius * 8, radius * 8);

            // Core
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
            this.ctx.fillStyle = node.color;
            this.ctx.shadowColor = node.color;
            this.ctx.shadowBlur = isHovered ? 30 : 15;
            this.ctx.fill();
            this.ctx.shadowBlur = 0;

            // Highlight
            this.ctx.beginPath();
            this.ctx.arc(node.x - radius * 0.25, node.y - radius * 0.25, radius * 0.3, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            this.ctx.fill();

            // Ring for top 5 holders
            if (node.isHolder && node.rank && node.rank <= 5) {
                this.ctx.beginPath();
                this.ctx.arc(node.x, node.y, radius + 5, 0, Math.PI * 2);
                this.ctx.strokeStyle = this.colors.gold;
                this.ctx.lineWidth = 2.5;
                this.ctx.shadowColor = this.colors.gold;
                this.ctx.shadowBlur = 15;
                this.ctx.stroke();
                this.ctx.shadowBlur = 0;
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

        // Draw tooltip for hovered node
        if (this.hoveredNode && this.hoveredNode.id !== 'center') {
            this.drawTooltip(this.hoveredNode);
        }
    }

    drawTooltip(node) {
        const padding = 12;
        const lineHeight = 20;

        // Format balance
        const balanceStr = node.balance !== null ?
            this.formatNumber(node.balance) + ' tokens' : 'Unknown';

        const addressStr = node.id;
        const rankStr = node.rank ? `Rank #${node.rank}` : 'Outside Top 100';

        // Measure text
        this.ctx.font = 'bold 12px Orbitron';
        const rankWidth = this.ctx.measureText(rankStr).width;

        this.ctx.font = '11px monospace';
        const addressWidth = this.ctx.measureText(addressStr).width;

        this.ctx.font = '12px Orbitron';
        const balanceWidth = this.ctx.measureText(balanceStr).width;

        const boxWidth = Math.max(rankWidth, addressWidth, balanceWidth) + padding * 2;
        const boxHeight = lineHeight * 3 + padding * 2;

        // Position tooltip
        let tooltipX = node.x + node.radius + 15;
        let tooltipY = node.y - boxHeight / 2;

        // Keep on screen
        if (tooltipX + boxWidth > this.canvas.width - 10) {
            tooltipX = node.x - node.radius - boxWidth - 15;
        }
        if (tooltipY < 10) tooltipY = 10;
        if (tooltipY + boxHeight > this.canvas.height - 10) {
            tooltipY = this.canvas.height - boxHeight - 10;
        }

        // Draw background
        this.ctx.fillStyle = 'rgba(15, 15, 25, 0.95)';
        this.ctx.strokeStyle = node.color;
        this.ctx.lineWidth = 2;

        this.ctx.beginPath();
        this.ctx.roundRect(tooltipX, tooltipY, boxWidth, boxHeight, 8);
        this.ctx.fill();
        this.ctx.stroke();

        // Draw text
        let y = tooltipY + padding + 14;

        this.ctx.font = 'bold 12px Orbitron';
        this.ctx.fillStyle = node.color;
        this.ctx.textAlign = 'left';
        this.ctx.fillText(rankStr, tooltipX + padding, y);

        y += lineHeight;
        this.ctx.font = '11px monospace';
        this.ctx.fillStyle = '#888';
        this.ctx.fillText(addressStr, tooltipX + padding, y);

        y += lineHeight;
        this.ctx.font = '12px Orbitron';
        this.ctx.fillStyle = '#fff';
        this.ctx.fillText(balanceStr, tooltipX + padding, y);

        // Click hint
        this.ctx.font = '9px Orbitron';
        this.ctx.fillStyle = '#666';
        this.ctx.fillText('Click to open Solscan', tooltipX + padding, tooltipY + boxHeight - 6);
    }

    formatNumber(num) {
        if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
        if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
        if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
        return num.toFixed(2);
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
