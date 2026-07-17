# Update LSRW Bucket for Image Support

## Problem
The `lsrw` Supabase storage bucket currently only allows these MIME types:
- `audio/mpeg`
- `audio/mp3`
- `audio/wav`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- `application/msword`

The Writing module needs to upload image files (JPEG, PNG), which are currently blocked.

## Solution
Update the bucket configuration in Supabase Dashboard to include image MIME types.

## Steps to Update

1. **Go to Supabase Dashboard**
   - Navigate to your Supabase project
   - Go to **Storage** → **Buckets**

2. **Find the `lsrw` bucket**
   - Click on the `lsrw` bucket name

3. **Edit Bucket Settings**
   - Click **"Edit bucket"** or **"Settings"** button
   - Find the **"Allowed MIME types"** field

4. **Add Image MIME Types**
   Add these three image types to the existing list:
   - `image/jpeg`
   - `image/jpg`
   - `image/png`

5. **Final MIME Types List**
   The complete list should be:
   ```
   audio/mpeg
   audio/mp3
   audio/wav
   application/vnd.openxmlformats-officedocument.wordprocessingml.document
   application/msword
   image/jpeg
   image/jpg
   image/png
   ```

6. **Save Changes**
   - Click **"Save"** or **"Update bucket"**

## Alternative: Remove MIME Type Restrictions

If you want to allow all file types (less secure but more flexible):
- Leave the **"Allowed MIME types"** field **empty**
- This will allow any file type to be uploaded

## Verification

After updating, test by:
1. Going to the Student Portal
2. Navigate to LSRW → Writing tab
3. Try uploading a writing submission image
4. It should now work without the 415 error

## Script

Run the helper script to see current bucket configuration:
```bash
node scripts/updateLSRWBucketForImages.js
```

This script will:
- Show current bucket configuration
- Provide step-by-step instructions
- Display the exact MIME types that need to be added










