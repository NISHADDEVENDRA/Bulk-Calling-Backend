"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exotelService = exports.ExotelService = void 0;
const axios_1 = __importDefault(require("axios"));
const env_1 = require("../config/env");
const logger_1 = require("../utils/logger");
const errors_1 = require("../utils/errors");
class ExotelService {
    constructor() {
        this.apiKey = env_1.env.EXOTEL_API_KEY;
        this.apiToken = env_1.env.EXOTEL_API_TOKEN;
        this.sid = env_1.env.EXOTEL_SID;
        this.subdomain = env_1.env.EXOTEL_SUBDOMAIN;
        // Use v1 API instead of v2
        this.baseUrl = `https://${this.apiKey}:${this.apiToken}@${this.subdomain}/v1/Accounts/${this.sid}`;
        // Create axios instance with basic auth
        this.client = axios_1.default.create({
            baseURL: this.baseUrl,
            auth: {
                username: this.apiKey,
                password: this.apiToken
            },
            headers: {
                'Content-Type': 'application/json'
            }
        });
        logger_1.logger.info('Exotel service initialized', {
            subdomain: this.subdomain,
            sid: this.sid
        });
    }
    /**
     * Make an outbound call via Exotel
     */
    async makeCall(data) {
        try {
            logger_1.logger.info('Initiating Exotel call', {
                from: data.from,
                to: data.to
            });
            const payload = {
                From: data.from,
                To: data.to,
                CallerId: data.callerId || data.from,
                CallType: data.callType || 'trans',
                StatusCallback: data.statusCallback || `${env_1.env.WEBHOOK_BASE_URL}/bulk/api/exotel/webhook/status`
            };
            const response = await this.client.post('/Calls/connect', payload);
            logger_1.logger.info('Exotel call initiated successfully', {
                callSid: response.data.Call?.Sid,
                status: response.data.Call?.Status
            });
            return {
                sid: response.data.Call?.Sid,
                status: response.data.Call?.Status,
                from: response.data.Call?.From,
                to: response.data.Call?.To,
                direction: response.data.Call?.Direction,
                dateCreated: response.data.Call?.DateCreated,
                dateUpdated: response.data.Call?.DateUpdated
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to make Exotel call', {
                error: error.message,
                response: error.response?.data
            });
            if (error.response?.status === 400) {
                throw new errors_1.ValidationError(error.response.data?.message || 'Invalid call parameters');
            }
            throw new errors_1.ExternalServiceError('Failed to initiate call');
        }
    }
    /**
     * Make an outbound call with custom Exotel credentials (per-phone)
     */
    async makeCallWithCredentials(data, credentials) {
        try {
            logger_1.logger.info('Initiating Exotel call with custom credentials', {
                from: data.from,
                to: data.to,
                sid: credentials.sid
            });
            // Create custom client with provided credentials
            const baseUrl = `https://${credentials.apiKey}:${credentials.apiToken}@${credentials.subdomain}/v1/Accounts/${credentials.sid}`;
            const customClient = axios_1.default.create({
                baseURL: baseUrl,
                auth: {
                    username: credentials.apiKey,
                    password: credentials.apiToken
                },
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            const payload = {
                From: data.from,
                To: data.to,
                CallerId: data.callerId || data.from,
                CallType: data.callType || 'trans',
                StatusCallback: data.statusCallback || `${env_1.env.WEBHOOK_BASE_URL}/bulk/api/exotel/webhook/status`
            };
            const response = await customClient.post('/Calls/connect', payload);
            logger_1.logger.info('Exotel call initiated successfully with custom credentials', {
                callSid: response.data.Call?.Sid,
                status: response.data.Call?.Status
            });
            return {
                sid: response.data.Call?.Sid,
                status: response.data.Call?.Status,
                from: response.data.Call?.From,
                to: response.data.Call?.To,
                direction: response.data.Call?.Direction,
                dateCreated: response.data.Call?.DateCreated,
                dateUpdated: response.data.Call?.DateUpdated
            };
        }
        catch (error) {
            logger_1.logger.error('Failed to make Exotel call with custom credentials', {
                error: error.message,
                response: error.response?.data
            });
            if (error.response?.status === 400) {
                throw new errors_1.ValidationError(error.response.data?.message || 'Invalid call parameters');
            }
            if (error.response?.status === 401 || error.response?.status === 403) {
                throw new errors_1.ValidationError('Invalid Exotel credentials');
            }
            throw new errors_1.ExternalServiceError('Failed to initiate call');
        }
    }
    /**
     * Get call details by SID
     */
    async getCall(callSid) {
        try {
            logger_1.logger.info('Fetching Exotel call details', { callSid });
            const response = await this.client.get(`/Calls/${callSid}.json`);
            return response.data.Call;
        }
        catch (error) {
            logger_1.logger.error('Failed to fetch call details', {
                callSid,
                error: error.message
            });
            throw new errors_1.ExternalServiceError('Failed to fetch call details');
        }
    }
    /**
     * Get call recordings
     */
    async getRecording(callSid) {
        try {
            logger_1.logger.info('Fetching call recording', { callSid });
            const response = await this.client.get(`/Calls/${callSid}/Recordings.json`);
            const recordings = response.data.Recordings;
            if (!recordings || recordings.length === 0) {
                return null;
            }
            // Return the URL of the first recording
            return recordings[0].RecordingUrl;
        }
        catch (error) {
            logger_1.logger.error('Failed to fetch recording', {
                callSid,
                error: error.message
            });
            return null;
        }
    }
    /**
     * End an active call
     */
    async hangupCall(callSid) {
        try {
            logger_1.logger.info('Hanging up call', { callSid });
            await this.client.post(`/Calls/${callSid}.json`, {
                Status: 'completed'
            });
            logger_1.logger.info('Call hung up successfully', { callSid });
        }
        catch (error) {
            logger_1.logger.error('Failed to hangup call', {
                callSid,
                error: error.message
            });
            throw new errors_1.ExternalServiceError('Failed to hangup call');
        }
    }
    /**
     * Verify phone number with Exotel
     */
    async verifyNumber(phoneNumber) {
        try {
            logger_1.logger.info('Verifying phone number with Exotel', { phoneNumber });
            const response = await this.client.get('/IncomingPhoneNumbers.json');
            const numbers = response.data.IncomingPhoneNumbers || [];
            const verified = numbers.some((num) => num.PhoneNumber === phoneNumber);
            logger_1.logger.info('Phone number verification result', {
                phoneNumber,
                verified
            });
            return verified;
        }
        catch (error) {
            logger_1.logger.error('Failed to verify phone number', {
                phoneNumber,
                error: error.message
            });
            return false;
        }
    }
    /**
     * Get list of purchased numbers
     */
    async getPhoneNumbers() {
        try {
            logger_1.logger.info('Fetching Exotel phone numbers');
            const response = await this.client.get('/IncomingPhoneNumbers.json');
            return response.data.IncomingPhoneNumbers || [];
        }
        catch (error) {
            logger_1.logger.error('Failed to fetch phone numbers', {
                error: error.message
            });
            throw new errors_1.ExternalServiceError('Failed to fetch phone numbers');
        }
    }
    /**
     * Download audio recording from URL
     */
    async downloadRecording(recordingUrl) {
        try {
            logger_1.logger.info('Downloading recording', { recordingUrl });
            const response = await axios_1.default.get(recordingUrl, {
                responseType: 'arraybuffer',
                auth: {
                    username: this.apiKey,
                    password: this.apiToken
                }
            });
            const audioBuffer = Buffer.from(response.data);
            logger_1.logger.info('Recording downloaded successfully', {
                size: audioBuffer.length
            });
            return audioBuffer;
        }
        catch (error) {
            logger_1.logger.error('Failed to download recording', {
                recordingUrl,
                error: error.message
            });
            throw new errors_1.ExternalServiceError('Failed to download recording');
        }
    }
    /**
     * Parse webhook payload from Exotel
     */
    parseWebhook(payload) {
        return {
            CallSid: payload.CallSid,
            CallFrom: payload.CallFrom,
            CallTo: payload.CallTo,
            Direction: payload.Direction,
            Status: payload.Status,
            Duration: payload.Duration,
            RecordingUrl: payload.RecordingUrl,
            Digits: payload.Digits,
            CurrentTime: payload.CurrentTime,
            DialWhomNumber: payload.DialWhomNumber,
            StartTime: payload.StartTime,
            EndTime: payload.EndTime,
            CallType: payload.CallType,
            CustomField: payload.CustomField
        };
    }
}
exports.ExotelService = ExotelService;
exports.exotelService = new ExotelService();
//# sourceMappingURL=exotel.service.js.map
