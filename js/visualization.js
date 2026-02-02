// Clean Bubble Visualization with Lasers and New Buyers
class NeuralVisualization {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.bubbles = [];
        this.lasers = [];
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
        const topHolders = this.bubbles.filter(b => b.rank && b.rank <= 30);
        topHolders.forEach((b, i) => {
            if (b.rank === 1) {
                b.x = this.cx;
                b.y = this.cy;
                b.tx = this.cx;
                b.ty = this.cy;
            } else {
                const pos = this.getPosition(b.rank - 2, 29);
                b.tx = pos.x;
                b.ty = pos.y;
            }
        });
    }

    getPosition(index, total) {
        // Two rings for 19 holders (excluding center #1)
        // Inner ring: 7 holders (#2-8)
        // Outer ring: 12 holders (#9-20)
        const rings = [
            { count: 7, radius: 130 },   // Inner ring
            { count: 12, radius: 230 }   // Outer ring
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

        // Fallback for any extra
        const angle = (index / total) * Math.PI * 2;
        return {
            x: this.cx + Math.cos(angle) * 280,
            y: this.cy + Math.sin(angle) * 280
        };
    }

    loadHolders(holders) {
        console.log('Loading', holders.length, 'holders');

        // Use rank from API, sort by rank to ensure correct order
        const sorted = [...holders].sort((a, b) => (a.rank || 999) - (b.rank || 999));

        console.log('Sorted holders:', sorted.map(h => ({ rank: h.rank, balance: h.balance })));

        this.bubbles = [];

        sorted.forEach((h) => {
            const rank = h.rank; // Use rank from API
            const isCenter = rank === 1;

            // Smaller sizes
            let size;
            if (isCenter) {
                size = 65;
            } else if (rank <= 5) {
                size = 38;
            } else if (rank <= 10) {
                size = 32;
            } else if (rank <= 20) {
                size = 26;
            } else {
                size = 22;
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
                const pos = this.getPosition(rank - 2, 29);
                x = pos.x;
                y = pos.y;
            }

            this.bubbles.push({
                rank,
                size,
                color,
                x,
                y,
                tx: x,
                ty: y,
                phase: Math.random() * Math.PI * 2,
                address: h.address,
                balance: h.balance,
                isNew: false
            });
        });

        console.log('Created', this.bubbles.length, 'bubbles');
    }

    addTransaction(tx) {
        // Find source and target bubbles
        let fromBubble = this.bubbles.find(b => b.address === tx.from);
        let toBubble = this.bubbles.find(b => b.address === tx.to);

        // If buying from AMM and buyer not in top 30, add them as new node
        if (tx.type === 'buy' && !toBubble && fromBubble && fromBubble.rank === 1) {
            toBubble = this.addNewBuyer(tx.to, tx.receiverBalance);
        }

        // Create laser effect
        if (fromBubble && toBubble) {
            this.createLaser(fromBubble, toBubble, tx.type);
        } else if (fromBubble) {
            // Laser going outward to edge
            const angle = Math.random() * Math.PI * 2;
            const edgeX = this.cx + Math.cos(angle) * 400;
            const edgeY = this.cy + Math.sin(angle) * 400;
            this.createLaserToPoint(fromBubble.x, fromBubble.y, edgeX, edgeY, tx.type);
        } else if (toBubble) {
            // Laser coming from edge
            const angle = Math.random() * Math.PI * 2;
            const edgeX = this.cx + Math.cos(angle) * 400;
            const edgeY = this.cy + Math.sin(angle) * 400;
            this.createLaserToPoint(edgeX, edgeY, toBubble.x, toBubble.y, tx.type);
        }
    }

    addNewBuyer(address, balance) {
        // Position at random edge, will animate in
        const angle = Math.random() * Math.PI * 2;
        const startDist = 350;
        const endDist = 320;

        const newBubble = {
            rank: null,
            size: 18,
            color: '#22C55E', // Green for new buyers
            x: this.cx + Math.cos(angle) * startDist,
            y: this.cy + Math.sin(angle) * startDist,
            tx: this.cx + Math.cos(angle) * endDist,
            ty: this.cy + Math.sin(angle) * endDist,
            phase: Math.random() * Math.PI * 2,
            address: address,
            balance: balance,
            isNew: true,
            birth: Date.now()
        };

        this.bubbles.push(newBubble);
        console.log('Added new buyer:', address.slice(0, 8));

        // Remove after 60 seconds
        setTimeout(() => {
            const idx = this.bubbles.indexOf(newBubble);
            if (idx > -1) this.bubbles.splice(idx, 1);
        }, 60000);

        return newBubble;
    }

    createLaser(from, to, type) {
        const color = type === 'buy' ? '#22C55E' : type === 'sell' ? '#EF4444' : '#A855F7';

        this.lasers.push({
            x1: from.x,
            y1: from.y,
            x2: to.x,
            y2: to.y,
            progress: 0,
            color: color,
            width: 3
        });
    }

    createLaserToPoint(x1, y1, x2, y2, type) {
        const color = type === 'buy' ? '#22C55E' : type === 'sell' ? '#EF4444' : '#A855F7';

        this.lasers.push({
            x1, y1, x2, y2,
            progress: 0,
            color: color,
            width: 3
        });
    }

    update() {
        this.time += 0.016;

        // Update bubble positions (smooth movement)
        this.bubbles.forEach(b => {
            if (b.tx !== undefined) {
                b.x += (b.tx - b.x) * 0.08;
                b.y += (b.ty - b.y) * 0.08;
            }
            b.phase += 0.015;
        });

        // Update lasers
        this.lasers = this.lasers.filter(l => {
            l.progress += 0.04;
            return l.progress < 1.5;
        });

        // Fade out old new buyers
        const now = Date.now();
        this.bubbles.forEach(b => {
            if (b.isNew && b.birth) {
                const age = now - b.birth;
                if (age > 50000) {
                    b.alpha = 1 - (age - 50000) / 10000;
                } else {
                    b.alpha = 1;
                }
            }
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

        // Connection lines from center
        const center = this.bubbles.find(b => b.rank === 1);
        if (center) {
            this.bubbles.forEach(b => {
                if (b.rank !== 1 && b.rank) {
                    ctx.beginPath();
                    ctx.moveTo(center.x, center.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.strokeStyle = 'rgba(255,215,0,0.1)';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            });
        }

        // Draw lasers
        this.drawLasers();

        // Draw bubbles - center last
        const sorted = [...this.bubbles].sort((a, b) => {
            if (a.rank === 1) return 1;
            if (b.rank === 1) return -1;
            if (a.isNew && !b.isNew) return 1;
            if (!a.isNew && b.isNew) return -1;
            return 0;
        });

        sorted.forEach(b => this.drawBubble(b));

        // Tooltip
        if (this.hoveredBubble) {
            this.drawTooltip(this.hoveredBubble);
        }
    }

    drawLasers() {
        const ctx = this.ctx;

        this.lasers.forEach(l => {
            const progress = Math.min(1, l.progress);
            const fade = l.progress > 1 ? 1 - (l.progress - 1) * 2 : 1;

            // Current position of laser head
            const headX = l.x1 + (l.x2 - l.x1) * progress;
            const headY = l.y1 + (l.y2 - l.y1) * progress;

            // Laser trail
            const tailProgress = Math.max(0, progress - 0.3);
            const tailX = l.x1 + (l.x2 - l.x1) * tailProgress;
            const tailY = l.y1 + (l.y2 - l.y1) * tailProgress;

            // Main beam
            ctx.beginPath();
            ctx.moveTo(tailX, tailY);
            ctx.lineTo(headX, headY);
            ctx.strokeStyle = l.color;
            ctx.lineWidth = l.width;
            ctx.globalAlpha = 0.9 * fade;
            ctx.stroke();

            // Glow
            ctx.lineWidth = l.width * 3;
            ctx.globalAlpha = 0.3 * fade;
            ctx.stroke();

            // Bright head
            ctx.beginPath();
            ctx.arc(headX, headY, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.globalAlpha = fade;
            ctx.fill();

            // Impact burst at end
            if (progress >= 1 && l.progress < 1.3) {
                const burstAlpha = 1 - (l.progress - 1) / 0.3;
                const burstSize = 10 + (l.progress - 1) * 50;
                ctx.beginPath();
                ctx.arc(l.x2, l.y2, burstSize, 0, Math.PI * 2);
                ctx.fillStyle = l.color;
                ctx.globalAlpha = burstAlpha * 0.3;
                ctx.fill();
            }
        });

        ctx.globalAlpha = 1;
    }

    drawBubble(b) {
        const ctx = this.ctx;
        const isHovered = this.hoveredBubble === b;
        const pulse = 1 + Math.sin(b.phase) * 0.03;
        const hoverScale = isHovered ? 1.15 : 1;
        const r = b.size * pulse * hoverScale;
        const isCenter = b.rank === 1;
        const alpha = b.alpha !== undefined ? b.alpha : 1;

        if (alpha <= 0) return;

        ctx.globalAlpha = alpha;

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
                ctx.arc(b.x, b.y, r + i * 10, 0, Math.PI * 2);
                ctx.strokeStyle = '#FFD700';
                ctx.lineWidth = 2;
                ctx.globalAlpha = (0.4 / i) * alpha;
                ctx.stroke();
            }
            ctx.globalAlpha = alpha;
        }

        // New buyer pulse effect
        if (b.isNew) {
            const pulseSize = r * (1.5 + Math.sin(b.phase * 2) * 0.3);
            ctx.beginPath();
            ctx.arc(b.x, b.y, pulseSize, 0, Math.PI * 2);
            ctx.strokeStyle = b.color;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.3 * alpha;
            ctx.stroke();
            ctx.globalAlpha = alpha;
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

        // Rank or "NEW"
        const label = b.rank ? b.rank.toString() : 'NEW';
        const fontSize = isCenter ? 26 : (b.isNew ? 10 : Math.max(11, r * 0.5));
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillText(label, b.x + 1, b.y + 1);
        ctx.fillStyle = '#fff';
        ctx.fillText(label, b.x, b.y);

        ctx.globalAlpha = 1;
    }

    drawTooltip(b) {
        const ctx = this.ctx;
        const padding = 12;

        const lines = [
            b.rank ? `#${b.rank} Holder` : 'New Buyer',
            b.address.slice(0, 6) + '...' + b.address.slice(-4),
            this.formatNumber(b.balance) + ' tokens',
            'Click to view on Solscan'
        ];

        ctx.font = 'bold 13px Arial';
        const maxWidth = Math.max(...lines.map(l => ctx.measureText(l).width));
        const width = maxWidth + padding * 2;
        const height = lines.length * 20 + padding * 2;

        let tx = b.x + b.size + 20;
        let ty = b.y - height / 2;

        if (tx + width > this.canvas.width - 10) {
            tx = b.x - b.size - width - 20;
        }
        if (ty < 10) ty = 10;
        if (ty + height > this.canvas.height - 150) {
            ty = this.canvas.height - height - 150;
        }

        ctx.fillStyle = 'rgba(10, 10, 20, 0.95)';
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(tx, ty, width, height, 8);
        ctx.fill();
        ctx.stroke();

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
