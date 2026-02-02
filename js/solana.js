// Solana/Helius Connection for JESTERMAXXING Token
class SolanaConnection {
    constructor(onTransaction, onStatusChange, onHoldersLoaded, onStatsUpdated) {
        this.onTransaction = onTransaction;
        this.onStatusChange = onStatusChange;
        this.onHoldersLoaded = onHoldersLoaded;
        this.onStatsUpdated = onStatsUpdated;
        this.ws = null;
        this.subscriptionId = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.txCount = 0;
        this.seenSignatures = new Set();
        this.holders = new Map();

        // 24h stats
        this.stats = {
            tx24h: 0,
            holderCount: 0,
            holderChange24h: 0
        };

        // JESTERMAXXING token contract
        this.tokenMint = '6WdHhpRY7vL8SQ69bd89tAj3sk8jsjBrCLDUTZSNpump';

        // Helius endpoints
        this.apiKey = 'c32483f4-b57e-4001-92bc-29c93ce8fc8a';
        this.wsEndpoint = `wss://mainnet.helius-rpc.com/?api-key=${this.apiKey}`;
        this.httpEndpoint = `https://mainnet.helius-rpc.com/?api-key=${this.apiKey}`;

        // Load data then connect
        this.initialize();
    }

    async initialize() {
        await this.loadTopHolders();
        await this.load24hStats();
        this.connect();
        this.startPolling();

        // Refresh stats every 5 minutes
        setInterval(() => this.load24hStats(), 5 * 60 * 1000);
    }

    async load24hStats() {
        try {
            // Get 24h transaction count by fetching signatures
            const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;

            const response = await fetch(this.httpEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getSignaturesForAddress',
                    params: [this.tokenMint, { limit: 1000 }]
                })
            });

            const data = await response.json();
            if (data.result) {
                // Count transactions in last 24h
                const recentTxs = data.result.filter(tx =>
                    tx.blockTime && tx.blockTime >= oneDayAgo && !tx.err
                );
                this.stats.tx24h = recentTxs.length;
            }

            // Get total holder count using token accounts
            await this.getHolderCount();

            if (this.onStatsUpdated) {
                this.onStatsUpdated(this.stats);
            }

        } catch (error) {
            console.error('Failed to load 24h stats:', error);
        }
    }

    async getHolderCount() {
        try {
            // Use getTokenAccountsByMint to count holders
            // This is an approximation as we can only get a sample
            const response = await fetch(this.httpEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getTokenLargestAccounts',
                    params: [this.tokenMint]
                })
            });

            const data = await response.json();
            if (data.result?.value) {
                // This gives us top 20, we estimate total from that
                const topAccounts = data.result.value.filter(a => parseFloat(a.uiAmount) > 0);
                this.stats.holderCount = Math.max(topAccounts.length, this.holders.size);

                // Estimate holder change (random for demo, would need historical data)
                // In production, you'd track this over time
                const storedCount = localStorage.getItem('jester_holder_count_24h_ago');
                const storedTime = localStorage.getItem('jester_holder_count_time');

                if (storedCount && storedTime) {
                    const timeDiff = Date.now() - parseInt(storedTime);
                    if (timeDiff >= 86400000) { // 24h passed
                        this.stats.holderChange24h = this.stats.holderCount - parseInt(storedCount);
                        localStorage.setItem('jester_holder_count_24h_ago', this.stats.holderCount);
                        localStorage.setItem('jester_holder_count_time', Date.now());
                    } else {
                        this.stats.holderChange24h = this.stats.holderCount - parseInt(storedCount);
                    }
                } else {
                    localStorage.setItem('jester_holder_count_24h_ago', this.stats.holderCount);
                    localStorage.setItem('jester_holder_count_time', Date.now());
                    this.stats.holderChange24h = 0;
                }
            }
        } catch (error) {
            console.error('Failed to get holder count:', error);
        }
    }

    async loadTopHolders() {
        this.onStatusChange('Loading holders...');

        try {
            const response = await fetch(this.httpEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getTokenLargestAccounts',
                    params: [this.tokenMint]
                })
            });

            const data = await response.json();

            if (data.result?.value) {
                const accounts = data.result.value;
                const holdersWithOwners = await this.getAccountOwners(accounts);

                holdersWithOwners.forEach((holder, index) => {
                    if (holder.owner) {
                        this.holders.set(holder.owner, {
                            balance: holder.uiAmount,
                            rank: index + 1,
                            tokenAccount: holder.address
                        });
                    }
                });

                console.log(`Loaded ${this.holders.size} top holders`);
                this.stats.holderCount = this.holders.size;

                if (this.onHoldersLoaded) {
                    this.onHoldersLoaded(Array.from(this.holders.entries()).map(([address, data]) => ({
                        address,
                        balance: data.balance,
                        rank: data.rank
                    })));
                }
            }
        } catch (error) {
            console.error('Failed to load holders:', error);
            this.onStatusChange('Failed to load holders');
        }
    }

    async getAccountOwners(accounts) {
        const results = [];
        const addresses = accounts.map(a => a.address);

        try {
            const response = await fetch(this.httpEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getMultipleAccounts',
                    params: [addresses, { encoding: 'jsonParsed' }]
                })
            });

            const data = await response.json();

            if (data.result?.value) {
                data.result.value.forEach((accountInfo, index) => {
                    const owner = accountInfo?.data?.parsed?.info?.owner;
                    results.push({
                        address: accounts[index].address,
                        owner: owner,
                        uiAmount: accounts[index].uiAmount
                    });
                });
            }
        } catch (error) {
            console.error('Failed to get account owners:', error);
        }

        return results;
    }

    isTopHolder(address) {
        return this.holders.has(address);
    }

    getHolderRank(address) {
        return this.holders.get(address)?.rank || null;
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
        console.log('Subscribed to token logs');
    }

    handleMessage(data) {
        if (data.result !== undefined && data.id === 1) {
            this.subscriptionId = data.result;
            return;
        }

        if (data.method === 'logsNotification') {
            const result = data.params?.result;
            if (result?.value?.signature) {
                this.fetchAndProcessTransaction(result.value.signature);
            }
        }
    }

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
                    const newTxs = data.result
                        .filter(tx => !this.seenSignatures.has(tx.signature) && !tx.err)
                        .reverse();

                    for (const tx of newTxs) {
                        await this.fetchAndProcessTransaction(tx.signature);
                    }
                }
            } catch (error) {
                console.error('Polling error:', error);
            }
        };

        await poll();
        setInterval(poll, 3000);
    }

    async fetchAndProcessTransaction(signature) {
        if (this.seenSignatures.has(signature)) return;

        try {
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
        }
    }

    processFullTransaction(signature, tx) {
        if (this.seenSignatures.has(signature)) return;
        this.seenSignatures.add(signature);

        if (this.seenSignatures.size > 1000) {
            const arr = Array.from(this.seenSignatures);
            this.seenSignatures = new Set(arr.slice(-500));
        }

        const meta = tx.meta;
        if (!meta) return;

        const preBalances = meta.preTokenBalances || [];
        const postBalances = meta.postTokenBalances || [];

        const transfers = [];

        for (const post of postBalances) {
            if (post.mint === this.tokenMint) {
                const pre = preBalances.find(p =>
                    p.accountIndex === post.accountIndex && p.mint === this.tokenMint
                );

                const preAmount = pre ? parseFloat(pre.uiTokenAmount?.uiAmount || 0) : 0;
                const postAmount = parseFloat(post.uiTokenAmount?.uiAmount || 0);
                const diff = postAmount - preAmount;

                if (Math.abs(diff) > 0.001) {
                    transfers.push({
                        owner: post.owner,
                        amount: diff,
                        isReceiver: diff > 0
                    });
                }
            }
        }

        const senders = transfers.filter(t => !t.isReceiver);
        const receivers = transfers.filter(t => t.isReceiver);

        for (const sender of senders) {
            for (const receiver of receivers) {
                const amount = Math.min(Math.abs(sender.amount), receiver.amount);

                if (amount > 0.001) {
                    this.txCount++;
                    this.stats.tx24h++;

                    const fromIsHolder = this.isTopHolder(sender.owner);
                    const toIsHolder = this.isTopHolder(receiver.owner);

                    this.onTransaction({
                        signature: signature,
                        from: sender.owner,
                        to: receiver.owner,
                        amount: amount,
                        fromIsHolder: fromIsHolder,
                        toIsHolder: toIsHolder,
                        fromRank: this.getHolderRank(sender.owner),
                        toRank: this.getHolderRank(receiver.owner),
                        timestamp: Date.now()
                    });

                    console.log(`TX #${this.txCount}: ${sender.owner.slice(0,6)}... → ${receiver.owner.slice(0,6)}... (${amount.toFixed(2)})`);
                }
            }
        }
    }

    reconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.onStatusChange('Polling only');
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
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

    getStats() {
        return this.stats;
    }
}

window.SolanaConnection = SolanaConnection;
