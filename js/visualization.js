// Simple Bubble Visualization
class NeuralVisualization {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.bubbles = [];
        this.centerBubble = null;
        this.time = 0;

        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Start animation
        this.animate();

        console.log('Visualization initialized');
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.cx = this.canvas.width / 2;
        this.cy = this.canvas.height / 2;

        // Reposition bubbles on resize
        if (this.centerBubble) {
            this.centerBubble.x = this.cx;
            this.centerBubble.y = this.cy;
            this.centerBubble.tx = this.cx;
            this.centerBubble.ty = this.cy;
        }
        this.repositionBubbles();
    }

    repositionBubbles() {
        const others = this.bubbles.filter(b => b.rank !== 1);
        others.forEach((b, i) => {
            const pos = this.calcPosition(i, others.length);
            b.tx = pos.x;
            b.ty = pos.y;
        });
    }

    calcPosition(index, total) {
        const angle = index * 2.399963; // Golden angle
        const minR = 130;
        const maxR = Math.min(this.canvas.width, this.canvas.height) / 2 - 60;
        const r = minR + (maxR - minR) * Math.sqrt((index + 1) / (total + 1));

        return {
            x: this.cx + Math.cos(angle) * r,
            y: this.cy + Math.sin(angle) * r
        };
    }

    loadHolders(holders) {
        console.log('loadHolders called with', holders.length, 'holders');

        // Sort by balance descending
        const sorted = [...holders].sort((a, b) => (b.balance || 0) - (a.balance || 0));

        // Clear existing
        this.bubbles = [];
        this.centerBubble = null;

        // Max balance for sizing (exclude #1)
        const maxBal = sorted.length > 1 ? sorted[1].balance : 1;

        sorted.forEach((h, i) => {
            const rank = i + 1;
            const isCenter = rank === 1;

            // Size based on balance
            let size;
            if (isCenter) {
                size = 70;
            } else {
                const ratio = Math.min(1, (h.balance || 0) / maxBal);
                size = 15 + 25 * Math.sqrt(ratio);
            }

            // Color based on rank
            let color;
            if (rank <= 1) color = '#fbbf24';
            else if (rank <= 5) color = '#f59e0b';
            else if (rank <= 10) color = '#a855f7';
            else if (rank <= 20) color = '#06b6d4';
            else color = '#3b82f6';

            const bubble = {
                address: h.address,
                balance: h.balance,
                rank: rank,
                size: size,
                color: color,
                x: this.cx,
                y: this.cy,
                tx: this.cx,
                ty: this.cy,
                phase: Math.random() * Math.PI * 2
            };

            this.bubbles.push(bubble);

            if (isCenter) {
                this.centerBubble = bubble;
                console.log('Center bubble set:', bubble.address, 'balance:', bubble.balance);
            }
        });

        // Position non-center bubbles
        this.repositionBubbles();

        console.log('Total bubbles:', this.bubbles.length);
    }

    addTransaction(tx) {
        // Simple flash effect could go here
    }

    update() {
        this.time += 0.016;

        // Move bubbles toward targets
        this.bubbles.forEach(b => {
            // Center bubble stays exactly at center
            if (b.rank === 1) {
                b.x = this.cx;
                b.y = this.cy;
            } else {
                b.x += (b.tx - b.x) * 0.05;
                b.y += (b.ty - b.y) * 0.05;
            }
            b.phase += 0.02;
        });
    }

    draw() {
        const ctx = this.ctx;

        // Background
        ctx.fillStyle = '#0a0a12';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw grid
        ctx.strokeStyle = 'rgba(100,100,150,0.04)';
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

        // Draw connections from center to others
        if (this.centerBubble) {
            ctx.strokeStyle = 'rgba(251,191,36,0.1)';
            ctx.lineWidth = 1;
            this.bubbles.forEach(b => {
                if (b.rank !== 1) {
                    ctx.beginPath();
                    ctx.moveTo(this.centerBubble.x, this.centerBubble.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.stroke();
                }
            });
        }

        // Draw bubbles (center last so it's on top)
        const sorted = [...this.bubbles].sort((a, b) => {
            if (a.rank === 1) return 1;
            if (b.rank === 1) return -1;
            return a.size - b.size;
        });

        sorted.forEach(b => {
            this.drawBubble(b);
        });
    }

    drawBubble(b) {
        const ctx = this.ctx;
        const pulse = Math.sin(b.phase) * 0.05 + 1;
        const r = b.size * pulse;
        const isCenter = b.rank === 1;

        // Glow
        const glow = ctx.createRadialGradient(b.x, b.y, r * 0.3, b.x, b.y, r * 2);
        glow.addColorStop(0, b.color + '50');
        glow.addColorStop(0.5, b.color + '20');
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(b.x, b.y, r * 2, 0, Math.PI * 2);
        ctx.fill();

        // Extra glow rings for center
        if (isCenter) {
            for (let i = 1; i <= 3; i++) {
                ctx.beginPath();
                ctx.arc(b.x, b.y, r + i * 15, 0, Math.PI * 2);
                ctx.strokeStyle = '#fbbf24';
                ctx.lineWidth = 2;
                ctx.globalAlpha = 0.3 / i;
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }

        // Main circle
        const grad = ctx.createRadialGradient(
            b.x - r * 0.3, b.y - r * 0.3, 0,
            b.x, b.y, r
        );

        if (isCenter) {
            grad.addColorStop(0, '#fff7c2');
            grad.addColorStop(0.3, '#fbbf24');
            grad.addColorStop(0.7, '#a855f7');
            grad.addColorStop(1, '#7c3aed');
        } else {
            grad.addColorStop(0, this.lighten(b.color, 50));
            grad.addColorStop(0.5, b.color);
            grad.addColorStop(1, this.darken(b.color, 30));
        }

        ctx.beginPath();
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Border
        ctx.strokeStyle = isCenter ? '#fbbf24' : b.color;
        ctx.lineWidth = isCenter ? 3 : 2;
        ctx.stroke();

        // Shine
        ctx.beginPath();
        ctx.arc(b.x - r * 0.3, b.y - r * 0.3, r * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fill();

        // Rank number
        if (r > 12) {
            const fontSize = isCenter ? 28 : Math.max(10, r * 0.5);
            ctx.font = `bold ${fontSize}px Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillText(b.rank.toString(), b.x + 1, b.y + 1);

            // Text
            ctx.fillStyle = '#ffffff';
            ctx.fillText(b.rank.toString(), b.x, b.y);
        }
    }

    lighten(hex, amt) {
        let c = hex.replace('#', '');
        if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
        const num = parseInt(c, 16);
        let r = Math.min(255, (num >> 16) + amt);
        let g = Math.min(255, ((num >> 8) & 0xff) + amt);
        let b = Math.min(255, (num & 0xff) + amt);
        return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    darken(hex, amt) {
        return this.lighten(hex, -amt);
    }

    animate() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.animate());
    }

    getNodeCount() {
        return this.bubbles.length;
    }
}

window.NeuralVisualization = NeuralVisualization;
