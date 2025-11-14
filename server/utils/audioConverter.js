"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.audioConverter = exports.AudioConverter = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const promises_1 = require("fs/promises");
const os_1 = require("os");
const path_1 = require("path");
const logger_1 = require("./logger");
const execPromise = (0, util_1.promisify)(child_process_1.exec);
/**
 * Audio Converter Utility
 * Handles conversion between different audio formats for telephony
 */
class AudioConverter {
    /**
     * Convert audio to Linear PCM format (16-bit, 8kHz, mono, little-endian) for Exotel
     * Input: MP3/WAV from ElevenLabs or other TTS
     * Output: Raw PCM audio buffer
     */
    async convertToPCM(inputBuffer) {
        const tempInputFile = (0, path_1.join)((0, os_1.tmpdir)(), `tts_${Date.now()}.mp3`);
        const tempOutputFile = (0, path_1.join)((0, os_1.tmpdir)(), `pcm_${Date.now()}.raw`);
        try {
            // Write input buffer to temporary file
            await (0, promises_1.writeFile)(tempInputFile, inputBuffer);
            logger_1.logger.info('Converting audio to PCM for Exotel', {
                inputSize: inputBuffer.length,
                tempFile: tempInputFile
            });
            // Use ffmpeg to convert to Linear PCM (16-bit, 8kHz, mono, little-endian)
            // -acodec pcm_s16le: 16-bit signed little-endian PCM
            // -ar 8000: Sample rate 8000 Hz
            // -ac 1: Mono audio
            // -f s16le: Output format raw PCM
            const ffmpegCommand = `ffmpeg -i "${tempInputFile}" -acodec pcm_s16le -ar 8000 -ac 1 -f s16le "${tempOutputFile}" -y 2>&1`;
            const { stdout, stderr } = await execPromise(ffmpegCommand);
            logger_1.logger.info('ffmpeg conversion completed', {
                success: true
            });
            // Read the output file
            const fs = require('fs').promises;
            const pcmBuffer = await fs.readFile(tempOutputFile);
            logger_1.logger.info('Audio converted to PCM successfully', {
                inputSize: inputBuffer.length,
                outputSize: pcmBuffer.length,
                format: '16-bit 8kHz mono PCM'
            });
            return pcmBuffer;
        }
        catch (error) {
            logger_1.logger.error('Failed to convert audio to μ-law', {
                error: error.message
            });
            throw new Error(`Audio conversion failed: ${error.message}`);
        }
        finally {
            // Clean up temporary files
            try {
                await (0, promises_1.unlink)(tempInputFile);
                await (0, promises_1.unlink)(tempOutputFile);
            }
            catch (cleanupError) {
                logger_1.logger.warn('Failed to clean up temp files', { error: cleanupError });
            }
        }
    }
    /**
     * Convert Exotel PCM audio to WAV for STT (Whisper)
     * Input: Raw PCM audio from Exotel (16-bit, 8kHz, mono, little-endian)
     * Output: WAV file buffer (16kHz, mono, 16-bit) for Whisper
     */
    async convertExotelPCMToWAV(pcmBuffer) {
        const tempInputFile = (0, path_1.join)((0, os_1.tmpdir)(), `exotel_pcm_${Date.now()}.raw`);
        const tempOutputFile = (0, path_1.join)((0, os_1.tmpdir)(), `whisper_${Date.now()}.wav`);
        try {
            // Write raw PCM buffer to temporary file
            await (0, promises_1.writeFile)(tempInputFile, pcmBuffer);
            logger_1.logger.info('Converting Exotel PCM to WAV for Whisper', {
                inputSize: pcmBuffer.length,
                inputFormat: '16-bit 8kHz mono PCM'
            });
            // Convert raw PCM (8kHz) to WAV (16kHz) for Whisper
            // -f s16le: Input is signed 16-bit little-endian PCM
            // -ar 8000: Input sample rate is 8kHz
            // -ac 1: Mono audio
            // -ar 16000: Output sample rate 16kHz (required by Whisper)
            const ffmpegCommand = `ffmpeg -f s16le -ar 8000 -ac 1 -i "${tempInputFile}" -acodec pcm_s16le -ar 16000 -ac 1 "${tempOutputFile}" -y 2>&1`;
            const { stdout, stderr } = await execPromise(ffmpegCommand);
            // Read the output file
            const fs = require('fs').promises;
            const wavBuffer = await fs.readFile(tempOutputFile);
            logger_1.logger.info('Exotel PCM converted to WAV successfully', {
                inputSize: pcmBuffer.length,
                outputSize: wavBuffer.length,
                outputFormat: '16-bit 16kHz mono WAV'
            });
            return wavBuffer;
        }
        catch (error) {
            logger_1.logger.error('Failed to convert Exotel PCM to WAV', {
                error: error.message
            });
            throw new Error(`Audio conversion failed: ${error.message}`);
        }
        finally {
            // Clean up temporary files
            try {
                await (0, promises_1.unlink)(tempInputFile);
                await (0, promises_1.unlink)(tempOutputFile);
            }
            catch (cleanupError) {
                logger_1.logger.warn('Failed to clean up temp files', { error: cleanupError });
            }
        }
    }
    /**
     * @deprecated Use convertExotelPCMToWAV instead
     * Convert μ-law audio to PCM for STT (Whisper)
     * Input: μ-law encoded audio from Exotel
     * Output: PCM audio buffer (16kHz, mono, 16-bit) for Whisper
     */
    async convertMuLawToPCM(mulawBuffer) {
        const tempInputFile = (0, path_1.join)((0, os_1.tmpdir)(), `mulaw_${Date.now()}.ulaw`);
        const tempOutputFile = (0, path_1.join)((0, os_1.tmpdir)(), `pcm_${Date.now()}.wav`);
        try {
            // Write μ-law buffer to temporary file
            await (0, promises_1.writeFile)(tempInputFile, mulawBuffer);
            logger_1.logger.debug('Converting μ-law to PCM', {
                inputSize: mulawBuffer.length
            });
            // Convert μ-law to PCM WAV (16kHz, mono, 16-bit for Whisper)
            const ffmpegCommand = `ffmpeg -f mulaw -ar 8000 -ac 1 -i "${tempInputFile}" -acodec pcm_s16le -ar 16000 -ac 1 "${tempOutputFile}" -y`;
            await execPromise(ffmpegCommand);
            // Read the output file
            const fs = require('fs').promises;
            const pcmBuffer = await fs.readFile(tempOutputFile);
            logger_1.logger.debug('μ-law converted to PCM', {
                outputSize: pcmBuffer.length
            });
            return pcmBuffer;
        }
        catch (error) {
            logger_1.logger.error('Failed to convert μ-law to PCM', {
                error: error.message
            });
            throw new Error(`Audio conversion failed: ${error.message}`);
        }
        finally {
            // Clean up temporary files
            try {
                await (0, promises_1.unlink)(tempInputFile);
                await (0, promises_1.unlink)(tempOutputFile);
            }
            catch (cleanupError) {
                logger_1.logger.warn('Failed to clean up temp files', { error: cleanupError });
            }
        }
    }
    /**
     * Check if ffmpeg is available
     */
    async checkFFmpeg() {
        try {
            await execPromise('ffmpeg -version');
            return true;
        }
        catch (error) {
            logger_1.logger.error('ffmpeg is not installed or not in PATH');
            return false;
        }
    }
}
exports.AudioConverter = AudioConverter;
exports.audioConverter = new AudioConverter();
//# sourceMappingURL=audioConverter.js.map
