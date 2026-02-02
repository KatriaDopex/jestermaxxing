// Clean Bubble Visualization
class NeuralVisualization {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.bubbles = [];
        this.time = 0;

        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.animate();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.cx = this.canvas.width / 2;
        this.cy = this.canvas.height / 2;
        this.updatePositions();
    }

    updatePositions() {
        this.bubbles.forEach((b, i) => {
            if (b.rank === 1) {
                b.x = this.cx;
                b.y = this.cy;
            } else {
                const pos = this.getPosition(i - 1, this.bubbles.length - 1);
                b.x = pos.x;
                b.y = pos.y;
            }
        });
    }

    getPosition(index, total) {
        // Arrange in concentric circles
        const rings = [
            { count: 8, radius: 160 },   // Inner ring
            { count: 12, radius: 280 },  // Middle ring
            { count: 10, radius: 400 }   // Outer ring
        ];

        let accumulated = 0;
        for (const ring of rings) {
            if (index < accumulated + ring.count) {
                const posInRing = index - accumulated;
                const angle = (posInRing / ring.count) * Math.PI * 2 - Math.PI / 2;
                return {
                    x: this.cx + Math.cos(angle) * ring.radius,
                    y: this.cy + Math.sin(angle) * ring.radius
                };
            }
            accumulated += ring.count;
        }

        // Fallback for extra bubbles
        const angle = (index / total) * Math.PI * 2;
        return {
            x: this.cx + Math.cos(angle) * 350,
            y: this.cy + Math.sin(angle) * 350
        };
    }

    loadHolders(holders) {
        console.log('Loading', holders.length, 'holders');

        // Sort by balance
        const sorted = [...holders].sort((a, b) => (b.balance || 0) - (a.balance || 0));

        this.bubbles = [];

        sorted.forEach((h, i) => {
            const rank = i + 1;
            const isCenter = rank === 1;

            // Size: center is big, others based on rank
            let size;
            if (isCenter) {
                size = 80;
            } else if (rank <= 5) {
                size = 45;
            } else if (rank <= 10) {
                size = 38;
            } else if (rank <= 20) {
                size = 32;
            } else {
                size = 26;
            }

            // Colors by rank
            let color;
            if (rank === 1) color = '#FFD700';      // Gold center
            else if (rank <= 5) color = '#FFA500';  // Orange top 5
            else if (rank <= 10) color = '#A855F7'; // Purple 6-10
            else if (rank <= 20) color = '#06B6D4'; // Cyan 11-20
            else color = '#3B82F6';                 // Blue rest

            // Position
            let x, y;
            if (isCenter) {
                x = this.cx;
                y = this.cy;
            } else {
                const pos = this.getPosition(i - 1, sorted.length - 1);
                x = pos.x;
                y = pos.y;
            }

            this.bubbles.push({
                rank,
                size,
                color,
                x,
                y,
                phase: Math.random() * Math.PI * 2,
                address: h.address,
                balance: h.balance
            });
        });

        console.log('Created', this.bubbles.length, 'bubbles');
    }

    addTransaction(tx) {
        // Could add visual effects here
    }

    update() {
        this.time += 0.016;
        this.bubbles.forEach(b => {
            b.phase += 0.015;
        });
    }

    draw() {
        const ctx = this.ctx;

        // Clear
        ctx.fillStyle = '#0a0a14';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Grid
        ctx.strokeStyle = 'rgba(255,255,255,0.03)';
        ctx.lineWidth = 1;
        for (let x = 0; x < this.canvas.width; x += 60) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y < this.canvas.height; y += 60) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.canvas.width, y);
            ctx.stroke();
        }

        // Find center bubble
        const center = this.bubbles.find(b => b.rank === 1);

        // Draw connection lines from center
        if (center) {
            this.bubbles.forEach(b => {
                if (b.rank !== 1) {
                    ctx.beginPath();
                    ctx.moveTo(center.x, center.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.strokeStyle = 'rgba(255,215,0,0.15)';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            });
        }

        // Draw bubbles - center last (on top)
        const sorted = [...this.bubbles].sort((a, b) => {
            if (a.rank === 1) return 1;
            if (b.rank === 1) return -1;
            return 0;
        });

        sorted.forEach(b => this.drawBubble(b));
    }

    drawBubble(b) {
        const ctx = this.ctx;
        const pulse = 1 + Math.sin(b.phase) * 0.03;
        const r = b.size * pulse;
        const isCenter = b.rank === 1;

        // Outer glow
        const glow = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r * 2);
        glow.addColorStop(0, b.color + '40');
        glow.addColorStop(0.5, b.color + '15');
        glow.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(b.x, b.y, r * 2, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        // Center gets extra rings
        if (isCenter) {
            for (let i = 1; i <= 3; i++) {
                ctx.beginPath();
                ctx.arc(b.x, b.y, r + i * 12, 0, Math.PI * 2);
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 2;
                ctx.globalAlpha = 0.4 / i;
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }

        // Main bubble gradient
        const grad = ctx.createRadialGradient(
            b.x - r * 0.3, b.y - r * 0.3, 0,
            b.x, b.y, r
        );

        if (isCenter) {
            grad.addColorStop(0, '#FFFACD');
            grad.addColorStop(0.4, '#FFD700');
            grad.addColorStop(0.8, '#B8860B');
            grad.addColorStop(1, '#8B6914');
        } else {
            grad.addColorStop(0, this.lighten(b.color, 60));
            grad.addColorStop(0.5, b.color);
            grad.addColorStop(1, this.darken(b.color, 40));
        }

        ctx.beginPath();
        ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Border
        ctx.strokeStyle = isCenter ? '#FFD700' : b.color;
        ctx.lineWidth = isCenter ? 3 : 2;
        ctx.stroke();

        // Highlight shine
        ctx.beginPath();
        ctx.arc(b.x - r * 0.3, b.y - r * 0.35, r * 0.25, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fill();

        // Rank number
        const fontSize = isCenter ? 32 : Math.max(12, r * 0.55);
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillText(b.rank.toString(), b.x + 1, b.y + 1);

        // Text
        ctx.fillStyle = '#fff';
        ctx.fillText(b.rank.toString(), b.x, b.y);
    }

    lighten(hex, amt) {
        const num = parseInt(hex.replace('#', ''), 16);
        const r = Math.min(255, (num >> 16) + amt);
        const g = Math.min(255, ((num >> 8) & 0xff) + amt);
        const b = Math.min(255, (num & 0xff) + amt);
        return `rgb(${r},${g},${b})`;
    }

    darken(hex, amt) {
        const num = parseInt(hex.replace('#', ''), 16);
        const r = Math.max(0, (num >> 16) - amt);
        const g = Math.max(0, ((num >> 8) & 0xff) - amt);
        const b = Math.max(0, (num & 0xff) - amt);
        return `rgb(${r},${g},${b})`;
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
