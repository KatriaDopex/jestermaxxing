// JESTERMAXXING - Main Application
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('neural-canvas');
    const visualization = new NeuralVisualization(canvas);

    // DOM elements
    const statusText = document.getElementById('connection-status');
    const statusDot = document.querySelector('.status-dot');
    const txFeedList = document.getElementById('tx-feed-list');

    // 24h stats elements (top bar)
    const tx24hEl = document.getElementById('tx-24h');
    const holderCountEl = document.getElementById('holder-count');
    const holderChangeEl = document.getElementById('holder-change');

    // Bottom stats elements
    const totalHoldersEl = document.getElementById('total-holders');
    const newHolders24hEl = document.getElementById('new-holders-24h');

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
        // Top bar stats
        tx24hEl.textContent = formatNumber(stats.tx24h);
        holderCountEl.textContent = formatNumber(stats.holderCount);

        const change = stats.holderChange24h;
        holderChangeEl.textContent = Math.abs(change);
        holderChangeEl.classList.remove('positive', 'negative');

        if (change > 0) {
            holderChangeEl.classList.add('positive');
        } else if (change < 0) {
            holderChangeEl.classList.add('negative');
        }

        // Bottom stats
        totalHoldersEl.textContent = formatNumber(stats.holderCount);
        newHolders24hEl.textContent = formatNumber(Math.abs(stats.holderChange24h));

        // Color the new holders based on positive/negative
        newHolders24hEl.classList.remove('positive', 'negative');
        if (stats.holderChange24h > 0) {
            newHolders24hEl.style.color = '#44ff88';
        } else if (stats.holderChange24h < 0) {
            newHolders24hEl.style.color = '#ff4444';
        } else {
            newHolders24hEl.style.color = '#9b4dca';
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
    }

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
