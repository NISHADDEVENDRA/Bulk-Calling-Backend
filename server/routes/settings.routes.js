"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const settings_controller_1 = require("../controllers/settings.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = express_1.default.Router();
// All routes require authentication and admin role
router.use(auth_middleware_1.authenticate);
router.use(auth_middleware_1.requireAdmin);
// GET /bulk/api/settings - Get admin settings
router.get('/', settings_controller_1.settingsController.getSettings.bind(settings_controller_1.settingsController));
// PUT /bulk/api/settings - Update admin settings
router.put('/', settings_controller_1.settingsController.updateSettings.bind(settings_controller_1.settingsController));
// POST /bulk/api/settings/test-tts - Test TTS provider
router.post('/test-tts', settings_controller_1.settingsController.testTts.bind(settings_controller_1.settingsController));
// GET /bulk/api/settings/voices/:provider - Get available voices
router.get('/voices/:provider', settings_controller_1.settingsController.getVoices.bind(settings_controller_1.settingsController));
exports.default = router;
//# sourceMappingURL=settings.routes.js.map
