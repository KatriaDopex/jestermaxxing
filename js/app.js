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
        txCountEl.textContent = solana ? solana.getTxCount() : 0;
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

    // Handle holders loaded
    function onHoldersLoaded(holders) {
        console.log(`Received ${holders.length} holders`);
        visualization.loadHolders(holders);
        updateStats();
    }

    // Handle incoming transactions
    function onTransaction(tx) {
        visualization.addTransaction(
            tx.from,
            tx.to,
            tx.amount,
            tx.fromIsHolder,
            tx.toIsHolder
        );
        updateStats();
    }

    // Initialize Solana connection
    const solana = new SolanaConnection(onTransaction, onStatusChange, onHoldersLoaded);

    // Update stats periodically
    setInterval(updateStats, 1000);

    // Click anywhere to enable sound (required by browsers)
    document.body.addEventListener('click', () => {
        console.log('Click detected - audio should be enabled');
    }, { once: true });

    console.log('JESTERMAXXING Neural Network initialized');
    console.log('Click anywhere to enable transaction sounds');
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
