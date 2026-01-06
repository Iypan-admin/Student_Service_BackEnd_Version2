# Fix for Audio Upload MIME Type Error

## Problem
When uploading audio files for the speaking module, you may encounter this error:
```
Audio upload error: {
  statusCode: '415',
  error: 'invalid_mime_type',
  message: 'mime type audio/webm is not supported'
}
```

## Solution

The `lsrw` Supabase storage bucket has MIME type restrictions that need to be updated to accept audio files.

### Method 1: Update Bucket Settings via Supabase Dashboard (Recommended)

1. Go to your **Supabase Dashboard**
2. Navigate to **Storage** → **Buckets**
3. Click on the **"lsrw"** bucket
4. Click **"Edit bucket"** or **"Settings"**
5. In the **"Allowed MIME types"** field, add the following audio formats:
   - `audio/webm`
   - `audio/ogg`
   - `audio/mpeg`
   - `audio/mp3`
   - `audio/wav`
   - `audio/wave`
   - `application/octet-stream` (as a fallback for any binary files)

6. **Save** the changes

### Method 2: Remove MIME Type Restrictions (Simpler)

If you want to allow all file types:

1. Go to **Supabase Dashboard** → **Storage** → **Buckets**
2. Click on **"lsrw"** bucket
3. Click **"Edit bucket"**
4. **Clear** the "Allowed MIME types" field (leave it empty)
5. **Save** the changes

This will allow all file types, which is simpler but less secure.

### Method 3: Use Supabase Management API

If you have access to the Supabase Management API, you can update the bucket programmatically. However, the standard Supabase JS client doesn't support updating bucket settings directly.

## Verification

After updating the bucket settings:

1. Try uploading an audio file through the student portal
2. The upload should succeed without MIME type errors
3. Check the Supabase Storage to verify the file was uploaded

## Current Workaround

The code has been updated to:
1. First try uploading without specifying a content type (let Supabase infer)
2. If that fails, try with `application/octet-stream` (generic binary type)
3. If both fail, show a clear error message with instructions

However, the best solution is to update the bucket configuration as described above.

## Notes

- The `lsrw` bucket is used for both LSRW content (audio files for listening) and speaking attempts
- Make sure the bucket has sufficient file size limits (at least 50MB for audio files)
- The bucket should be public or have proper RLS policies configured for students to access their recordings

















