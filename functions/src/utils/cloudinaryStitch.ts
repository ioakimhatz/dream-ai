// functions/src/utils/cloudinaryStitch.ts - USING FFMPEG + CLOUDINARY SDK
import { v2 as cloudinary } from 'cloudinary';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import * as fs from 'fs';

const CLOUD = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME!;
const API_KEY = process.env.EXPO_PUBLIC_CLOUDINARY_API_KEY!;
const API_SECRET = process.env.EXPO_PUBLIC_CLOUDINARY_API_SECRET!;

// Configure Cloudinary
cloudinary.config({
  cloud_name: CLOUD,
  api_key: API_KEY,
  api_secret: API_SECRET,
});

// Set FFmpeg path
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

export async function uploadImage(localUri: string): Promise<string> {
  if (!CLOUD || !API_KEY || !API_SECRET) {
    throw new Error("Missing Cloudinary env vars.");
  }

  console.log(`📤 Uploading image with SDK: ${localUri}`);

  // ✅ NO FOLDER - matches local app behavior
  const result = await cloudinary.uploader.upload(localUri, {
    resource_type: 'image',
  });

  console.log(`✅ Uploaded image: ${result.secure_url}`);
  return result.secure_url;
}

/**
 * Concatenates local mp4 clips using FFmpeg, then uploads the final video to Cloudinary
 */
export async function stitchWithCloudinary(
  localClipPaths: string[]
): Promise<string> {
  if (!CLOUD || !API_KEY || !API_SECRET) {
    throw new Error("Missing Cloudinary env vars.");
  }

  console.log(`🎬 Stitching ${localClipPaths.length} clips using FFmpeg + Cloudinary...`);

  // Step 1: Create concat file list for ffmpeg
  const concatList = localClipPaths.map(clip => `file '${clip}'`).join('\n');
  const concatFilePath = '/tmp/concat_list.txt';
  fs.writeFileSync(concatFilePath, concatList);
  console.log('📝 Created concat list for FFmpeg');

  // Step 2: Merge videos with ffmpeg
  const outputPath = '/tmp/final_merged.mp4';

  console.log('🎬 Starting FFmpeg concatenation...');

  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(concatFilePath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions(['-c', 'copy']) // Fast: no re-encoding
      .output(outputPath)
      .on('start', (cmd) => console.log('🎬 FFmpeg command:', cmd))
      .on('progress', (progress) => {
        if (progress.percent) {
          console.log(`⏳ Processing: ${Math.round(progress.percent)}%`);
        }
      })
      .on('end', () => {
        console.log('✅ FFmpeg concatenation complete!');
        resolve();
      })
      .on('error', (err) => {
        console.error('❌ FFmpeg error:', err);
        reject(err);
      })
      .run();
  });

  // Step 3: Upload merged video to Cloudinary
  console.log('📤 Uploading merged video to Cloudinary...');

  const uploadResult = await cloudinary.uploader.upload(outputPath, {
    resource_type: 'video',
    folder: 'dream-videos-final',
    eager: [{ quality: 'auto', fetch_format: 'mp4' }],
    eager_async: false,
  });

  console.log('✅ Merged video uploaded:', uploadResult.secure_url);

  // Step 4: Clean up temp files
  console.log('🧹 Cleaning up temporary files...');
  try {
    fs.unlinkSync(concatFilePath);
    fs.unlinkSync(outputPath);
    localClipPaths.forEach(clip => {
      if (fs.existsSync(clip)) {
        fs.unlinkSync(clip);
      }
    });
    console.log('✅ Cleanup complete');
  } catch (cleanupErr) {
    console.warn('⚠️ Cleanup warning:', cleanupErr);
    // Don't fail the function if cleanup fails
  }

  return uploadResult.secure_url;
}
