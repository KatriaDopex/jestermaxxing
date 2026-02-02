// Clean Bubble Visualization with Interactivity
class NeuralVisualization {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.bubbles = [];
        this.time = 0;
        this.hoveredBubble = null;
        this.mouseX = 0;
        this.mouseY = 0;

        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.setupMouse();
        this.animate();
    }

    setupMouse() {
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
            this.checkHover();
        });

        this.canvas.addEventListener('click', () => {
            if (this.hoveredBubble) {
                window.open(`https://solscan.io/account/${this.hoveredBubble.address}`, '_blank');
            }
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.hoveredBubble = null;
            this.canvas.style.cursor = 'default';
        });
    }

    checkHover() {
        this.hoveredBubble = null;
        for (const b of this.bubbles) {
            const dx = this.mouseX - b.x;
            const dy = this.mouseY - b.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < b.size + 5) {
                this.hoveredBubble = b;
                break;
            }
        }
        this.canvas.style.cursor = this.hoveredBubble ? 'pointer' : 'default';
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
            { count: 8, radius: 160 },
            { count: 12, radius: 280 },
            { count: 10, radius: 400 }
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

        const angle = (index / total) * Math.PI * 2;
        return {
            x: this.cx + Math.cos(angle) * 350,
            y: this.cy + Math.sin(angle) * 350
        };
    }

    loadHolders(holders) {
        console.log('Loading', holders.length, 'holders');

        const sorted = [...holders].sort((a, b) => (b.balance || 0) - (a.balance || 0));

        this.bubbles = [];

        sorted.forEach((h, i) => {
            const rank = i + 1;
            const isCenter = rank === 1;

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

            let color;
            if (rank === 1) color = '#FFD700';
            else if (rank <= 5) color = '#FFA500';
            else if (rank <= 10) color = '#A855F7';
            else if (rank <= 20) color = '#06B6D4';
            else color = '#3B82F6';

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

    addTransaction(tx) {}

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

        // Connection lines
        const center = this.bubbles.find(b => b.rank === 1);
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

        // Draw bubbles - center last
        const sorted = [...this.bubbles].sort((a, b) => {
            if (a.rank === 1) return 1;
            if (b.rank === 1) return -1;
            return 0;
        });

        sorted.forEach(b => this.drawBubble(b));

        // Draw tooltip
        if (this.hoveredBubble) {
            this.drawTooltip(this.hoveredBubble);
        }
    }

    drawBubble(b) {
        const ctx = this.ctx;
        const isHovered = this.hoveredBubble === b;
        const pulse = 1 + Math.sin(b.phase) * 0.03;
        const hoverScale = isHovered ? 1.15 : 1;
        const r = b.size * pulse * hoverScale;
        const isCenter = b.rank === 1;

        // Outer glow
        const glow = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r * 2);
        glow.addColorStop(0, b.color + (isHovered ? '60' : '40'));
        glow.addColorStop(0.5, b.color + '15');
        glow.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(b.x, b.y, r * 2, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        // Center rings
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

        // Main bubble
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
        ctx.lineWidth = isHovered ? 4 : (isCenter ? 3 : 2);
        ctx.stroke();

        // Shine
        ctx.beginPath();
        ctx.arc(b.x - r * 0.3, b.y - r * 0.35, r * 0.25, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fill();

        // Rank
        const fontSize = isCenter ? 32 : Math.max(12, r * 0.55);
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillText(b.rank.toString(), b.x + 1, b.y + 1);
        ctx.fillStyle = '#fff';
        ctx.fillText(b.rank.toString(), b.x, b.y);
    }

    drawTooltip(b) {
        const ctx = this.ctx;
        const padding = 12;

        const lines = [
            `#${b.rank} Holder`,
            b.address.slice(0, 6) + '...' + b.address.slice(-4),
            this.formatNumber(b.balance) + ' tokens',
            'Click to view on Solscan'
        ];

        ctx.font = 'bold 13px Arial';
        const maxWidth = Math.max(...lines.map(l => ctx.measureText(l).width));
        const width = maxWidth + padding * 2;
        const height = lines.length * 20 + padding * 2;

        // Position tooltip
        let tx = b.x + b.size + 20;
        let ty = b.y - height / 2;

        if (tx + width > this.canvas.width - 10) {
            tx = b.x - b.size - width - 20;
        }
        if (ty < 10) ty = 10;
        if (ty + height > this.canvas.height - 150) {
            ty = this.canvas.height - height - 150;
        }

        // Background
        ctx.fillStyle = 'rgba(10, 10, 20, 0.95)';
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(tx, ty, width, height, 8);
        ctx.fill();
        ctx.stroke();

        // Text
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        lines.forEach((line, i) => {
            const y = ty + padding + i * 20;
            if (i === 0) {
                ctx.font = 'bold 14px Arial';
                ctx.fillStyle = b.color;
            } else if (i === 3) {
                ctx.font = '11px Arial';
                ctx.fillStyle = '#666';
            } else {
                ctx.font = '12px Arial';
                ctx.fillStyle = '#aaa';
            }
            ctx.fillText(line, tx + padding, y);
        });
    }

    formatNumber(n) {
        if (!n) return '0';
        if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
        if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
        if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
        return Math.floor(n).toLocaleString();
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
