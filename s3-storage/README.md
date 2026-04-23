# S3 Storage Block

S3-compatible file storage with presigned URLs. Works with AWS S3, Backblaze B2, Cloudflare R2, and other S3-compatible services.

## What You Get

- `uploadToS3()` -- upload files to your bucket (private by default, or public)
- `deleteFromS3()` -- delete files from your bucket
- `generateSignedUrl()` -- create time-limited download URLs
- `getPublicUrl()` -- build a stable public URL for an object key
- Image type and file size validation helpers

## Public vs Private Uploads

`uploadToS3(buffer, filename, contentType, visibility)` takes an optional 4th
argument:

- `'private'` (default) -- returns a signed URL that expires in 7 days. Use
  for user-uploaded documents, attachments, or anything that should not be
  linked from a public page.
- `'public'` -- returns a stable URL built from `S3_PUBLIC_BASE_URL`. Use for
  images or assets rendered on public pages that need a cacheable,
  non-expiring URL.

Public mode requires `S3_PUBLIC_BASE_URL` to be set; it will throw otherwise.

### Cloudflare R2 note (one-bucket model)

Public access on R2 is granted at the bucket level by attaching a custom
domain. Once attached, every object in the bucket is reachable via that
domain -- including ones uploaded with `'private'`. The block uses a single
bucket, so "private" here means "signed URL returned," not "unreachable by
the public." Random 16-byte hex keys make objects unguessable in practice,
but this is not a hard access boundary. If you need a strict boundary, use
two separate buckets (one without a custom domain) and adjust the block
accordingly.

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
# Optional -- only required for public uploads
S3_PUBLIC_BASE_URL=https://cdn.example.com
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
