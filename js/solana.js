// Solana/Helius WebSocket Connection for JESTERMAXXING Token
class SolanaConnection {
    constructor(onTransaction, onStatusChange) {
        this.onTransaction = onTransaction;
        this.onStatusChange = onStatusChange;
        this.ws = null;
        this.subscriptionId = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.txCount = 0;

        // JESTERMAXXING token contract
        this.tokenMint = '6WdHhpRY7vL8SQ69bd89tAj3sk8jsjBrCLDUTZSNpump';

        // Helius WebSocket endpoint
        this.wsEndpoint = 'wss://mainnet.helius-rpc.com/?api-key=c32483f4-b57e-4001-92bc-29c93ce8fc8a';

        this.connect();
    }

    connect() {
        this.onStatusChange('Connecting...');

        try {
            this.ws = new WebSocket(this.wsEndpoint);

            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.reconnectAttempts = 0;
                this.onStatusChange('Connected');
                this.subscribe();
            };

            this.ws.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data));
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.onStatusChange('Connection error');
            };

            this.ws.onclose = () => {
                console.log('WebSocket closed');
                this.onStatusChange('Disconnected');
                this.reconnect();
            };
        } catch (error) {
            console.error('Failed to connect:', error);
            this.onStatusChange('Failed to connect');
            this.reconnect();
        }
    }

    subscribe() {
        // Subscribe to logs mentioning the token mint
        const subscribeMsg = {
            jsonrpc: '2.0',
            id: 1,
            method: 'logsSubscribe',
            params: [
                {
                    mentions: [this.tokenMint]
                },
                {
                    commitment: 'confirmed'
                }
            ]
        };

        this.ws.send(JSON.stringify(subscribeMsg));
        console.log('Subscribed to token logs:', this.tokenMint);
    }

    handleMessage(data) {
        // Handle subscription confirmation
        if (data.result !== undefined && data.id === 1) {
            this.subscriptionId = data.result;
            console.log('Subscription ID:', this.subscriptionId);
            return;
        }

        // Handle log notifications
        if (data.method === 'logsNotification') {
            const result = data.params?.result;
            if (result) {
                this.processLogs(result);
            }
        }
    }

    processLogs(result) {
        const logs = result.value?.logs || [];
        const signature = result.value?.signature;

        if (!signature) return;

        // Parse transaction logs to determine type and extract addresses
        let type = 'transfer';
        let amount = 1; // Default amount, will be parsed from logs if available

        // Check for common DEX program signatures
        const logString = logs.join(' ').toLowerCase();

        // Detect buy/sell based on common patterns
        if (logString.includes('swap') || logString.includes('raydium') ||
            logString.includes('jupiter') || logString.includes('orca')) {

            // Look for transfer patterns to determine direction
            const isBuy = logString.includes('transfer') &&
                         (logString.indexOf(this.tokenMint.toLowerCase()) >
                          logString.indexOf('transfer'));

            type = isBuy ? 'buy' : 'sell';
        }

        // Try to extract amount from logs
        const amountMatch = logString.match(/amount[:\s]+(\d+)/i);
        if (amountMatch) {
            amount = parseInt(amountMatch[1]) / 1e6; // Assuming 6 decimals
        }

        // Generate pseudo-addresses from signature for visualization
        // (Real addresses would require fetching full transaction details)
        const fromAddr = signature.slice(0, 16);
        const toAddr = signature.slice(16, 32);

        this.txCount++;

        // Emit transaction event
        this.onTransaction({
            signature: signature,
            type: type,
            amount: amount,
            from: type === 'sell' ? fromAddr : 'center',
            to: type === 'buy' ? toAddr : 'center',
            timestamp: Date.now()
        });

        console.log(`TX #${this.txCount}: ${type.toUpperCase()} - ${signature.slice(0, 20)}...`);
    }

    reconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.onStatusChange('Connection failed');
            console.error('Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

        this.onStatusChange(`Reconnecting (${this.reconnectAttempts})...`);
        console.log(`Reconnecting in ${delay}ms...`);

        setTimeout(() => this.connect(), delay);
    }

    disconnect() {
        if (this.ws) {
            // Unsubscribe first
            if (this.subscriptionId) {
                const unsubscribeMsg = {
                    jsonrpc: '2.0',
                    id: 2,
                    method: 'logsUnsubscribe',
                    params: [this.subscriptionId]
                };
                this.ws.send(JSON.stringify(unsubscribeMsg));
            }
            this.ws.close();
        }
    }

    getTxCount() {
        return this.txCount;
    }
}

// Export for use in other files
window.SolanaConnection = SolanaConnection;
