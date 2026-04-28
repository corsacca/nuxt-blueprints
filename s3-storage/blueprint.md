# S3 Storage Block

S3-compatible file storage with presigned URLs. Works with AWS S3, Backblaze B2, and other S3-compatible services.

## Dependencies

None (standalone utilities).

## Files Provided

```
server/utils/storage.ts
```

## Package Dependencies

```json
{
  "@bradenmacdonald/s3-lite-client": "^0.9.6"
}
```

## Config

Add to `nuxt.config.ts` runtimeConfig:

```typescript
s3Endpoint: process.env.S3_ENDPOINT || '',
s3Region: process.env.S3_REGION || '',
s3AccessKeyId: process.env.S3_ACCESS_KEY_ID || '',
s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
s3BucketName: process.env.S3_BUCKET_NAME || '',
s3PublicBaseUrl: process.env.S3_PUBLIC_BASE_URL || '',
```

## Environment Variables

```env
S3_ENDPOINT=https://s3.us-west-004.backblazeb2.com
S3_REGION=us-west-004
S3_ACCESS_KEY_ID=your-access-key-id
S3_SECRET_ACCESS_KEY=your-secret-access-key
S3_BUCKET_NAME=your-bucket-name
# Optional: only required if you call uploadToS3(..., 'public') or getPublicUrl()
# Set to the custom domain attached to your bucket (e.g. Cloudflare R2 custom domain)
S3_PUBLIC_BASE_URL=https://cdn.example.com
```
