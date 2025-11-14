"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exotelOutboundService = exports.ExotelOutboundService = void 0;
const axios_1 = __importDefault(require("axios"));
const bottleneck_1 = __importDefault(require("bottleneck"));
const logger_1 = __importDefault(require("../utils/logger"));
// Circuit Breaker implementation
class CircuitBreaker {
    constructor() {
        this.state = 'closed';
        this.failureCount = 0;
        this.FAILURE_THRESHOLD = 5;
        this.TIMEOUT = 60000; // 1 minute
    }
    async call(fn) {
        if (this.state === 'open') {
            // Check if timeout has passed
            if (this.lastFailureTime && Date.now() - this.lastFailureTime.getTime() > this.TIMEOUT) {
                this.state = 'half-open';
                logger_1.default.info('Circuit breaker entering half-open state');
            }
            else {
                throw new Error('Circuit breaker is OPEN - Exotel API unavailable');
            }
        }
        try {
            const result = await fn();
            // Success - reset if half-open
            if (this.state === 'half-open') {
                this.state = 'closed';
                this.failureCount = 0;
                logger_1.default.info('Circuit breaker closed - Exotel service recovered');
            }
            return result;
        }
        catch (error) {
            this.failureCount++;
            this.lastFailureTime = new Date();
            if (this.failureCount >= this.FAILURE_THRESHOLD) {
                this.state = 'open';
                logger_1.default.error('Circuit breaker opened - too many Exotel API failures', {
                    failureCount: this.failureCount
                });
            }
            throw error;
        }
    }
    getState() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            lastFailureTime: this.lastFailureTime
        };
    }
}
/**
 * Exotel Outbound Service
 * Handles outbound call API with rate limiting and circuit breaker
 */
class ExotelOutboundService {
    constructor() {
        this.accountSid = process.env.EXOTEL_SID || '';
        this.apiKey = process.env.EXOTEL_API_KEY || '';
        this.apiToken = process.env.EXOTEL_API_TOKEN || '';
        this.apiUrl = `${process.env.EXOTEL_BASE_URL}/${this.accountSid}`;
        // Validate configuration
        if (!this.accountSid || !this.apiKey || !this.apiToken) {
            throw new Error('Exotel configuration missing. Check EXOTEL_SID, EXOTEL_API_KEY, EXOTEL_API_TOKEN');
        }
        // Initialize HTTP client
        this.client = axios_1.default.create({
            baseURL: this.apiUrl,
            timeout: 10000,
            auth: {
                username: this.apiKey,
                password: this.apiToken
            },
            headers: {
                'Content-Type': 'application/json'
            }
        });
        // Initialize rate limiter
        // Assume 20 calls/second limit (adjust based on Exotel documentation)
        this.limiter = new bottleneck_1.default({
            reservoir: 20, // Number of jobs
            reservoirRefreshAmount: 20,
            reservoirRefreshInterval: 1000, // per 1 second
            maxConcurrent: 10, // Max concurrent requests
            minTime: 50 // Min 50ms between requests
        });
        // Initialize circuit breaker
        this.circuitBreaker = new CircuitBreaker();
        logger_1.default.info('ExotelOutboundService initialized', {
            accountSid: this.accountSid,
            apiUrl: this.apiUrl
        });
    }
    /**
     * Initiate an outbound call
     */
    async makeCall(params) {
        return this.limiter.schedule(async () => {
            return this.circuitBreaker.call(async () => {
                logger_1.default.info('Initiating Exotel call', {
                    to: params.to,
                    from: params.from,
                    customField: params.customField,
                    usingCustomCredentials: !!params.credentials
                });
                try {
                    // Use custom credentials if provided, otherwise use global config
                    let client;
                    let apiUrl;
                    if (params.credentials) {
                        // Use per-call credentials
                        const subdomain = params.credentials.subdomain || 'api.exotel.com';
                        // Extract API version from configured base URL (e.g., "v1" or "v2")
                        const baseUrlMatch = process.env.EXOTEL_BASE_URL?.match(/\/(v\d+)\//);
                        const apiVersion = baseUrlMatch ? baseUrlMatch[1] : 'v1';
                        apiUrl = `https://${subdomain}/${apiVersion}/Accounts/${params.credentials.sid}`;
                        client = axios_1.default.create({
                            baseURL: apiUrl,
                            timeout: 10000,
                            auth: {
                                username: params.credentials.apiKey,
                                password: params.credentials.apiToken
                            },
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        });
                        logger_1.default.info('Using phone-specific Exotel credentials', {
                            sid: params.credentials.sid,
                            subdomain,
                            apiVersion
                        });
                    }
                    else {
                        // Use global credentials
                        client = this.client;
                        apiUrl = this.apiUrl;
                    }
                    // Determine if using v1 or v2 API
                    const isV1 = apiUrl.includes('/v1/');
                    let requestData;
                    let requestHeaders = {};
                    let endpoint;
                    if (isV1) {
                        // v1 API uses form-encoded data and /Calls/connect endpoint
                        endpoint = '/Calls/connect.json';
                        requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
                        // v1: Call customer directly and connect to applet (no bridge To number needed)
                        const urlParams = new URLSearchParams({
                            From: params.to, // Customer number to call
                            CallerId: params.callerId, // Caller ID to display
                            Url: `http://my.exotel.com/${params.credentials?.sid || this.accountSid}/exoml/start_voice/${params.appId}`,
                            CustomField: params.customField || ''
                        });
                        requestData = urlParams.toString();
                    }
                    else {
                        // v2 API uses JSON data and /calls endpoint
                        endpoint = '/calls';
                        requestHeaders['Content-Type'] = 'application/json';
                        requestData = {
                            From: params.from,
                            To: params.to,
                            CallerId: params.callerId,
                            AppId: params.appId,
                            CustomField: params.customField
                        };
                    }
                    const response = await client.post(endpoint, requestData, {
                        headers: requestHeaders
                    });
                    logger_1.default.info('Exotel call initiated successfully', {
                        sid: response.data.sid,
                        status: response.data.status
                    });
                    return {
                        sid: response.data.sid,
                        status: response.data.status,
                        from: response.data.from,
                        to: response.data.to,
                        direction: response.data.direction,
                        dateCreated: response.data.date_created
                    };
                }
                catch (error) {
                    logger_1.default.error('Failed to initiate Exotel call', {
                        error: error.message,
                        status: error.response?.status,
                        data: error.response?.data
                    });
                    // Re-throw with more context
                    if (error.response?.status === 401) {
                        throw new Error('Exotel authentication failed. Check API credentials.');
                    }
                    else if (error.response?.status === 429) {
                        throw new Error('Exotel rate limit exceeded');
                    }
                    else if (error.response?.status >= 500) {
                        throw new Error('Exotel server error');
                    }
                    throw error;
                }
            });
        });
    }
    /**
     * Get call details
     */
    async getCallDetails(callSid) {
        return this.limiter.schedule(async () => {
            return this.circuitBreaker.call(async () => {
                try {
                    const response = await this.client.get(`/calls/${callSid}`);
                    return {
                        sid: response.data.sid,
                        status: response.data.status,
                        duration: parseInt(response.data.duration || '0'),
                        recordingUrl: response.data.recording_url
                    };
                }
                catch (error) {
                    logger_1.default.error('Failed to get Exotel call details', {
                        callSid,
                        error: error.message
                    });
                    throw error;
                }
            });
        });
    }
    /**
     * Hangup an active call
     */
    async hangupCall(callSid) {
        return this.limiter.schedule(async () => {
            return this.circuitBreaker.call(async () => {
                try {
                    await this.client.post(`/calls/${callSid}`, {
                        Status: 'completed'
                    });
                    logger_1.default.info('Call hangup requested', { callSid });
                }
                catch (error) {
                    logger_1.default.error('Failed to hangup call', {
                        callSid,
                        error: error.message
                    });
                    throw error;
                }
            });
        });
    }
    /**
     * Get recording URL
     */
    async getRecordingUrl(callSid) {
        try {
            const details = await this.getCallDetails(callSid);
            return details.recordingUrl || null;
        }
        catch (error) {
            logger_1.default.error('Failed to get recording URL', { callSid, error });
            return null;
        }
    }
    /**
     * Get circuit breaker state
     */
    getCircuitBreakerState() {
        return this.circuitBreaker.getState();
    }
    /**
     * Get rate limiter stats
     */
    async getRateLimiterStats() {
        return {
            running: this.limiter.counts().RUNNING,
            queued: this.limiter.counts().QUEUED,
            executing: this.limiter.counts().EXECUTING
        };
    }
}
exports.ExotelOutboundService = ExotelOutboundService;
// Export singleton instance
exports.exotelOutboundService = new ExotelOutboundService();
//# sourceMappingURL=exotelOutbound.service.js.map
