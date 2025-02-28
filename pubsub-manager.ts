// Google Cloud PubSub Manager

interface GoogleAuthConfig {
    client_id: string;
    project_id: string;
    auth_uri: string;
    token_uri: string;
    auth_provider_x509_cert_url: string;
    client_secret: string;
    redirect_uris: string[];
    javascript_origins: string[];
}

interface GoogleAuthResponse {
    access_token: string;
    expires_in: number;
    scope: string;
    token_type: string;
    id_token?: string;
    refresh_token?: string;
}

interface Subscription {
    name: string;
    topic: string;
    pushConfig?: {
        pushEndpoint: string;
    };
    ackDeadlineSeconds: number;
    messageRetentionDuration: string;
    expirationPolicy?: {
        ttl: string;
    };
    createdAt: string;
}

class PubSubManager {
    private authConfig: GoogleAuthConfig | null = null;
    private authToken: string | null = null;
    private projectId: string | null = null;
    private tokenExpiry: number = 0;

    constructor() {
        this.loadAuthConfig();
        this.setupEventListeners();
        this.checkAuthStatus();
    }

    private async loadAuthConfig(): Promise<void> {
        try {
            const response = await fetch('./Google Cloud Client Secret for WebApp.json');
            if (!response.ok) {
                throw new Error('Failed to load auth config');
            }

            const data = await response.json();
            this.authConfig = data.web;
            this.projectId = this.authConfig?.project_id || null;

            this.updateUI('Loaded auth config for project: ' + this.projectId);
        } catch (error) {
            this.updateUI('Error loading auth config: ' + (error as Error).message, 'error');
        }
    }

    private setupEventListeners(): void {
        document.getElementById('authButton')?.addEventListener('click', () => this.authenticate());
        document.getElementById('createTopicButton')?.addEventListener('click', () => this.createTopic());
        document.getElementById('createSubscriptionButton')?.addEventListener('click', () => this.createPushSubscription());
        document.getElementById('listSubscriptionsButton')?.addEventListener('click', () => this.listSubscriptions());
    }

    private updateUI(message: string, type: 'info' | 'error' = 'info'): void {
        console.log(`[${type.toUpperCase()}] ${message}`);
    }

    private updateAuthStatus(isAuthenticated: boolean): void {
        const authStatusElement = document.getElementById('authStatus');
        if (authStatusElement) {
            authStatusElement.textContent = isAuthenticated ? 'Authenticated' : 'Not authenticated';
            authStatusElement.className = isAuthenticated ? 'auth-status authenticated' : 'auth-status not-authenticated';
        }
    }

    private checkAuthStatus(): void {
        const token = localStorage.getItem('gcloud_token');
        const expiry = localStorage.getItem('gcloud_token_expiry');

        if (token && expiry && parseInt(expiry) > Date.now()) {
            this.authToken = token;
            this.tokenExpiry = parseInt(expiry);
            this.updateAuthStatus(true);
        } else {
            this.authToken = null;
            this.tokenExpiry = 0;
            this.updateAuthStatus(false);
        }
    }

    private authenticate(): void {
        if (!this.authConfig) {
            this.updateUI('Auth config not loaded', 'error');
            return;
        }

        // For simplicity, we'll use the implicit flow
        const scopes = encodeURIComponent('https://www.googleapis.com/auth/pubsub');
        const redirectUri = encodeURIComponent(this.authConfig.redirect_uris[0]);

        const authUrl = `${this.authConfig.auth_uri}?client_id=${this.authConfig.client_id}&redirect_uri=${redirectUri}&scope=${scopes}&response_type=token`;

        // Open a popup for authentication
        const authWindow = window.open(authUrl, 'Google Auth', 'width=600,height=600');

        // Poll for the redirect with the token
        const checkRedirect = setInterval(() => {
            try {
                if (authWindow && authWindow.location.href.includes('access_token')) {
                    clearInterval(checkRedirect);

                    // Parse the token from the URL
                    const params = new URLSearchParams(authWindow.location.hash.substring(1));
                    const accessToken = params.get('access_token');
                    const expiresIn = params.get('expires_in');

                    if (accessToken && expiresIn) {
                        this.authToken = accessToken;
                        this.tokenExpiry = Date.now() + (parseInt(expiresIn) * 1000);

                        localStorage.setItem('gcloud_token', accessToken);
                        localStorage.setItem('gcloud_token_expiry', this.tokenExpiry.toString());

                        this.updateAuthStatus(true);
                        this.updateUI('Authentication successful');

                        authWindow.close();
                    }
                }
            } catch (e) {
                // Ignore cross-origin errors during redirect
            }
        }, 500);
    }

    private async createTopic(): Promise<void> {
        if (!this.isAuthenticated()) {
            this.updateUI('Not authenticated', 'error');
            return;
        }

        const topicNameInput = document.getElementById('topicName') as HTMLInputElement;
        const topicName = topicNameInput.value.trim();

        if (!topicName) {
            this.updateUI('Topic name is required', 'error');
            return;
        }

        const outputElement = document.getElementById('topicOutput');
        if (outputElement) {
            outputElement.textContent = 'Creating topic...';
            outputElement.style.display = 'block';
        }

        try {
            const response = await fetch(`https://pubsub.googleapis.com/v1/projects/${this.projectId}/topics/${topicName}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (response.ok) {
                if (outputElement) {
                    outputElement.textContent = `Topic created successfully:\n${JSON.stringify(data, null, 2)}`;
                }
            } else {
                if (outputElement) {
                    outputElement.textContent = `Error creating topic:\n${JSON.stringify(data, null, 2)}`;
                }
            }
        } catch (error) {
            if (outputElement) {
                outputElement.textContent = `Error: ${(error as Error).message}`;
            }
        }
    }

    private async createPushSubscription(): Promise<void> {
        if (!this.isAuthenticated()) {
            this.updateUI('Not authenticated', 'error');
            return;
        }

        const topicInput = document.getElementById('subscriptionTopic') as HTMLInputElement;
        const nameInput = document.getElementById('subscriptionName') as HTMLInputElement;
        const endpointInput = document.getElementById('pushEndpoint') as HTMLInputElement;

        const topic = topicInput.value.trim();
        const name = nameInput.value.trim();
        const endpoint = endpointInput.value.trim();

        if (!topic || !name || !endpoint) {
            this.updateUI('Topic, subscription name, and endpoint are required', 'error');
            return;
        }

        const outputElement = document.getElementById('subscriptionOutput');
        if (outputElement) {
            outputElement.textContent = 'Creating subscription...';
            outputElement.style.display = 'block';
        }

        try {
            const response = await fetch(`https://pubsub.googleapis.com/v1/projects/${this.projectId}/subscriptions/${name}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    topic: `projects/${this.projectId}/topics/${topic}`,
                    pushConfig: {
                        pushEndpoint: endpoint
                    }
                })
            });

            const data = await response.json();

            if (response.ok) {
                if (outputElement) {
                    outputElement.textContent = `Subscription created successfully:\n${JSON.stringify(data, null, 2)}`;
                }
            } else {
                if (outputElement) {
                    outputElement.textContent = `Error creating subscription:\n${JSON.stringify(data, null, 2)}`;
                }
            }
        } catch (error) {
            if (outputElement) {
                outputElement.textContent = `Error: ${(error as Error).message}`;
            }
        }
    }

    private async listSubscriptions(): Promise<void> {
        if (!this.isAuthenticated()) {
            this.updateUI('Not authenticated', 'error');
            return;
        }

        const topicInput = document.getElementById('listTopic') as HTMLInputElement;
        const topic = topicInput.value.trim();

        if (!topic) {
            this.updateUI('Topic is required', 'error');
            return;
        }

        const outputElement = document.getElementById('listOutput');
        if (outputElement) {
            outputElement.textContent = 'Fetching subscriptions...';
            outputElement.style.display = 'block';
        }

        try {
            const response = await fetch(`https://pubsub.googleapis.com/v1/projects/${this.projectId}/topics/${topic}/subscriptions`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                if (outputElement) {
                    outputElement.textContent = `Subscriptions for topic ${topic}:\n${JSON.stringify(data, null, 2)}`;
                }

                // Populate the table
                this.populateSubscriptionsTable(data.subscriptions || []);
            } else {
                if (outputElement) {
                    outputElement.textContent = `Error fetching subscriptions:\n${JSON.stringify(data, null, 2)}`;
                }
            }
        } catch (error) {
            if (outputElement) {
                outputElement.textContent = `Error: ${(error as Error).message}`;
            }
        }
    }

    private populateSubscriptionsTable(subscriptions: string[]): void {
        const tableContainer = document.getElementById('subscriptionsTableContainer');
        const tableBody = document.querySelector('#subscriptionsTable tbody');

        if (!tableContainer || !tableBody) return;

        // Clear existing rows
        tableBody.innerHTML = '';

        if (subscriptions.length === 0) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 4;
            cell.textContent = 'No subscriptions found';
            row.appendChild(cell);
            tableBody.appendChild(row);
        } else {
            // For each subscription, fetch details and add to table
            subscriptions.forEach(async (subscriptionPath) => {
                try {
                    const response = await fetch(`https://pubsub.googleapis.com/v1/${subscriptionPath}`, {
                        headers: {
                            'Authorization': `Bearer ${this.authToken}`
                        }
                    });

                    if (response.ok) {
                        const subscription = await response.json();
                        this.addSubscriptionToTable(subscription);
                    }
                } catch (error) {
                    console.error('Error fetching subscription details:', error);
                }
            });
        }

        tableContainer.style.display = 'block';
    }

    private addSubscriptionToTable(subscription: Subscription): void {
        const tableBody = document.querySelector('#subscriptionsTable tbody');
        if (!tableBody) return;

        const row = document.createElement('tr');

        // Extract subscription name from full path
        const nameParts = subscription.name.split('/');
        const shortName = nameParts[nameParts.length - 1];

        // Create cells
        const nameCell = document.createElement('td');
        nameCell.textContent = shortName;

        const typeCell = document.createElement('td');
        typeCell.textContent = subscription.pushConfig ? 'Push' : 'Pull';

        const endpointCell = document.createElement('td');
        endpointCell.textContent = subscription.pushConfig?.pushEndpoint || 'N/A';

        const createdCell = document.createElement('td');
        createdCell.textContent = new Date(subscription.createdAt).toLocaleString();

        // Add cells to row
        row.appendChild(nameCell);
        row.appendChild(typeCell);
        row.appendChild(endpointCell);
        row.appendChild(createdCell);

        // Add row to table
        tableBody.appendChild(row);
    }

    private isAuthenticated(): boolean {
        return !!this.authToken && this.tokenExpiry > Date.now();
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PubSubManager();
}); 