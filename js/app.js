// JESTERMAXXING - Main Application
document.addEventListener('DOMContentLoaded', () => {
    // Initialize canvas visualization
    const canvas = document.getElementById('neural-canvas');
    const visualization = new NeuralVisualization(canvas);

    // DOM elements
    const statusText = document.getElementById('connection-status');
    const statusDot = document.querySelector('.status-dot');
    const txCountEl = document.getElementById('tx-count');
    const nodeCountEl = document.getElementById('node-count');

    // Update stats display
    function updateStats() {
        txCountEl.textContent = solana.getTxCount();
        nodeCountEl.textContent = visualization.getNodeCount();
    }

    // Handle status changes
    function onStatusChange(status) {
        statusText.textContent = status;

        if (status === 'Live' || status === 'Polling only') {
            statusDot.classList.add('connected');
        } else {
            statusDot.classList.remove('connected');
        }
    }

    // Handle incoming transactions
    function onTransaction(tx) {
        // Add transaction to visualization
        if (tx.type === 'buy') {
            visualization.addTransaction('center', tx.to, tx.amount, 'buy');
        } else if (tx.type === 'sell') {
            visualization.addTransaction(tx.from, 'center', tx.amount, 'sell');
        } else {
            visualization.addTransaction(tx.from, tx.to, tx.amount, 'transfer');
        }

        // Update stats
        updateStats();
    }

    // Initialize Solana connection
    const solana = new SolanaConnection(onTransaction, onStatusChange);

    // Update node count periodically
    setInterval(updateStats, 1000);

    // Handle page visibility - pause/resume when tab is hidden
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            console.log('Page hidden - animations continue but reduced');
        } else {
            console.log('Page visible');
        }
    });

    console.log('JESTERMAXXING Neural Network initialized - scanning blockchain live');
});

// Copy contract address to clipboard
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
