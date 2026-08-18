# S3 bucket setup — verification documents

This project's actual bucket is **Cloudflare R2** — see "File storage (S3)" in
`backend/README.md` for the R2-specific walkthrough (dashboard CORS/lifecycle,
R2 API tokens instead of IAM, no encryption step needed). The commands and
JSON files below are the plain-AWS-S3 reference version; R2's S3-compatible
API accepts the same CORS/lifecycle JSON shapes if you'd rather script it with
`aws s3api --endpoint-url https://<ACCOUNT_ID>.r2.cloudflarestorage.com` than
use the dashboard. `s3-iam-policy.json` and `s3-encryption.json` are AWS-only
(R2 uses scoped R2 API tokens instead of IAM, and encrypts at rest by default).

Ownership-proof documents (`applications.document_file`) are stored in S3, never
in this repo's database — see `backend/src/util/s3.js`. Uploads/downloads
go through short-lived presigned URLs (5 min upload, 15 min download); the app
never touches the raw file bytes.

Apply the policies in this directory to the bucket named in `AWS_S3_BUCKET`
(`.env.example`):

```
aws s3api put-bucket-lifecycle-configuration \
  --bucket propgather-verification-docs \
  --lifecycle-configuration file://s3-lifecycle.json

aws s3api put-bucket-encryption \
  --bucket propgather-verification-docs \
  --server-side-encryption-configuration file://s3-encryption.json

aws s3api put-bucket-cors \
  --bucket propgather-verification-docs \
  --cors-configuration file://s3-cors.json
```

- **`s3-lifecycle.json`** — auto-expires everything under `verification-docs/`
  after 14 days. This is a *backstop*, not the primary deletion path: the app
  itself purges `document_file` for decided applications after 14 days via
  `backend/src/jobs/purgeApplications.js` (`npm run purge`, or the in-process
  daily job started from `src/index.js`). The bucket rule guarantees deletion
  even if that job never runs.
- **`s3-encryption.json`** — default server-side encryption (SSE-S3/AES256)
  for every object in the bucket, satisfying the "encrypted storage" claim in
  `src/pages/PrivacyPage.jsx`.
- **`s3-cors.json`** — allows the frontend origins (local dev + the GitHub
  Pages demo + production domain) to `PUT`/`GET` directly against presigned
  URLs. Update the origin list when the production domain changes.
- **`s3-iam-policy.json`** — least-privilege policy for the credentials in
  `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`: scoped to
  `PutObject`/`GetObject`/`DeleteObject` under `verification-docs/*` in this
  bucket only. Attach it to the IAM user or role the backend runs as.

None of this is applied automatically — these are reference configs to hand to
whoever provisions the bucket (Terraform/CDK/console), not something the
Node process runs at boot.
