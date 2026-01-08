import { supabase } from '../config/supabase';

async function setupStorage() {
    console.log('Checking storage buckets...');
    const { data: buckets, error } = await supabase.storage.listBuckets();

    if (error) {
        console.error('Error listing buckets:', error);
        return;
    }

    const verificationsBucket = buckets.find(b => b.name === 'verifications');
    if (!verificationsBucket) {
        console.log('Creating "verifications" bucket...');
        const { data, error: createError } = await supabase.storage.createBucket('verifications', {
            public: true,
            fileSizeLimit: 10485760, // 10MB
        });
        if (createError) console.error('Error creating bucket:', createError);
        else console.log('Bucket "verifications" created successfully.');
    } else {
        console.log('Bucket "verifications" already exists.');
    }
}

setupStorage();
