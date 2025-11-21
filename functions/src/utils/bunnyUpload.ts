// functions/src/utils/bunnyUpload.ts - Bunny CDN Upload Utility
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const BUNNY_API_KEY = process.env.BUNNY_API_KEY || '';
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE || 'dreamai';
const BUNNY_CDN_HOSTNAME = process.env.BUNNY_CDN_HOSTNAME || 'dreamai.b-cdn.net';
const BUNNY_HOSTNAME = process.env.BUNNY_HOSTNAME || 'storage.bunnycdn.com';

interface BunnyUploadOptions {
    retries?: number;
    folder?: string;
}

/**
 * Upload a file to Bunny CDN Storage
 * @param localPath - Local file path to upload
 * @param remoteName - Remote filename (without folder)
 * @param type - 'video' or 'image'
 * @param options - Upload options (retries, folder)
 * @returns CDN URL of uploaded file
 */
export async function uploadToBunny(
    localPath: string,
    remoteName: string,
    type: 'video' | 'image',
    options: BunnyUploadOptions = {}
): Promise<string> {
    const { retries = 3, folder = type === 'video' ? 'videos' : 'images' } = options;

    // Read file
    const fileBuffer = fs.readFileSync(localPath);
    const fileSize = fileBuffer.length;

    // Construct remote path
    const remotePath = `${folder}/${remoteName}`;

    // Upload URL
    const uploadUrl = `https://${BUNNY_HOSTNAME}/${BUNNY_STORAGE_ZONE}/${remotePath}`;

    console.log(`📤 [Bunny] Uploading ${type}: ${remoteName} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);

    // Retry logic
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await fetch(uploadUrl, {
                method: 'PUT',
                headers: {
                    'AccessKey': BUNNY_API_KEY,
                    'Content-Type': type === 'video' ? 'video/mp4' : 'image/jpeg',
                    'Content-Length': fileSize.toString(),
                },
                body: fileBuffer,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Bunny upload failed (${response.status}): ${errorText}`);
            }

            // Success! Return CDN URL
            const cdnUrl = `https://${BUNNY_CDN_HOSTNAME}/${remotePath}`;
            console.log(`✅ [Bunny] Uploaded successfully: ${cdnUrl}`);
            return cdnUrl;

        } catch (error: any) {
            lastError = error;
            console.error(`❌ [Bunny] Upload attempt ${attempt}/${retries} failed:`, error.message);

            if (attempt < retries) {
                const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
                console.log(`⏳ [Bunny] Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    // All retries failed
    throw new Error(`Bunny upload failed after ${retries} attempts: ${lastError?.message}`);
}

/**
 * Stitch video clips using FFmpeg and upload to Bunny CDN
 * Drop-in replacement for stitchWithCloudinary()
 */
export async function stitchWithBunny(localClipPaths: string[]): Promise<string> {
    const tmpDir = '/tmp/dream-ai';
    const outputPath = path.join(tmpDir, `final_merged_${Date.now()}.mp4`);
    const concatListPath = path.join(tmpDir, `concat_list_${Date.now()}.txt`);

    try {
        console.log('🎬 [Bunny] Starting FFmpeg stitch for', localClipPaths.length, 'clips');

        // Ensure tmp directory exists
        if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
        }

        // Create concat list file
        const concatList = localClipPaths
            .map(clipPath => `file '${clipPath}'`)
            .join('\n');
        fs.writeFileSync(concatListPath, concatList);

        // FFmpeg stitch command
        const ffmpegCmd = `ffmpeg -f concat -safe 0 -i "${concatListPath}" -c copy -y "${outputPath}"`;

        console.log('🎥 [Bunny] Executing FFmpeg...');
        execSync(ffmpegCmd, { stdio: 'pipe' });

        // Verify output exists
        if (!fs.existsSync(outputPath)) {
            throw new Error('FFmpeg failed to create output file');
        }

        const fileSize = fs.statSync(outputPath).size;
        console.log(`✅ [Bunny] FFmpeg completed: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

        // Upload to Bunny
        const remoteName = `dream_${Date.now()}.mp4`;
        const cdnUrl = await uploadToBunny(outputPath, remoteName, 'video', {
            folder: 'dream-videos-final',
            retries: 3,
        });

        return cdnUrl;

    } catch (error: any) {
        console.error('❌ [Bunny] Stitch failed:', error);
        throw error;

    } finally {
        // Cleanup temp files
        try {
            if (fs.existsSync(concatListPath)) {
                fs.unlinkSync(concatListPath);
                console.log('🗑️ [Bunny] Deleted concat list');
            }
            if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
                console.log('🗑️ [Bunny] Deleted output file');
            }
            // Delete individual clips
            for (const clipPath of localClipPaths) {
                if (fs.existsSync(clipPath)) {
                    fs.unlinkSync(clipPath);
                    console.log(`🗑️ [Bunny] Deleted clip: ${path.basename(clipPath)}`);
                }
            }
        } catch (cleanupError) {
            console.warn('⚠️ [Bunny] Cleanup warning:', cleanupError);
        }
    }
}

/**
 * Upload image to Bunny CDN
 * Drop-in replacement for uploadImage()
 */
export async function uploadImageToBunny(localPath: string): Promise<string> {
    const remoteName = `thumb_${Date.now()}.jpg`;
    return uploadToBunny(localPath, remoteName, 'image', {
        folder: 'thumbnails',
        retries: 3,
    });
}

/**
 * Universal image upload (works from both client and server)
 * Drop-in replacement for uploadImageToCloudinary()
 */
export async function uploadImageUniversal(
    input: string | Buffer,
    filename?: string
): Promise<string> {
    const remoteName = filename || `image_${Date.now()}.jpg`;

    // If input is a buffer, write to temp file first
    if (Buffer.isBuffer(input)) {
        const tmpPath = `/tmp/${remoteName}`;
        fs.writeFileSync(tmpPath, input);

        try {
            return await uploadToBunny(tmpPath, remoteName, 'image', {
                folder: 'user-images',
                retries: 3,
            });
        } finally {
            if (fs.existsSync(tmpPath)) {
                fs.unlinkSync(tmpPath);
            }
        }
    }

    // Otherwise assume it's a file path
    return uploadToBunny(input, remoteName, 'image', {
        folder: 'user-images',
        retries: 3,
    });
}

/**
 * CLIENT-SIDE upload helper
 * For React Native apps - uses fetch with base64
 */
export async function uploadImageFromClient(
    base64Data: string,
    filename?: string
): Promise<string> {
    const remoteName = filename || `face_${Date.now()}.jpg`;
    const remotePath = `user-images/${remoteName}`;

    // Convert base64 to binary
    const binaryData = Buffer.from(base64Data, 'base64');

    const uploadUrl = `https://${BUNNY_HOSTNAME}/${BUNNY_STORAGE_ZONE}/${remotePath}`;

    console.log(`📤 [Bunny Client] Uploading: ${remoteName}`);

    const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
            'AccessKey': BUNNY_API_KEY,
            'Content-Type': 'image/jpeg',
            'Content-Length': binaryData.length.toString(),
        },
        body: binaryData,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Bunny client upload failed (${response.status}): ${errorText}`);
    }

    const cdnUrl = `https://${BUNNY_CDN_HOSTNAME}/${remotePath}`;
    console.log(`✅ [Bunny Client] Uploaded: ${cdnUrl}`);
    return cdnUrl;
}