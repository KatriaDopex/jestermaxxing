// Solana/Helius Connection for JESTERMAXXING Token
// Uses both WebSocket subscription AND polling for reliability
class SolanaConnection {
    constructor(onTransaction, onStatusChange) {
        this.onTransaction = onTransaction;
        this.onStatusChange = onStatusChange;
        this.ws = null;
        this.subscriptionId = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.txCount = 0;
        this.seenSignatures = new Set();
        this.lastSignature = null;

        // JESTERMAXXING token contract
        this.tokenMint = '6WdHhpRY7vL8SQ69bd89tAj3sk8jsjBrCLDUTZSNpump';

        // Helius endpoints
        this.apiKey = 'c32483f4-b57e-4001-92bc-29c93ce8fc8a';
        this.wsEndpoint = `wss://mainnet.helius-rpc.com/?api-key=${this.apiKey}`;
        this.httpEndpoint = `https://mainnet.helius-rpc.com/?api-key=${this.apiKey}`;

        this.connect();
        this.startPolling();
    }

    connect() {
        this.onStatusChange('Connecting...');

        try {
            this.ws = new WebSocket(this.wsEndpoint);

            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.reconnectAttempts = 0;
                this.onStatusChange('Live');
                this.subscribe();
            };

            this.ws.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data));
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

            this.ws.onclose = () => {
                console.log('WebSocket closed');
                this.onStatusChange('Reconnecting...');
                this.reconnect();
            };
        } catch (error) {
            console.error('Failed to connect:', error);
            this.onStatusChange('Polling mode');
        }
    }

    subscribe() {
        // Subscribe to logs mentioning the token mint
        const subscribeMsg = {
            jsonrpc: '2.0',
            id: 1,
            method: 'logsSubscribe',
            params: [
                { mentions: [this.tokenMint] },
                { commitment: 'confirmed' }
            ]
        };

        this.ws.send(JSON.stringify(subscribeMsg));
        console.log('Subscribed to token logs:', this.tokenMint);
    }

    handleMessage(data) {
        if (data.result !== undefined && data.id === 1) {
            this.subscriptionId = data.result;
            console.log('Subscription ID:', this.subscriptionId);
            return;
        }

        if (data.method === 'logsNotification') {
            const result = data.params?.result;
            if (result) {
                this.processTransaction(result.value?.signature, result.value?.logs);
            }
        }
    }

    // Poll for recent transactions as backup
    async startPolling() {
        const poll = async () => {
            try {
                const response = await fetch(this.httpEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 1,
                        method: 'getSignaturesForAddress',
                        params: [this.tokenMint, { limit: 10 }]
                    })
                });

                const data = await response.json();
                if (data.result) {
                    // Process in reverse to maintain chronological order
                    const newTxs = data.result
                        .filter(tx => !this.seenSignatures.has(tx.signature))
                        .reverse();

                    for (const tx of newTxs) {
                        if (!tx.err) {
                            await this.fetchAndProcessTransaction(tx.signature);
                        }
                    }
                }
            } catch (error) {
                console.error('Polling error:', error);
            }
        };

        // Initial poll
        await poll();

        // Poll every 3 seconds
        setInterval(poll, 3000);
    }

    async fetchAndProcessTransaction(signature) {
        if (this.seenSignatures.has(signature)) return;

        try {
            // Use Helius parsed transaction API for better data
            const response = await fetch(this.httpEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getTransaction',
                    params: [signature, { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }]
                })
            });

            const data = await response.json();
            if (data.result) {
                this.processFullTransaction(signature, data.result);
            }
        } catch (error) {
            console.error('Failed to fetch transaction:', error);
            // Fallback: still process without full details
            this.processTransaction(signature, []);
        }
    }

    processFullTransaction(signature, tx) {
        if (this.seenSignatures.has(signature)) return;
        this.seenSignatures.add(signature);

        // Keep set from growing too large
        if (this.seenSignatures.size > 1000) {
            const arr = Array.from(this.seenSignatures);
            this.seenSignatures = new Set(arr.slice(-500));
        }

        let type = 'transfer';
        let amount = 1;
        let fromAddr = signature.slice(0, 12);
        let toAddr = signature.slice(12, 24);

        // Parse transaction for swap/transfer details
        const meta = tx.meta;
        const message = tx.transaction?.message;

        if (meta && message) {
            // Check for token balance changes
            const preBalances = meta.preTokenBalances || [];
            const postBalances = meta.postTokenBalances || [];

            // Find JESTERMAXXING token transfers
            for (const post of postBalances) {
                if (post.mint === this.tokenMint) {
                    const pre = preBalances.find(p => p.accountIndex === post.accountIndex);
                    const preAmount = pre ? parseFloat(pre.uiTokenAmount?.uiAmount || 0) : 0;
                    const postAmount = parseFloat(post.uiTokenAmount?.uiAmount || 0);
                    const diff = postAmount - preAmount;

                    if (Math.abs(diff) > 0) {
                        amount = Math.abs(diff);
                        toAddr = post.owner?.slice(0, 12) || toAddr;

                        // Positive diff = received tokens (buy), negative = sent (sell)
                        type = diff > 0 ? 'buy' : 'sell';
                    }
                }
            }

            // Check logs for DEX interactions
            const logs = meta.logMessages || [];
            const logString = logs.join(' ').toLowerCase();
            if (logString.includes('raydium') || logString.includes('jupiter') ||
                logString.includes('orca') || logString.includes('swap')) {
                // It's a swap, type already determined by balance change
            }
        }

        this.txCount++;

        this.onTransaction({
            signature: signature,
            type: type,
            amount: amount,
            from: type === 'sell' ? fromAddr : 'center',
            to: type === 'buy' ? toAddr : 'center',
            timestamp: Date.now()
        });

        console.log(`TX #${this.txCount}: ${type.toUpperCase()} ${amount.toFixed(2)} - ${signature.slice(0, 16)}...`);
    }

    processTransaction(signature, logs = []) {
        if (!signature || this.seenSignatures.has(signature)) return;
        this.seenSignatures.add(signature);

        // Keep set from growing too large
        if (this.seenSignatures.size > 1000) {
            const arr = Array.from(this.seenSignatures);
            this.seenSignatures = new Set(arr.slice(-500));
        }

        let type = 'transfer';
        let amount = 1;

        const logString = (logs || []).join(' ').toLowerCase();

        if (logString.includes('swap') || logString.includes('raydium') ||
            logString.includes('jupiter') || logString.includes('orca')) {
            type = Math.random() > 0.5 ? 'buy' : 'sell'; // Random when we can't determine
        }

        const amountMatch = logString.match(/amount[:\s]+(\d+)/i);
        if (amountMatch) {
            amount = parseInt(amountMatch[1]) / 1e6;
        }

        const fromAddr = signature.slice(0, 12);
        const toAddr = signature.slice(12, 24);

        this.txCount++;

        this.onTransaction({
            signature: signature,
            type: type,
            amount: amount,
            from: type === 'sell' ? fromAddr : 'center',
            to: type === 'buy' ? toAddr : 'center',
            timestamp: Date.now()
        });

        console.log(`TX #${this.txCount}: ${type.toUpperCase()} - ${signature.slice(0, 16)}...`);
    }

    reconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.onStatusChange('Polling only');
            console.log('WebSocket failed, using polling only');
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

        console.log(`Reconnecting in ${delay}ms...`);
        setTimeout(() => this.connect(), delay);
    }

    disconnect() {
        if (this.ws) {
            if (this.subscriptionId) {
                this.ws.send(JSON.stringify({
                    jsonrpc: '2.0',
                    id: 2,
                    method: 'logsUnsubscribe',
                    params: [this.subscriptionId]
                }));
            }
            this.ws.close();
        }
    }

    getTxCount() {
        return this.txCount;
    }
}

window.SolanaConnection = SolanaConnection;
