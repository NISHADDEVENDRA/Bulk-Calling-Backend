"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
// Define environment schema
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    PORT: zod_1.z.string().transform(Number).default('5000'),
    FRONTEND_URL: zod_1.z.string().url().default('http://localhost:5173'),
    // Database
    MONGODB_URI: zod_1.z.string().default('mongodb://localhost:27017/ai-calling-platform'),
    REDIS_URL: zod_1.z.string().default('redis://localhost:6379'),
    // JWT
    JWT_SECRET: zod_1.z.string().min(32),
    JWT_EXPIRE: zod_1.z.string().default('7d'),
    JWT_REFRESH_EXPIRE: zod_1.z.string().default('30d'),
    // Exotel
    EXOTEL_API_KEY: zod_1.z.string().optional(),
    EXOTEL_API_TOKEN: zod_1.z.string().optional(),
    EXOTEL_SID: zod_1.z.string().optional(),
    EXOTEL_SUBDOMAIN: zod_1.z.string().optional(),
    EXOTEL_BASE_URL: zod_1.z.string().url().default('https://api.exotel.com/v2/accounts'),
    // AI Services
    OPENAI_API_KEY: zod_1.z.string().startsWith('sk-').optional(),
    ANTHROPIC_API_KEY: zod_1.z.string().optional(),
    DEEPGRAM_API_KEY: zod_1.z.string().optional(),
    ELEVENLABS_API_KEY: zod_1.z.string().optional(),
    SARVAM_API_KEY: zod_1.z.string().optional(), // Sarvam.ai for Indian languages
    // AWS
    AWS_ACCESS_KEY_ID: zod_1.z.string().optional(),
    AWS_SECRET_ACCESS_KEY: zod_1.z.string().optional(),
    AWS_S3_BUCKET: zod_1.z.string().default('ai-calling-recordings'),
    AWS_REGION: zod_1.z.string().default('us-east-1'),
    // Webhooks
    WEBHOOK_BASE_URL: zod_1.z.string().url().default('http://localhost:5000')
});
// Parse and validate environment variables
exports.env = envSchema.parse(process.env);
//# sourceMappingURL=env.js.map
