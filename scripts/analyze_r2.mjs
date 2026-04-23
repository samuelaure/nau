import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

const r2 = new S3Client({
  region: 'auto',
  endpoint: 'https://6cc895a1e69eb42b6690f9c41ae57506.r2.cloudflarestorage.com',
  credentials: {
    accessKeyId: '7ead47521658dba039b89e467139881d',
    secretAccessKey: 'c4997eb3f385cd49521ec853e5ede9f651a8bfd8d12c1db5044e87c300416b33',
  },
});

async function analyze() {
  const Bucket = 'r2-asset-manager';
  try {
    const listResponse = await r2.send(
      new ListObjectsV2Command({
        Bucket,
      })
    );
    if (!listResponse.Contents || listResponse.Contents.length === 0) {
      console.log('Bucket is empty.');
      return;
    }
    listResponse.Contents.forEach((object) => {
      console.log(`Key: ${object.Key}, Size: ${object.Size}, LastModified: ${object.LastModified}`);
    });
  } catch (err) {
    console.error('Error analyzing R2:', err);
  }
}

analyze();
