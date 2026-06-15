const { MongoClient, GridFSBucket } = require('mongodb');

const uri = "mongodb://shindeaditya7172_db_user:adzMU0wyZucyN2tH@ac-gc7jkrc-shard-00-00.28ptlgm.mongodb.net:27017,ac-gc7jkrc-shard-00-01.28ptlgm.mongodb.net:27017,ac-gc7jkrc-shard-00-02.28ptlgm.mongodb.net:27017/pdf-reader-ai?retryWrites=true&w=majority&ssl=true&replicaSet=atlas-igrs4x-shard-0&authSource=admin";

async function run() {
  console.log("Connecting...");
  const client = new MongoClient(uri);
  await client.connect();
  console.log("Connected.");
  const db = client.db();
  const bucket = new GridFSBucket(db, { bucketName: 'pdfs' });

  // Generate 15MB of dummy data
  console.log("Generating 15MB buffer...");
  const size = 15 * 1024 * 1024;
  const buffer = Buffer.alloc(size, 'a');

  console.log("Uploading dummy file...");
  const uploadStream = bucket.openUploadStream("dummy-15mb-file.txt", {
    metadata: { username: "test" }
  });

  uploadStream.end(buffer);

  await new Promise((resolve, reject) => {
    uploadStream.on('finish', () => {
      console.log("Upload finished. File ID:", uploadStream.id.toString());
      resolve();
    });
    uploadStream.on('error', (err) => {
      console.error("Upload failed:", err);
      reject(err);
    });
  });

  // Clean up
  console.log("Deleting dummy file...");
  await bucket.delete(uploadStream.id);
  console.log("Cleaned up.");

  await client.close();
  console.log("Done.");
}

run().catch(console.error);
