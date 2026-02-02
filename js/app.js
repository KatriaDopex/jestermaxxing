// JESTERMAXXING - Main Application
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('neural-canvas');
    const visualization = new NeuralVisualization(canvas);

    // DOM elements
    const statusText = document.getElementById('connection-status');
    const statusDot = document.querySelector('.status-dot');
    const txCountEl = document.getElementById('tx-count');
    const nodeCountEl = document.getElementById('node-count');
    const txFeedList = document.getElementById('tx-feed-list');

    // 24h stats elements
    const tx24hEl = document.getElementById('tx-24h');
    const holderCountEl = document.getElementById('holder-count');
    const holderChangeEl = document.getElementById('holder-change');

    // Transaction feed
    const maxFeedItems = 50;
    let feedItems = [];

    function updateStats() {
        txCountEl.textContent = solana ? solana.getTxCount() : 0;
        nodeCountEl.textContent = visualization.getNodeCount();
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
        if (!addr || addr === 'center') return 'JESTER';
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

        // Determine type
        let type = 'transfer';
        if (!tx.fromIsHolder && tx.toIsHolder) type = 'buy';
        else if (tx.fromIsHolder && !tx.toIsHolder) type = 'sell';

        // Create feed item
        const item = document.createElement('div');
        item.className = `tx-item ${type}`;
        item.onclick = () => window.open(`https://solscan.io/tx/${tx.signature}`, '_blank');

        item.innerHTML = `
            <span class="tx-type ${type}">${type}</span>
            <span class="tx-amount">${formatNumber(tx.amount)}</span>
            <div class="tx-addresses">
                <span class="tx-address ${tx.fromIsHolder ? 'holder' : ''}">${formatAddress(tx.from)}</span>
                <span class="tx-arrow">→</span>
                <span class="tx-address ${tx.toIsHolder ? 'holder' : ''}">${formatAddress(tx.to)}</span>
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
        visualization.addTransaction(
            tx.from,
            tx.to,
            tx.amount,
            tx.fromIsHolder,
            tx.toIsHolder
        );
        addToFeed(tx);
        updateStats();
    }

    // Initialize Solana connection with all callbacks
    const solana = new SolanaConnection(onTransaction, onStatusChange, onHoldersLoaded, onStatsUpdated);

    // Update stats and times periodically
    setInterval(updateStats, 1000);
    setInterval(updateFeedTimes, 10000);

    // Enable audio hint
    document.body.addEventListener('click', () => {
        console.log('Click detected - audio enabled');
    }, { once: true });

    console.log('JESTERMAXXING Neural Network initialized');
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
