"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const exotelVoice_controller_1 = require("../controllers/exotelVoice.controller");
const router = (0, express_1.Router)();
/**
 * Exotel Voice Webhook Routes
 * These endpoints are called by Exotel during active voice calls
 * No authentication required (Exotel callbacks)
 */
// Unified entry point for both incoming and outgoing calls
// Works with Voicebot applet for both directions:
// - Incoming calls: Voicebot applet configured on phone number with this webhook URL
// - Outbound calls: Voicebot applet configured in applet settings with this webhook URL
// Automatically detects call direction:
//   - Outbound: Uses CustomField (callLogId) to find existing CallLog
//   - Incoming: Creates new CallLog when no CustomField found
// Returns WebSocket URL in JSON format: { "url": "wss://..." }
router.get('/connect', exotelVoice_controller_1.exotelVoiceController.handleIncomingCall.bind(exotelVoice_controller_1.exotelVoiceController));
router.post('/connect', exotelVoice_controller_1.exotelVoiceController.handleIncomingCall.bind(exotelVoice_controller_1.exotelVoiceController));
// Greeting webhook - plays first message
router.get('/greeting', exotelVoice_controller_1.exotelVoiceController.handleGreeting.bind(exotelVoice_controller_1.exotelVoiceController));
router.post('/greeting', exotelVoice_controller_1.exotelVoiceController.handleGreeting.bind(exotelVoice_controller_1.exotelVoiceController));
// User input webhook - processes recorded audio
router.post('/input', exotelVoice_controller_1.exotelVoiceController.handleUserInput.bind(exotelVoice_controller_1.exotelVoiceController));
// Continuation webhook - continues conversation loop
router.get('/continue', exotelVoice_controller_1.exotelVoiceController.handleContinuation.bind(exotelVoice_controller_1.exotelVoiceController));
router.post('/continue', exotelVoice_controller_1.exotelVoiceController.handleContinuation.bind(exotelVoice_controller_1.exotelVoiceController));
// Call end webhook - cleanup and save transcript
router.post('/end', exotelVoice_controller_1.exotelVoiceController.handleCallEnd.bind(exotelVoice_controller_1.exotelVoiceController));
exports.default = router;
//# sourceMappingURL=exotelVoice.routes.js.map
