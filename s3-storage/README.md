# S3 Storage Block

S3-compatible file storage with presigned URLs. Works with AWS S3, Backblaze B2, Cloudflare R2, and other S3-compatible services.

## What You Get

- `uploadToS3()` -- upload files to your bucket
- `deleteFromS3()` -- delete files from your bucket
- `generateSignedUrl()` -- create time-limited download URLs
- Image type and file size validation helpers

## Files

```
server/utils/storage.ts
```

## Environment Variables

```env
S3_ENDPOINT=https://s3.us-west-004.backblazeb2.com
S3_REGION=us-west-004
S3_ACCESS_KEY_ID=your-access-key-id
S3_SECRET_ACCESS_KEY=your-secret-access-key
S3_BUCKET_NAME=your-bucket-name
```

### Where to get S3 credentials

#### AWS S3

1. Go to [AWS S3 Console](https://console.aws.amazon.com/s3/) and create a bucket
2. Go to [AWS IAM Console](https://console.aws.amazon.com/iam/) and create a user with `AmazonS3FullAccess` (or a scoped policy for your bucket)
3. Create an access key for that user

```env
S3_ENDPOINT=https://s3.us-east-1.amazonaws.com
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
S3_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
S3_BUCKET_NAME=my-app-uploads
```

#### Backblaze B2

1. Sign up at [backblaze.com](https://www.backblaze.com/cloud-storage)
2. Create a bucket in **B2 Cloud Storage > Buckets**
3. Go to **App Keys** and create a new application key scoped to your bucket
4. The endpoint format is `https://s3.{region}.backblazeb2.com`

```env
S3_ENDPOINT=https://s3.us-west-004.backblazeb2.com
S3_REGION=us-west-004
S3_ACCESS_KEY_ID=<your keyID>
S3_SECRET_ACCESS_KEY=<your applicationKey>
S3_BUCKET_NAME=my-app-uploads
```

#### Cloudflare R2

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) > R2 Object Storage
2. Create a bucket
3. Go to **Manage R2 API Tokens** and create a token with read/write access
4. The endpoint format is `https://<account-id>.r2.cloudflarestorage.com`

```env
S3_ENDPOINT=https://abc123.r2.cloudflarestorage.com
S3_REGION=auto
S3_ACCESS_KEY_ID=<your access key>
S3_SECRET_ACCESS_KEY=<your secret key>
S3_BUCKET_NAME=my-app-uploads
```

### Where to put it

Add to `.env` in your project root.

## Dependencies

None (standalone utilities, no database tables).

## npm Packages

```
@aws-sdk/client-s3 ^3.914.0
@aws-sdk/s3-request-presigner ^3.914.0
```
