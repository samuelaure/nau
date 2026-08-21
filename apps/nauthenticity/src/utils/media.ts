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
 * Transcodes a video for long-term archival preservation — used by the naŭ mobile
 * reprocessing pipeline, NOT by nauthenticity's own analysis pipeline.
 *
 * nauthenticity's own optimizeVideo() downscales to 720p because its purpose is
 * analysis (transcription, synthesis) and the original stays on Instagram. Mobile
 * captures are the only surviving copy once Instagram deletes the post, so this
 * profile keeps native resolution and only reduces weight via a higher CRF.
 *
 * H.265 CRF 36, native resolution, AAC 64k mono — measured to match
 * optimizeVideo()'s H.264 CRF 23/720p SSIM at roughly a quarter of the file size.
 * Verified on-device (M2003J15SC / Redmi Note 9) 2026-08-21. Do not change without
 * re-verifying playback and quality on a real device — see
 * nau-mobile/docs/reprocessing-pipeline.md.
 */
export async function optimizeVideoForArchive(
  inputPath: string,
  outputPath: string,
  onProgress?: () => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    logger.info(`[MediaUtils] Archiving video (H.265 CRF36, native res): ${inputPath}`);
    ffmpeg(inputPath)
      .videoCodec('libx265')
      .outputOptions([
        '-crf', '36',
        '-preset', 'medium',
        '-movflags', '+faststart',
        '-pix_fmt', 'yuv420p',
        '-tag:v', 'hvc1', // Apple/most mobile players otherwise refuse to play HEVC in an mp4 box
      ])
      .audioCodec('aac')
      .audioBitrate('64k')
      .audioChannels(1)
      .on('progress', () => onProgress?.())
      .on('end', () => {
        logger.info(`[MediaUtils] Video archived successfully: ${outputPath}`);
        resolve();
      })
      .on('error', (err) => {
        logger.error(`[MediaUtils] Video archival transcode failed: ${err.message}`);
        reject(err);
      })
      .save(outputPath);
  });
}

/**
 * Reads the native pixel dimensions of a video or image file via ffprobe.
 */
export async function probeDimensions(
  filePath: string,
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) {
        logger.warn(`[MediaUtils] ffprobe failed for ${filePath}: ${err.message}`);
        return resolve(null);
      }
      const stream = data.streams.find((s) => s.width && s.height);
      if (!stream?.width || !stream?.height) return resolve(null);
      resolve({ width: stream.width, height: stream.height });
    });
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
