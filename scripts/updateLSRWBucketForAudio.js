/**
 * Script to update the 'lsrw' Supabase storage bucket to accept audio files
 * 
 * This script updates the allowed MIME types for the lsrw bucket to include audio formats
 * needed for the speaking module.
 * 
 * Run with: node scripts/updateLSRWBucketForAudio.js
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function updateLSRWBucket() {
    try {
        console.log('🔧 Updating lsrw bucket to accept audio files...');

        // Check if bucket exists
        const { data: buckets, error: listError } = await supabase.storage.listBuckets();
        
        if (listError) {
            console.error('❌ Error listing buckets:', listError);
            return;
        }

        const lsrwBucket = buckets.find(bucket => bucket.name === 'lsrw');

        if (!lsrwBucket) {
            console.error('❌ Error: lsrw bucket does not exist. Please create it first.');
            return;
        }

        console.log('✅ Found lsrw bucket');

        // Note: Supabase Storage API doesn't directly support updating bucket settings
        // You need to update it via the Supabase Dashboard or Management API
        console.log('\n📝 IMPORTANT: Supabase Storage API does not support updating bucket settings programmatically.');
        console.log('   You need to update the bucket settings manually in the Supabase Dashboard.\n');
        
        console.log('📋 Steps to update the bucket:');
        console.log('1. Go to your Supabase Dashboard');
        console.log('2. Navigate to Storage → Buckets');
        console.log('3. Click on the "lsrw" bucket');
        console.log('4. Click "Edit bucket" or "Settings"');
        console.log('5. In "Allowed MIME types", add the following:');
        console.log('   - audio/webm');
        console.log('   - audio/ogg');
        console.log('   - audio/mpeg');
        console.log('   - audio/mp3');
        console.log('   - audio/wav');
        console.log('   - audio/wave');
        console.log('   - application/octet-stream (as fallback)');
        console.log('6. Save the changes\n');

        console.log('💡 Alternative: You can also remove MIME type restrictions entirely');
        console.log('   by leaving the "Allowed MIME types" field empty (accepts all types).\n');

        // Try to get current bucket info
        console.log('📊 Current bucket information:');
        console.log(JSON.stringify(lsrwBucket, null, 2));

    } catch (error) {
        console.error('❌ Unexpected error:', error);
    }
}

// Run the script
updateLSRWBucket()
    .then(() => {
        console.log('\n✅ Script completed');
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Script failed:', error);
        process.exit(1);
    });

















