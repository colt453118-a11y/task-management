import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ─── S3 Client (lazy singleton) ────────────────────────────────

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    const endpoint = process.env.S3_ENDPOINT;
    const region = process.env.S3_REGION ?? 'us-east-1';
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('S3 credentials not configured (S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY)');
    }

    s3Client = new S3Client({
      endpoint: endpoint || undefined,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: endpoint ? true : false,
    });
  }
  return s3Client;
}

function getBucket(): string {
  return process.env.S3_BUCKET ?? 'workmanagement-files';
}

// ─── Upload File ────────────────────────────────────────────────

export interface UploadFileParams {
  key: string;
  body: Buffer | Uint8Array | Blob | string;
  contentType?: string;
  contentLength?: number;
}

export async function uploadFile(params: UploadFileParams): Promise<{ url: string; key: string }> {
  const client = getS3Client();
  const bucket = getBucket();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: params.key,
    Body: params.body,
    ContentType: params.contentType ?? 'application/octet-stream',
  });

  await client.send(command);

  const publicUrl = process.env.S3_PUBLIC_URL
    ? `${process.env.S3_PUBLIC_URL}/${params.key}`
    : `https://${bucket}.s3.${process.env.S3_REGION ?? 'us-east-1'}.amazonaws.com/${params.key}`;

  return { url: publicUrl, key: params.key };
}

// ─── Delete File ────────────────────────────────────────────────

export async function deleteFile(key: string): Promise<void> {
  const client = getS3Client();
  const bucket = getBucket();

  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  await client.send(command);
}

// ─── Generate Presigned Upload URL ──────────────────────────────

export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 300,
): Promise<string> {
  const client = getS3Client();
  const bucket = getBucket();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

// ─── Generate Presigned Download URL ────────────────────────────

export async function getPresignedDownloadUrl(
  key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const client = getS3Client();
  const bucket = getBucket();

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}
