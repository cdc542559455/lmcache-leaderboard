import fs from 'fs/promises';
import path from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGunzip } from 'zlib';
import tar from 'tar-stream';
import { Readable } from 'stream';

// Helper function to extract tarball using pure JavaScript (no binary dependencies)
export async function extractTarball(tarballBuffer, targetDir) {
  await fs.mkdir(targetDir, { recursive: true });

  const extract = tar.extract();

  return new Promise((resolve, reject) => {
    extract.on('entry', async (header, stream, next) => {
      try {
        // Remove the first path component (strip-components=1)
        const parts = header.name.split('/');
        if (parts.length <= 1) {
          stream.resume();
          next();
          return;
        }

        const filePath = path.join(targetDir, ...parts.slice(1));

        if (header.type === 'directory') {
          await fs.mkdir(filePath, { recursive: true });
          stream.resume();
          next();
        } else if (header.type === 'file') {
          await fs.mkdir(path.dirname(filePath), { recursive: true });
          const writeStream = createWriteStream(filePath);
          await pipeline(stream, writeStream);
          next();
        } else {
          stream.resume();
          next();
        }
      } catch (error) {
        reject(error);
      }
    });

    extract.on('finish', resolve);
    extract.on('error', reject);

    // Convert ArrayBuffer to Buffer if needed
    const buffer = Buffer.isBuffer(tarballBuffer)
      ? tarballBuffer
      : Buffer.from(tarballBuffer);

    // Create readable stream from buffer and pipe through gunzip
    const readable = Readable.from(buffer);
    const gunzip = createGunzip();
    readable.pipe(gunzip).pipe(extract);
  });
}
