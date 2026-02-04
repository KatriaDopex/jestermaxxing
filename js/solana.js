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
        this.ammAddress = null;
        this.allHolderBalances = new Map(); // Track all balances for scaling

        this.stats = {
            tx24h: 0,
            holderCount: 0,
            holderChange24h: 0,
            topAccumulator: null,
            topAccumulatorAmount: 0
        };

        // Track 24h accumulation per address
        this.accumulation24h = new Map(); // address -> { amount, lastUpdated }

        this.tokenMint = '6WdHhpRY7vL8SQ69bd89tAj3sk8jsjBrCLDUTZSNpump';

        this.apiKey = 'c32483f4-b57e-4001-92bc-29c93ce8fc8a';
        this.wsEndpoint = `wss://mainnet.helius-rpc.com/?api-key=${this.apiKey}`;
        this.httpEndpoint = `https://mainnet.helius-rpc.com/?api-key=${this.apiKey}`;

        this.initialize();
    }

    async initialize() {
        try {
            // Load holders first (most important)
            await this.loadTopHolders();
        } catch (error) {
            console.error('Failed to load holders:', error);
            this.onStatusChange('Error loading');
        }

        // Load stats in background (don't block)
        this.load24hStats().catch(err => console.error('Stats error:', err));
        this.loadTopAccumulator().catch(err => console.error('Accumulator error:', err));

        // Connect websocket and start polling
        this.connect();
        this.startPolling();

        // Refresh 24h stats every 10 minutes
        setInterval(() => this.load24hStats(), 10 * 60 * 1000);
        // Refresh top accumulator every 5 minutes
        setInterval(() => this.loadTopAccumulator(), 5 * 60 * 1000);
        // Clean up old accumulation data every hour
        setInterval(() => this.cleanOldAccumulation(), 60 * 60 * 1000);
    }

    cleanOldAccumulation() {
        const oneDayAgo = Date.now() - 86400000;
        for (const [addr, data] of this.accumulation24h.entries()) {
            if (data.lastUpdated < oneDayAgo) {
                this.accumulation24h.delete(addr);
            }
        }
    }

    // Fetch with timeout to prevent hanging
    async fetchWithTimeout(url, options, timeout = 10000) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(id);
            return response;
        } catch (error) {
            clearTimeout(id);
            throw error;
        }
    }

    async load24hStats() {
        try {
            const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;
            let tx24hCount = 0;
            let lastSignature = null;
            let keepPaginating = true;
            let pagesLoaded = 0;

            // Paginate through transactions (max 3 pages to avoid hanging)
            while (keepPaginating && pagesLoaded < 3) {
                const params = { limit: 1000 };
                if (lastSignature) {
                    params.before = lastSignature;
                }

                const response = await this.fetchWithTimeout(this.httpEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 1,
                        method: 'getSignaturesForAddress',
                        params: [this.tokenMint, params]
                    })
                });

                const data = await response.json();
                if (!data.result || data.result.length === 0) {
                    keepPaginating = false;
                    break;
                }

                pagesLoaded++;

                for (const tx of data.result) {
                    if (tx.blockTime && tx.blockTime >= oneDayAgo && !tx.err) {
                        tx24hCount++;
                    } else if (tx.blockTime && tx.blockTime < oneDayAgo) {
                        // We've gone past 24h, stop paginating
                        keepPaginating = false;
                        break;
                    }
                }

                // Set up for next page
                lastSignature = data.result[data.result.length - 1].signature;

                // Safety: max 5 pages (5000 txs) to avoid too many requests
                if (tx24hCount >= 5000) {
                    keepPaginating = false;
                }
            }

            this.stats.tx24h = tx24hCount;
            console.log(`24H Stats updated: ${tx24hCount} transactions`);

            if (this.onStatsUpdated) {
                this.onStatsUpdated(this.stats);
            }
        } catch (error) {
            console.error('Failed to load 24h stats:', error);
        }
    }

    async loadTopAccumulator() {
        // Top accumulator is now tracked from live transactions only
        // This avoids making hundreds of API calls on load
        // The data builds up as transactions come in

        // Find current top from accumulated data
        let topAddress = null;
        let topAmount = 0;

        for (const [addr, data] of this.accumulation24h.entries()) {
            if (data.amount > topAmount) {
                topAmount = data.amount;
                topAddress = addr;
            }
        }

        if (topAddress) {
            this.stats.topAccumulator = topAddress;
            this.stats.topAccumulatorAmount = topAmount;
        }

        if (this.onStatsUpdated) {
            this.onStatsUpdated(this.stats);
        }
    }

    // Track accumulation from live transactions
    trackAccumulation(address, amount, type) {
        if (type !== 'buy' || address === this.ammAddress) return;

        const current = this.accumulation24h.get(address) || { amount: 0, lastUpdated: 0 };
        current.amount += amount;
        current.lastUpdated = Date.now();
        this.accumulation24h.set(address, current);

        // Check if this is the new top accumulator
        if (current.amount > this.stats.topAccumulatorAmount) {
            this.stats.topAccumulator = address;
            this.stats.topAccumulatorAmount = current.amount;
            console.log(`New top accumulator: ${address.slice(0, 8)}... with ${current.amount.toFixed(0)} tokens`);

            if (this.onStatsUpdated) {
                this.onStatsUpdated(this.stats);
            }
        }
    }

    async loadTopHolders() {
        this.onStatusChange('Loading holders...');

        try {
            // Step 1: Get top 20 largest accounts (sorted by balance)
            const largestResponse = await this.fetchWithTimeout(this.httpEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getTokenLargestAccounts',
                    params: [this.tokenMint]
                })
            });

            const largestData = await largestResponse.json();

            if (largestData.result?.value && largestData.result.value.length > 0) {
                const largestAccounts = largestData.result.value;

                // Get owner addresses for these token accounts
                const tokenAddresses = largestAccounts.map(a => a.address);
                const ownersResponse = await this.fetchWithTimeout(this.httpEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 1,
                        method: 'getMultipleAccounts',
                        params: [tokenAddresses, { encoding: 'jsonParsed' }]
                    })
                });

                const ownersData = await ownersResponse.json();
                const top30 = [];

                if (ownersData.result?.value) {
                    ownersData.result.value.forEach((accountInfo, index) => {
                        const owner = accountInfo?.data?.parsed?.info?.owner;
                        if (owner) {
                            top30.push({
                                owner: owner,
                                tokenAccount: largestAccounts[index].address,
                                balance: largestAccounts[index].uiAmount || 0
                            });
                        }
                    });
                }

                console.log('Top holders by balance:', top30.slice(0, 5).map(h => ({ owner: h.owner.slice(0, 8), balance: h.balance })));

                // Step 2: Count total holders (paginate through all)
                let totalHolders = 0;
                let cursor = null;

                do {
                    const params = { mint: this.tokenMint, limit: 1000 };
                    if (cursor) params.cursor = cursor;

                    const countResponse = await this.fetchWithTimeout(this.httpEndpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            jsonrpc: '2.0',
                            id: 1,
                            method: 'getTokenAccounts',
                            params: params
                        })
                    });

                    const countData = await countResponse.json();
                    if (countData.result?.token_accounts) {
                        totalHolders += countData.result.token_accounts.filter(a => parseFloat(a.amount) > 0).length;
                        cursor = countData.result.cursor;
                    } else {
                        break;
                    }
                } while (cursor);

                this.stats.holderCount = totalHolders;
                console.log('Total holders:', totalHolders);

                // Set AMM as #1
                if (top30.length > 0) {
                    this.ammAddress = top30[0].owner;
                    console.log('AMM Address:', this.ammAddress);
                }

                // Store top 30 (max 20 from getTokenLargestAccounts)
                top30.forEach((holder, index) => {
                    this.holders.set(holder.owner, {
                        balance: holder.balance,
                        rank: index + 1,
                        tokenAccount: holder.tokenAccount,
                        isAMM: index === 0
                    });
                    this.allHolderBalances.set(holder.owner, holder.balance);
                });

                this.updateHolderChange();

                console.log(`Loaded ${this.holders.size} top holders`);

                if (this.onHoldersLoaded) {
                    this.onHoldersLoaded(Array.from(this.holders.entries()).map(([address, data]) => ({
                        address,
                        balance: data.balance,
                        rank: data.rank,
                        isAMM: data.isAMM
                    })));
                }

                if (this.onStatsUpdated) {
                    this.onStatsUpdated(this.stats);
                }
                return;
            }

            // Fallback if getTokenLargestAccounts failed
            console.log('getTokenLargestAccounts failed, trying fallback...');
            const rpcResponse = await this.fetchWithTimeout(this.httpEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getProgramAccounts',
                    params: [
                        'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
                        {
                            encoding: 'jsonParsed',
                            filters: [
                                { dataSize: 165 },
                                { memcmp: { offset: 0, bytes: this.tokenMint } }
                            ]
                        }
                    ]
                })
            });

            const rpcData = await rpcResponse.json();
            console.log('getProgramAccounts response:', rpcData);

            if (rpcData.result && rpcData.result.length > 0) {
                // Parse and sort all accounts
                const allAccounts = rpcData.result
                    .map(acc => ({
                        tokenAccount: acc.pubkey,
                        owner: acc.account.data.parsed.info.owner,
                        balance: parseFloat(acc.account.data.parsed.info.tokenAmount.uiAmount) || 0
                    }))
                    .filter(acc => acc.balance > 0)
                    .sort((a, b) => b.balance - a.balance);

                this.stats.holderCount = allAccounts.length;

                // Store ALL balances for scaling new buyers
                allAccounts.forEach(acc => {
                    this.allHolderBalances.set(acc.owner, acc.balance);
                });

                // Top 30 holders for display
                const top30 = allAccounts.slice(0, 30);

                // #1 is AMM
                if (top30.length > 0) {
                    this.ammAddress = top30[0].owner;
                    console.log('AMM Address:', this.ammAddress);
                }

                // Store top 30
                top30.forEach((holder, index) => {
                    this.holders.set(holder.owner, {
                        balance: holder.balance,
                        rank: index + 1,
                        tokenAccount: holder.tokenAccount,
                        isAMM: index === 0
                    });
                });

                this.updateHolderChange();

                console.log(`Loaded ${this.holders.size} top holders out of ${this.stats.holderCount} total`);

                if (this.onHoldersLoaded) {
                    this.onHoldersLoaded(Array.from(this.holders.entries()).map(([address, data]) => ({
                        address,
                        balance: data.balance,
                        rank: data.rank,
                        isAMM: data.isAMM
                    })));
                }

                if (this.onStatsUpdated) {
                    this.onStatsUpdated(this.stats);
                }
            } else {
                console.log('getProgramAccounts returned no results, trying fallback...');
                await this.loadTopHoldersFallback();
            }
        } catch (error) {
            console.error('Failed to load holders:', error);
            await this.loadTopHoldersFallback();
        }
    }

    async loadTopHoldersFallback() {
        this.onStatusChange('Loading holders...');

        try {
            // Fallback: use getTokenLargestAccounts (only gives 20)
            const response = await this.fetchWithTimeout(this.httpEndpoint, {
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

                if (holdersWithOwners.length > 0) {
                    this.ammAddress = holdersWithOwners[0].owner;
                }

                holdersWithOwners.forEach((holder, index) => {
                    if (holder.owner) {
                        this.holders.set(holder.owner, {
                            balance: holder.uiAmount,
                            rank: index + 1,
                            tokenAccount: holder.address,
                            isAMM: index === 0
                        });
                        this.allHolderBalances.set(holder.owner, holder.uiAmount);
                    }
                });

                this.stats.holderCount = this.holders.size;
                this.updateHolderChange();

                console.log(`Fallback: Loaded ${this.holders.size} holders`);

                if (this.onHoldersLoaded) {
                    this.onHoldersLoaded(Array.from(this.holders.entries()).map(([address, data]) => ({
                        address,
                        balance: data.balance,
                        rank: data.rank,
                        isAMM: data.isAMM
                    })));
                }

                if (this.onStatsUpdated) {
                    this.onStatsUpdated(this.stats);
                }
            }
        } catch (error) {
            console.error('Fallback failed:', error);
            this.onStatusChange('Failed to load');
        }
    }

    updateHolderChange() {
        const storedCount = localStorage.getItem('jester_holder_count_24h_ago');
        const storedTime = localStorage.getItem('jester_holder_count_time');
        const currentCount = this.stats.holderCount;

        // If we have stored data and it's reasonable (within 50% of current)
        if (storedCount && storedTime) {
            const stored = parseInt(storedCount);
            const timeDiff = Date.now() - parseInt(storedTime);

            // Sanity check: stored count should be within reasonable range of current
            // If stored is way off (like 20 vs 7000), reset the baseline
            if (stored > 0 && stored > currentCount * 0.5 && stored < currentCount * 2) {
                // Valid stored data
                this.stats.holderChange24h = currentCount - stored;

                // Reset baseline every 24 hours
                if (timeDiff >= 86400000) {
                    localStorage.setItem('jester_holder_count_24h_ago', currentCount.toString());
                    localStorage.setItem('jester_holder_count_time', Date.now().toString());
                }
            } else {
                // Stored data is stale/invalid, reset baseline
                console.log(`Resetting holder baseline: stored ${stored} vs current ${currentCount}`);
                localStorage.setItem('jester_holder_count_24h_ago', currentCount.toString());
                localStorage.setItem('jester_holder_count_time', Date.now().toString());
                this.stats.holderChange24h = 0;
            }
        } else {
            // No stored data, set baseline
            localStorage.setItem('jester_holder_count_24h_ago', currentCount.toString());
            localStorage.setItem('jester_holder_count_time', Date.now().toString());
            this.stats.holderChange24h = 0;
        }

        console.log(`Holder change: ${this.stats.holderChange24h} (current: ${currentCount})`);
    }

    async getAccountOwners(accounts) {
        const results = [];
        const addresses = accounts.map(a => a.address);

        try {
            const response = await this.fetchWithTimeout(this.httpEndpoint, {
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

    isAMM(address) {
        return address === this.ammAddress;
    }

    getHolderRank(address) {
        return this.holders.get(address)?.rank || null;
    }

    getHolderBalance(address) {
        return this.allHolderBalances.get(address) || null;
    }

    getMaxBalance() {
        // Return max balance excluding AMM for scaling
        let max = 0;
        this.holders.forEach((data, addr) => {
            if (!data.isAMM && data.balance > max) {
                max = data.balance;
            }
        });
        return max;
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
                const response = await this.fetchWithTimeout(this.httpEndpoint, {
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
        // Poll every 30 seconds (was 3 seconds) to reduce RPC usage
        setInterval(poll, 30000);
    }

    async fetchAndProcessTransaction(signature) {
        if (this.seenSignatures.has(signature)) return;

        try {
            const response = await this.fetchWithTimeout(this.httpEndpoint, {
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
                        newBalance: postAmount,
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

                    // Update balance tracking for new holders
                    this.allHolderBalances.set(receiver.owner, receiver.newBalance);

                    const fromIsHolder = this.isTopHolder(sender.owner);
                    const toIsHolder = this.isTopHolder(receiver.owner);
                    const fromIsAMM = this.isAMM(sender.owner);
                    const toIsAMM = this.isAMM(receiver.owner);

                    let txType = 'transfer';
                    if (fromIsAMM) {
                        txType = 'buy';
                    } else if (toIsAMM) {
                        txType = 'sell';
                    }

                    this.onTransaction({
                        signature: signature,
                        from: sender.owner,
                        to: receiver.owner,
                        amount: amount,
                        receiverBalance: receiver.newBalance, // Pass the new balance for sizing
                        fromIsHolder: fromIsHolder,
                        toIsHolder: toIsHolder,
                        fromIsAMM: fromIsAMM,
                        toIsAMM: toIsAMM,
                        type: txType,
                        fromRank: this.getHolderRank(sender.owner),
                        toRank: this.getHolderRank(receiver.owner),
                        maxBalance: this.getMaxBalance(),
                        timestamp: Date.now()
                    });

                    // Track accumulation for top accumulator feature
                    this.trackAccumulation(receiver.owner, amount, txType);

                    console.log(`TX #${this.txCount} [${txType.toUpperCase()}]: ${amount.toFixed(0)} tokens, receiver now has ${receiver.newBalance.toFixed(0)}`);
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
