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

        if (status === 'Connected') {
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

    // Demo mode: simulate transactions if no real ones come in
    let lastTxTime = Date.now();
    let demoMode = false;

    function simulateTransaction() {
        const types = ['buy', 'sell', 'transfer'];
        const type = types[Math.floor(Math.random() * types.length)];
        const amount = Math.random() * 10000;
        const fakeAddr = Math.random().toString(36).substring(2, 18);

        onTransaction({
            signature: fakeAddr + fakeAddr,
            type: type,
            amount: amount,
            from: type === 'sell' ? fakeAddr : 'center',
            to: type === 'buy' ? fakeAddr : 'center',
            timestamp: Date.now()
        });

        lastTxTime = Date.now();
    }

    // Check if we need demo mode (no transactions for 10 seconds)
    setInterval(() => {
        const timeSinceLastTx = Date.now() - lastTxTime;

        if (timeSinceLastTx > 10000 && !demoMode) {
            demoMode = true;
            console.log('Demo mode activated - simulating transactions');
        }

        if (demoMode && timeSinceLastTx > 2000) {
            simulateTransaction();
        }
    }, 2000);

    // Track real transactions to disable demo mode
    const originalOnTransaction = onTransaction;
    function wrappedOnTransaction(tx) {
        if (demoMode && !tx.signature.includes(Math.random().toString(36))) {
            demoMode = false;
            console.log('Real transaction detected - demo mode disabled');
        }
        lastTxTime = Date.now();
        originalOnTransaction(tx);
    }

    // Handle page visibility
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            // Page is hidden, could pause animations to save resources
            console.log('Page hidden');
        } else {
            console.log('Page visible');
        }
    });

    console.log('JESTERMAXXING Neural Network initialized');
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
