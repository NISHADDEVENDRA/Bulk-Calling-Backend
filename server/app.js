"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const env_1 = require("./config/env");
const error_middleware_1 = require("./middlewares/error.middleware");
const requestLogger_1 = require("./middlewares/requestLogger");
const logger_1 = require("./utils/logger");
// Import routes
const routes_1 = __importDefault(require("./routes"));
// Create Express app
const app = (0, express_1.default)();
// Security middleware
app.use((0, helmet_1.default)());
// CORS - Allow multiple origins (production and development)
const allowedOrigins = [
    env_1.env.FRONTEND_URL,
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:5000'
];
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin)
            return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
}));
// Body parser
app.use(express_1.default.json({ limit: '100mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '100mb' }));
// HTTP request logger (Morgan for detailed logs)
if (env_1.env.NODE_ENV === 'development') {
    app.use((0, morgan_1.default)('dev', { stream: logger_1.stream }));
}
else {
    app.use((0, morgan_1.default)('combined', { stream: logger_1.stream }));
}
// Custom request logger for structured logging
app.use(requestLogger_1.requestLogger);
// Health check endpoint
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
//test comment
// API routes
app.use('/bulk/api', routes_1.default);
// 404 handler
app.use(error_middleware_1.notFoundHandler);
// Error logger (must be before error handler)
app.use(requestLogger_1.errorLogger);
// Error handler (must be last)
app.use(error_middleware_1.errorHandler);
exports.default = app;
//# sourceMappingURL=app.js.map
