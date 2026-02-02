// Neural Network Visualization Engine - Bubblemap Style
class NeuralVisualization {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.nodes = new Map();
        this.traces = [];
        this.particles = [];
        this.ammNode = null; // The AMM (top holder) is the center
        this.audioContext = null;
        this.soundEnabled = false;
        this.hoveredNode = null;
        this.mouseX = 0;
        this.mouseY = 0;
        this.maxBalance = 0;

        // Colors - Modern glass theme
        this.colors = {
            purple: '#a855f7',
            gold: '#fbbf24',
            red: '#ef4444',
            green: '#22c55e',
            cyan: '#06b6d4',
            blue: '#3b82f6',
            background: '#0f0f1a'
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
            // Enable audio on first click
            if (!this.soundEnabled && this.audioContext) {
                this.audioContext.resume();
                this.soundEnabled = true;
                console.log('Audio enabled via click');
            }

            if (this.hoveredNode && !this.hoveredNode.isAMM) {
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

            if (dist < node.radius + 5) {
                found = node;
            }
        });

        this.hoveredNode = found;
        this.canvas.style.cursor = found && !found.isAMM ? 'pointer' : 'default';
    }

    initAudio() {
        // Create audio context immediately
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            // Start suspended, will resume on user interaction
            console.log('Audio context created, state:', this.audioContext.state);

            // Try to resume on any user interaction
            const resumeAudio = () => {
                if (this.audioContext && this.audioContext.state === 'suspended') {
                    this.audioContext.resume().then(() => {
                        this.soundEnabled = true;
                        console.log('Audio resumed');
                    });
                } else {
                    this.soundEnabled = true;
                }
            };

            document.addEventListener('click', resumeAudio, { once: true });
            document.addEventListener('touchstart', resumeAudio, { once: true });
            document.addEventListener('keydown', resumeAudio, { once: true });
        } catch (e) {
            console.error('Failed to create audio context:', e);
        }
    }

    playTransactionSound(amount = 1, type = 'transfer') {
        if (!this.audioContext) {
            console.log('No audio context');
            return;
        }

        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        try {
            const ctx = this.audioContext;
            const now = ctx.currentTime;

            // Create oscillators for sci-fi blip
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
                // Ascending blip for buys
                osc1.frequency.setValueAtTime(baseFreq, now);
                osc1.frequency.exponentialRampToValueAtTime(baseFreq * 2.5, now + 0.08);
                osc2.frequency.setValueAtTime(baseFreq * 1.5, now);
                osc2.frequency.exponentialRampToValueAtTime(baseFreq * 3.5, now + 0.08);
            } else if (type === 'sell') {
                // Descending blip for sells
                osc1.frequency.setValueAtTime(baseFreq * 2, now);
                osc1.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, now + 0.1);
                osc2.frequency.setValueAtTime(baseFreq * 2.5, now);
                osc2.frequency.exponentialRampToValueAtTime(baseFreq * 0.8, now + 0.1);
            } else {
                // Neutral blip for transfers
                osc1.frequency.setValueAtTime(baseFreq, now);
                osc1.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.06);
                osc2.frequency.setValueAtTime(baseFreq * 1.2, now);
                osc2.frequency.exponentialRampToValueAtTime(baseFreq * 1.8, now + 0.06);
            }

            // Volume envelope - louder for bigger transactions
            const volume = Math.min(0.2, 0.08 + Math.log10(amount + 1) / 30);
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(volume, now + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

            osc1.start(now);
            osc2.start(now);
            osc1.stop(now + 0.2);
            osc2.stop(now + 0.2);

            console.log(`Playing ${type} sound, volume: ${volume.toFixed(3)}`);
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
            const pos = this.getHolderPosition(index, holderNodes.length, node.balance);
            node.targetX = pos.x;
            node.targetY = pos.y;
        });
    }

    getHolderPosition(index, total, balance) {
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));
        const angle = index * goldenAngle;

        const margin = 150;
        const maxRadius = Math.min(this.canvas.width, this.canvas.height) / 2 - margin;
        const minRadius = 100;

        const t = (index + 1) / (total + 1);
        const radius = minRadius + (maxRadius - minRadius) * Math.sqrt(t);

        const jitter = 15;
        const jitterX = (Math.sin(index * 7.3) * jitter);
        const jitterY = (Math.cos(index * 11.7) * jitter);

        return {
            x: this.centerX + Math.cos(angle) * radius + jitterX,
            y: this.centerY + Math.sin(angle) * radius + jitterY
        };
    }

    getNodeRadius(balance, rank, isAMM) {
        if (isAMM) return 50; // AMM is always big

        if (!this.maxBalance || this.maxBalance === 0) return 12;

        const ratio = balance / this.maxBalance;
        const minRadius = 8;
        const maxRadius = 40;

        return minRadius + (maxRadius - minRadius) * Math.sqrt(ratio);
    }

    loadHolders(holders) {
        console.log(`Loading ${holders.length} holders into visualization`);

        // Find max balance (excluding AMM for scaling)
        const nonAMMHolders = holders.filter(h => !h.isAMM);
        this.maxBalance = nonAMMHolders.length > 0 ?
            Math.max(...nonAMMHolders.map(h => h.balance || 0)) : 1;

        let holderIndex = 0;

        holders.forEach((holder) => {
            if (holder.isAMM) {
                // AMM is the central node
                this.ammNode = {
                    id: holder.address,
                    x: this.centerX,
                    y: this.centerY,
                    targetX: this.centerX,
                    targetY: this.centerY,
                    vx: 0,
                    vy: 0,
                    radius: 50,
                    baseRadius: 50,
                    color: this.colors.gold,
                    alpha: 1,
                    pulsePhase: 0,
                    lastActive: Date.now(),
                    activity: 0,
                    isHolder: true,
                    isAMM: true,
                    rank: 1,
                    balance: holder.balance,
                    label: 'AMM'
                };
                this.nodes.set(holder.address, this.ammNode);
            } else {
                const pos = this.getHolderPosition(holderIndex, nonAMMHolders.length, holder.balance);
                const radius = this.getNodeRadius(holder.balance, holder.rank, false);

                // Color based on rank
                const color = holder.rank <= 5 ? this.colors.gold :
                             holder.rank <= 15 ? this.colors.purple :
                             holder.rank <= 40 ? this.colors.blue :
                             holder.rank <= 70 ? this.colors.cyan : '#8b5cf6';

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
                    rank: holder.rank,
                    balance: holder.balance,
                    label: `#${holder.rank}`
                };

                this.nodes.set(holder.address, node);
                holderIndex++;
            }
        });

        console.log(`Created ${this.nodes.size} nodes, AMM: ${this.ammNode ? 'yes' : 'no'}`);
    }

    getOrCreateNode(address, isHolder = false) {
        if (this.nodes.has(address)) {
            const node = this.nodes.get(address);
            node.lastActive = Date.now();
            node.activity++;
            node.radius = Math.min(node.baseRadius * 1.5, node.baseRadius + 10);
            return node;
        }

        // Create new node for non-holder (buyer/seller not in top 100)
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.min(this.canvas.width, this.canvas.height) / 2 - 60;
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
            radius: 10,
            baseRadius: 10,
            color: this.colors.cyan, // New buyers are cyan
            alpha: 1,
            pulsePhase: Math.random() * Math.PI * 2,
            lastActive: Date.now(),
            activity: 1,
            isHolder: false,
            isAMM: false,
            rank: null,
            balance: null,
            label: address.slice(0, 4) + '..' + address.slice(-3)
        };

        this.nodes.set(address, node);
        return node;
    }

    addTransaction(tx) {
        const fromNode = this.getOrCreateNode(tx.from, tx.fromIsHolder);
        const toNode = this.getOrCreateNode(tx.to, tx.toIsHolder);

        // Color new buyer nodes
        if (tx.type === 'buy' && !tx.toIsHolder) {
            toNode.color = this.colors.green; // Buyers are green
        } else if (tx.type === 'sell' && !tx.fromIsHolder) {
            fromNode.color = this.colors.red; // Sellers are red
        }

        this.createTrace(fromNode, toNode, tx.amount, tx.type);
        this.createBurst(toNode.x, toNode.y, tx.type);
        this.playTransactionSound(tx.amount, tx.type);
    }

    createTrace(fromNode, toNode, amount = 1, type = 'transfer') {
        const color = type === 'buy' ? this.colors.green :
                      type === 'sell' ? this.colors.red : this.colors.gold;

        const intensity = Math.min(1, Math.log10(amount + 1) / 5);

        const trace = {
            from: fromNode,
            to: toNode,
            progress: 0,
            speed: 0.025 + Math.random() * 0.015,
            color: color,
            intensity: 0.6 + intensity * 0.4,
            width: 2 + intensity * 4,
            particles: []
        };

        const particleCount = 6 + Math.floor(intensity * 10);
        for (let i = 0; i < particleCount; i++) {
            trace.particles.push({
                offset: i / particleCount,
                size: 2 + Math.random() * 3,
                speed: 0.7 + Math.random() * 0.3
            });
        }

        this.traces.push(trace);
    }

    createBurst(x, y, type) {
        const color = type === 'buy' ? this.colors.green :
                      type === 'sell' ? this.colors.red : this.colors.gold;

        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const speed = 2.5 + Math.random() * 2.5;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: 2 + Math.random() * 2,
                color: color,
                alpha: 0.9,
                decay: 0.03 + Math.random() * 0.02
            });
        }
    }

    update() {
        const now = Date.now();

        this.nodes.forEach((node, id) => {
            const dx = node.targetX - node.x;
            const dy = node.targetY - node.y;
            node.x += dx * 0.04;
            node.y += dy * 0.04;

            if (!node.isAMM) {
                node.x += node.vx || 0;
                node.y += node.vy || 0;
                if (node.vx) node.vx *= 0.995;
                if (node.vy) node.vy *= 0.995;
            }

            node.pulsePhase += 0.02;

            if (node.radius > node.baseRadius) {
                node.radius = node.baseRadius + (node.radius - node.baseRadius) * 0.95;
            }

            // Fade out non-holder nodes after 60 seconds
            if (!node.isHolder && !node.isAMM) {
                const timeSinceActive = now - node.lastActive;
                if (timeSinceActive > 60000) {
                    node.alpha = Math.max(0.1, 1 - (timeSinceActive - 60000) / 60000);
                }
                if (timeSinceActive > 180000 && node.alpha < 0.2) {
                    this.nodes.delete(id);
                }
            }
        });

        this.traces = this.traces.filter(trace => {
            trace.progress += trace.speed;
            trace.particles.forEach(p => {
                p.offset += trace.speed * p.speed;
                if (p.offset > 1) p.offset -= 1;
            });
            return trace.progress < 1.3;
        });

        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.96;
            p.vy *= 0.96;
            p.alpha -= p.decay;
            return p.alpha > 0;
        });
    }

    draw() {
        // Clear canvas
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Subtle radial gradient
        const bgGradient = this.ctx.createRadialGradient(
            this.centerX, this.centerY, 0,
            this.centerX, this.centerY, Math.max(this.canvas.width, this.canvas.height) / 2
        );
        bgGradient.addColorStop(0, 'rgba(168, 85, 247, 0.03)');
        bgGradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.02)');
        bgGradient.addColorStop(1, 'transparent');
        this.ctx.fillStyle = bgGradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw connection lines from AMM to holders
        if (this.ammNode) {
            this.ctx.lineWidth = 0.5;
            this.nodes.forEach(node => {
                if (node.isHolder && !node.isAMM && node.alpha > 0.5) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(this.ammNode.x, this.ammNode.y);
                    this.ctx.lineTo(node.x, node.y);
                    this.ctx.strokeStyle = `rgba(168, 85, 247, ${node.alpha * 0.05})`;
                    this.ctx.stroke();
                }
            });
        }

        // Draw traces
        this.traces.forEach(trace => {
            const progress = Math.min(1, trace.progress);
            const fadeOut = trace.progress > 1 ? 1 - (trace.progress - 1) * 3 : 1;

            this.ctx.beginPath();
            this.ctx.moveTo(trace.from.x, trace.from.y);

            const currentX = trace.from.x + (trace.to.x - trace.from.x) * progress;
            const currentY = trace.from.y + (trace.to.y - trace.from.y) * progress;

            this.ctx.lineTo(currentX, currentY);
            this.ctx.strokeStyle = trace.color;
            this.ctx.lineWidth = trace.width;
            this.ctx.globalAlpha = trace.intensity * fadeOut * 0.9;
            this.ctx.stroke();

            trace.particles.forEach(p => {
                if (p.offset <= progress) {
                    const px = trace.from.x + (trace.to.x - trace.from.x) * p.offset;
                    const py = trace.from.y + (trace.to.y - trace.from.y) * p.offset;

                    this.ctx.beginPath();
                    this.ctx.arc(px, py, p.size, 0, Math.PI * 2);
                    this.ctx.fillStyle = trace.color;
                    this.ctx.globalAlpha = trace.intensity * fadeOut;
                    this.ctx.fill();
                }
            });
        });
        this.ctx.globalAlpha = 1;

        // Draw nodes (excluding AMM - that's the GIF)
        this.nodes.forEach(node => {
            if (node.isAMM) return; // Skip AMM, GIF is shown there

            const isHovered = this.hoveredNode === node;
            const pulse = Math.sin(node.pulsePhase) * 0.05 + 1;
            const hoverScale = isHovered ? 1.15 : 1;
            const radius = node.radius * pulse * hoverScale;

            this.ctx.globalAlpha = node.alpha;

            // Subtle glow for top holders or hovered
            if (isHovered || (node.isHolder && node.rank <= 10)) {
                const glowGradient = this.ctx.createRadialGradient(
                    node.x, node.y, radius * 0.8,
                    node.x, node.y, radius * 1.4
                );
                glowGradient.addColorStop(0, node.color + '25');
                glowGradient.addColorStop(1, 'transparent');
                this.ctx.fillStyle = glowGradient;
                this.ctx.beginPath();
                this.ctx.arc(node.x, node.y, radius * 1.4, 0, Math.PI * 2);
                this.ctx.fill();
            }

            // Glass bubble gradient
            const bubbleGradient = this.ctx.createRadialGradient(
                node.x - radius * 0.3, node.y - radius * 0.3, 0,
                node.x, node.y, radius
            );
            bubbleGradient.addColorStop(0, this.adjustColor(node.color, 50) + 'bb');
            bubbleGradient.addColorStop(0.5, node.color + '88');
            bubbleGradient.addColorStop(1, this.adjustColor(node.color, -40) + '77');

            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
            this.ctx.fillStyle = bubbleGradient;
            this.ctx.fill();

            // Rim
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
            this.ctx.strokeStyle = node.color + '50';
            this.ctx.lineWidth = 1.5;
            this.ctx.stroke();

            // Highlight
            this.ctx.beginPath();
            this.ctx.ellipse(
                node.x - radius * 0.25,
                node.y - radius * 0.25,
                radius * 0.3,
                radius * 0.18,
                -Math.PI / 4,
                0, Math.PI * 2
            );
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            this.ctx.fill();

            // Top 5 ring
            if (node.isHolder && node.rank && node.rank <= 5) {
                this.ctx.beginPath();
                this.ctx.arc(node.x, node.y, radius + 3, 0, Math.PI * 2);
                this.ctx.strokeStyle = this.colors.gold + '70';
                this.ctx.lineWidth = 1.5;
                this.ctx.stroke();
            }
        });
        this.ctx.globalAlpha = 1;

        // Draw burst particles
        this.particles.forEach(p => {
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = p.alpha * 0.8;
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1;

        // Tooltip
        if (this.hoveredNode && !this.hoveredNode.isAMM) {
            this.drawTooltip(this.hoveredNode);
        }
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

        const addressStr = node.id;
        const rankStr = node.rank ? `Rank #${node.rank}` : 'Outside Top 100';

        this.ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif';
        const rankWidth = this.ctx.measureText(rankStr).width;

        this.ctx.font = '10px monospace';
        const addressWidth = this.ctx.measureText(addressStr).width;

        this.ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
        const balanceWidth = this.ctx.measureText(balanceStr).width;

        const boxWidth = Math.max(rankWidth, addressWidth, balanceWidth) + padding * 2;
        const boxHeight = lineHeight * 3 + padding * 2 + 10;

        let tooltipX = node.x + node.radius + 15;
        let tooltipY = node.y - boxHeight / 2;

        if (tooltipX + boxWidth > this.canvas.width - 10) {
            tooltipX = node.x - node.radius - boxWidth - 15;
        }
        if (tooltipY < 10) tooltipY = 10;
        if (tooltipY + boxHeight > this.canvas.height - 160) {
            tooltipY = this.canvas.height - boxHeight - 160;
        }

        this.ctx.fillStyle = 'rgba(15, 15, 30, 0.92)';
        this.ctx.strokeStyle = node.color + '50';
        this.ctx.lineWidth = 1;

        this.ctx.beginPath();
        this.ctx.roundRect(tooltipX, tooltipY, boxWidth, boxHeight, 8);
        this.ctx.fill();
        this.ctx.stroke();

        let y = tooltipY + padding + 12;

        this.ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif';
        this.ctx.fillStyle = node.color;
        this.ctx.textAlign = 'left';
        this.ctx.fillText(rankStr, tooltipX + padding, y);

        y += lineHeight;
        this.ctx.font = '10px monospace';
        this.ctx.fillStyle = '#777';
        this.ctx.fillText(addressStr, tooltipX + padding, y);

        y += lineHeight;
        this.ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
        this.ctx.fillStyle = '#eee';
        this.ctx.fillText(balanceStr, tooltipX + padding, y);

        this.ctx.font = '9px -apple-system, BlinkMacSystemFont, sans-serif';
        this.ctx.fillStyle = '#555';
        this.ctx.fillText('Click to view on Solscan', tooltipX + padding, tooltipY + boxHeight - 8);
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
