// JESTERMAXXING - Main Application
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('neural-canvas');
    const visualization = new NeuralVisualization(canvas);

    // DOM elements
    const statusText = document.getElementById('connection-status');
    const statusDot = document.querySelector('.status-dot');
    const txFeedList = document.getElementById('tx-feed-list');

    // Stats elements (bottom left)
    const tx24hEl = document.getElementById('tx-24h');
    const holderCountEl = document.getElementById('holder-count');
    const holderChangeEl = document.getElementById('holder-change');

    // Top accumulator elements
    const accumulatorAddressEl = document.getElementById('accumulator-address');
    const accumulatorAmountEl = document.getElementById('accumulator-amount');

    // Price display elements
    const tokenPriceEl = document.getElementById('token-price');
    const priceChangeEl = document.getElementById('price-change');
    const marketCapEl = document.getElementById('market-cap');
    const priceChartCanvas = document.getElementById('price-chart');
    let priceChartCtx = null;
    if (priceChartCanvas) {
        priceChartCtx = priceChartCanvas.getContext('2d');
    }

    // Whale alerts & confetti
    const whaleAlertsContainer = document.getElementById('whale-alerts');
    const confettiCanvas = document.getElementById('confetti-canvas');
    let confettiCtx = null;
    if (confettiCanvas) {
        confettiCtx = confettiCanvas.getContext('2d');
    }

    // Price history for chart
    let priceHistory = [];
    const maxPriceHistory = 50;
    let currentPrice = 0;

    // Confetti particles
    let confettiParticles = [];
    let confettiAnimating = false;

    // Whale threshold (in tokens)
    const WHALE_THRESHOLD = 500000; // 500K tokens

    // Transaction feed
    const maxFeedItems = 50;
    let feedItems = [];

    function updateStats() {
        // Stats are now updated via onStatsUpdated callback
    }

    function onStatusChange(status) {
        statusText.textContent = status;
        if (status === 'Live' || status === 'Polling only') {
            statusDot.classList.add('connected');
        } else {
            statusDot.classList.remove('connected');
        }
    }

    function onStatsUpdated(stats) {
        // Bottom left stats
        tx24hEl.textContent = formatNumber(stats.tx24h);
        holderCountEl.textContent = formatNumber(stats.holderCount);

        const change = stats.holderChange24h;
        holderChangeEl.textContent = (change >= 0 ? '+' : '') + change;
        holderChangeEl.classList.remove('positive', 'negative');

        if (change > 0) {
            holderChangeEl.classList.add('positive');
        } else if (change < 0) {
            holderChangeEl.classList.add('negative');
        }

        // Top accumulator
        if (stats.topAccumulator) {
            accumulatorAddressEl.textContent = formatAddress(stats.topAccumulator);
            accumulatorAddressEl.title = stats.topAccumulator; // Full address on hover
            accumulatorAddressEl.onclick = () => {
                window.open(`https://solscan.io/account/${stats.topAccumulator}`, '_blank');
            };
            accumulatorAmountEl.textContent = `+${formatNumber(stats.topAccumulatorAmount)} tokens`;
        } else {
            accumulatorAddressEl.textContent = 'Watching...';
            accumulatorAmountEl.textContent = 'Waiting for buys';
        }
    }

    function onHoldersLoaded(holders) {
        console.log(`Received ${holders.length} holders`);
        visualization.loadHolders(holders);
        updateStats();
    }

    function formatNumber(num) {
        if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
        if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
        if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
        if (typeof num === 'number') return num.toFixed(0);
        return num;
    }

    function formatAddress(addr) {
        if (!addr) return '???';
        return addr.slice(0, 4) + '...' + addr.slice(-4);
    }

    function getTimeAgo(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return seconds + 's';
        if (seconds < 3600) return Math.floor(seconds / 60) + 'm';
        return Math.floor(seconds / 3600) + 'h';
    }

    function addToFeed(tx) {
        // Remove empty message
        const emptyMsg = txFeedList.querySelector('.tx-feed-empty');
        if (emptyMsg) emptyMsg.remove();

        const type = tx.type || 'transfer';

        // Create feed item
        const item = document.createElement('div');
        item.className = `tx-item ${type}`;
        item.onclick = () => window.open(`https://solscan.io/tx/${tx.signature}`, '_blank');

        // Show AMM label for AMM address
        const fromLabel = tx.fromIsAMM ? 'AMM' : formatAddress(tx.from);
        const toLabel = tx.toIsAMM ? 'AMM' : formatAddress(tx.to);

        item.innerHTML = `
            <span class="tx-type ${type}">${type}</span>
            <span class="tx-amount">${formatNumber(tx.amount)}</span>
            <div class="tx-addresses">
                <span class="tx-address ${tx.fromIsAMM ? 'amm' : (tx.fromIsHolder ? 'holder' : '')}">${fromLabel}</span>
                <span class="tx-arrow">→</span>
                <span class="tx-address ${tx.toIsAMM ? 'amm' : (tx.toIsHolder ? 'holder' : '')}">${toLabel}</span>
            </div>
            <span class="tx-time">${getTimeAgo(tx.timestamp)}</span>
        `;

        // Insert at top
        txFeedList.insertBefore(item, txFeedList.firstChild);
        feedItems.unshift({ element: item, timestamp: tx.timestamp });

        // Limit items
        while (feedItems.length > maxFeedItems) {
            const removed = feedItems.pop();
            removed.element.remove();
        }
    }

    function updateFeedTimes() {
        feedItems.forEach(item => {
            const timeEl = item.element.querySelector('.tx-time');
            if (timeEl) {
                timeEl.textContent = getTimeAgo(item.timestamp);
            }
        });
    }

    function onTransaction(tx) {
        // Pass full transaction object to visualization
        visualization.addTransaction(tx);
        addToFeed(tx);
        updateStats();

        // Check for whale alert
        if (tx.amount >= WHALE_THRESHOLD) {
            showWhaleAlert(tx);
            if (tx.type === 'buy') {
                triggerConfetti();
            }
        }
    }

    // ===== WHALE ALERTS =====
    function showWhaleAlert(tx) {
        if (!whaleAlertsContainer) return;
        const alert = document.createElement('div');
        alert.className = `whale-alert ${tx.type}`;

        const emoji = tx.type === 'buy' ? '🐋' : '🔴';
        const action = tx.type === 'buy' ? 'WHALE BUY!' : 'WHALE SELL!';
        const address = tx.type === 'buy' ? tx.to : tx.from;

        alert.innerHTML = `
            <span class="whale-emoji">${emoji}</span>
            <span class="whale-action">${action}</span>
            <span class="whale-amount">${formatNumber(tx.amount)} tokens</span>
            <span class="whale-address">${formatAddress(address)}</span>
        `;

        whaleAlertsContainer.appendChild(alert);

        // Remove after animation
        setTimeout(() => alert.remove(), 5000);
    }

    // ===== CONFETTI =====
    function initConfetti() {
        if (!confettiCanvas) return;
        confettiCanvas.width = window.innerWidth;
        confettiCanvas.height = window.innerHeight;
    }

    function triggerConfetti() {
        if (confettiAnimating || !confettiCtx) return;

        confettiParticles = [];
        const colors = ['#ffd700', '#ff6b6b', '#4ecdc4', '#a855f7', '#00ff88', '#ff00ff'];

        // Create particles
        for (let i = 0; i < 150; i++) {
            confettiParticles.push({
                x: window.innerWidth / 2,
                y: window.innerHeight / 2,
                vx: (Math.random() - 0.5) * 20,
                vy: (Math.random() - 0.5) * 20 - 10,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: Math.random() * 10 + 5,
                rotation: Math.random() * 360,
                rotationSpeed: (Math.random() - 0.5) * 10
            });
        }

        confettiAnimating = true;
        animateConfetti();
    }

    function animateConfetti() {
        if (!confettiAnimating || !confettiCtx) return;

        confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

        let activeParticles = 0;

        confettiParticles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.5; // gravity
            p.rotation += p.rotationSpeed;
            p.vx *= 0.99; // air resistance

            if (p.y < confettiCanvas.height + 50) {
                activeParticles++;

                confettiCtx.save();
                confettiCtx.translate(p.x, p.y);
                confettiCtx.rotate(p.rotation * Math.PI / 180);
                confettiCtx.fillStyle = p.color;
                confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size / 2);
                confettiCtx.restore();
            }
        });

        if (activeParticles > 0) {
            requestAnimationFrame(animateConfetti);
        } else {
            confettiAnimating = false;
            confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        }
    }

    // ===== PRICE FETCHING =====
    async function fetchPrice() {
        try {
            // Using DexScreener API for price data
            const response = await fetch('https://api.dexscreener.com/latest/dex/tokens/6WdHhpRY7vL8SQ69bd89tAj3sk8jsjBrCLDUTZSNpump');
            const data = await response.json();

            if (data.pairs && data.pairs.length > 0) {
                const pair = data.pairs[0];
                currentPrice = parseFloat(pair.priceUsd) || 0;
                const change24h = parseFloat(pair.priceChange?.h24) || 0;
                const mcap = parseFloat(pair.marketCap) || 0;

                // Update display
                tokenPriceEl.textContent = formatPrice(currentPrice);

                priceChangeEl.textContent = (change24h >= 0 ? '+' : '') + change24h.toFixed(2) + '%';
                priceChangeEl.classList.remove('positive', 'negative');
                priceChangeEl.classList.add(change24h >= 0 ? 'positive' : 'negative');

                marketCapEl.textContent = formatUSD(mcap);

                // Add to history for chart
                priceHistory.push(currentPrice);
                if (priceHistory.length > maxPriceHistory) {
                    priceHistory.shift();
                }

                drawPriceChart();
            }
        } catch (error) {
            console.error('Failed to fetch price:', error);
        }
    }

    function formatPrice(price) {
        if (price < 0.0001) return '$' + price.toExponential(2);
        if (price < 0.01) return '$' + price.toFixed(6);
        if (price < 1) return '$' + price.toFixed(4);
        return '$' + price.toFixed(2);
    }

    function formatUSD(num) {
        if (num >= 1e9) return '$' + (num / 1e9).toFixed(2) + 'B';
        if (num >= 1e6) return '$' + (num / 1e6).toFixed(2) + 'M';
        if (num >= 1e3) return '$' + (num / 1e3).toFixed(2) + 'K';
        return '$' + num.toFixed(2);
    }

    function drawPriceChart() {
        if (priceHistory.length < 2 || !priceChartCtx || !priceChartCanvas) return;

        const width = priceChartCanvas.width;
        const height = priceChartCanvas.height;

        priceChartCtx.clearRect(0, 0, width, height);

        const min = Math.min(...priceHistory) * 0.95;
        const max = Math.max(...priceHistory) * 1.05;
        const range = max - min || 1;

        // Draw line
        priceChartCtx.beginPath();
        priceChartCtx.strokeStyle = priceHistory[priceHistory.length - 1] >= priceHistory[0] ? '#00ff88' : '#ff4444';
        priceChartCtx.lineWidth = 2;

        priceHistory.forEach((price, i) => {
            const x = (i / (priceHistory.length - 1)) * width;
            const y = height - ((price - min) / range) * height;

            if (i === 0) {
                priceChartCtx.moveTo(x, y);
            } else {
                priceChartCtx.lineTo(x, y);
            }
        });

        priceChartCtx.stroke();

        // Draw gradient fill
        const gradient = priceChartCtx.createLinearGradient(0, 0, 0, height);
        const color = priceHistory[priceHistory.length - 1] >= priceHistory[0] ? '0, 255, 136' : '255, 68, 68';
        gradient.addColorStop(0, `rgba(${color}, 0.3)`);
        gradient.addColorStop(1, `rgba(${color}, 0)`);

        priceChartCtx.lineTo(width, height);
        priceChartCtx.lineTo(0, height);
        priceChartCtx.closePath();
        priceChartCtx.fillStyle = gradient;
        priceChartCtx.fill();
    }

    // Initialize
    initConfetti();
    window.addEventListener('resize', initConfetti);

    // Fetch price initially and every 30 seconds
    fetchPrice();
    setInterval(fetchPrice, 30000);

    // Initialize Solana connection
    const solana = new SolanaConnection(onTransaction, onStatusChange, onHoldersLoaded, onStatsUpdated);

    // Update periodically
    setInterval(updateStats, 1000);
    setInterval(updateFeedTimes, 10000);

    // Audio hint
    console.log('JESTERMAXXING loaded - Click anywhere to enable sounds');

    // Show audio hint
    const audioHint = document.createElement('div');
    audioHint.className = 'audio-hint';
    audioHint.innerHTML = '🔊 Click to enable sounds';
    audioHint.style.cssText = `
        position: fixed;
        bottom: 170px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(168, 85, 247, 0.2);
        color: #a855f7;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 12px;
        font-family: 'Orbitron', sans-serif;
        z-index: 100;
        cursor: pointer;
        transition: opacity 0.5s;
    `;
    document.body.appendChild(audioHint);

    document.body.addEventListener('click', () => {
        audioHint.style.opacity = '0';
        setTimeout(() => audioHint.remove(), 500);
    }, { once: true });
});

// ===== LO-FI MUSIC PLAYER =====
let lofiAudio = null;
let isPlaying = false;

// Lo-fi streams/tracks - using free lo-fi beats
const lofiTracks = [
    'https://streams.ilovemusic.de/iloveradio17.mp3', // Lo-fi radio stream
];

function initMusic() {
    lofiAudio = new Audio();
    lofiAudio.src = lofiTracks[0];
    lofiAudio.loop = true;
    lofiAudio.volume = 0.3;
    lofiAudio.crossOrigin = 'anonymous';
}

function toggleMusic() {
    const btn = document.getElementById('music-toggle');
    const status = btn.querySelector('.music-status');

    if (!lofiAudio) {
        initMusic();
    }

    if (isPlaying) {
        lofiAudio.pause();
        isPlaying = false;
        btn.classList.remove('playing');
        status.textContent = 'Play Lo-fi';
    } else {
        lofiAudio.play().then(() => {
            isPlaying = true;
            btn.classList.add('playing');
            status.textContent = 'Now Playing';
        }).catch(err => {
            console.error('Failed to play audio:', err);
            status.textContent = 'Click again';
        });
    }
}

function setVolume(value) {
    if (lofiAudio) {
        lofiAudio.volume = value / 100;
    }
}

// Copy contract address
function copyContract() {
    const address = '6WdHhpRY7vL8SQ69bd89tAj3sk8jsjBrCLDUTZSNpump';
    navigator.clipboard.writeText(address).then(() => {
        const feedback = document.getElementById('copy-feedback');
        feedback.classList.add('show');
        setTimeout(() => feedback.classList.remove('show'), 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}
