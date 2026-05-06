import ffmpeg from 'fluent-ffmpeg';
import { logger } from './logger';

/**
 * Optimizes a video file for storage.
 * Standardizes to H.264, 720p max height, and reasonable bitrate.
 */
export async function optimizeVideo(
  inputPath: string,
  outputPath: string,
  onProgress?: () => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    logger.info(`[MediaUtils] Optimizing video: ${inputPath}`);
    ffmpeg(inputPath)
      .videoCodec('libx264')
      // Scale down to 720p max height, preserve aspect ratio, pad to even dimensions for libx264
      .outputOptions([
        '-vf', 'scale=-2:min(ih\\,720)',
        '-preset', 'fast',
        '-crf', '23',
        '-movflags', '+faststart',
        '-pix_fmt', 'yuv420p',
      ])
      .audioCodec('aac')
      .audioBitrate('128k')
      .on('progress', () => onProgress?.())
      .on('end', () => {
        logger.info(`[MediaUtils] Video optimized successfully: ${outputPath}`);
        resolve();
      })
      .on('error', (err) => {
        logger.error(`[MediaUtils] Video optimization failed: ${err.message}`);
        reject(err);
      })
      .save(outputPath);
  });
}

/**
 * Optimizes an image file for storage.
 * Standards to high-quality JPEG.
 */
export async function optimizeImage(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    logger.info(`[MediaUtils] Optimizing image: ${inputPath}`);
    ffmpeg(inputPath)
      .outputOptions(['-frames:v', '1', '-q:v', '2'])
      .on('end', () => {
        logger.info(`[MediaUtils] Image optimized successfully: ${outputPath}`);
        resolve();
      })
      .on('error', (err) => {
        logger.error(`[MediaUtils] Image optimization failed: ${err.message}`);
        reject(err);
      })
      .save(outputPath);
  });
}
