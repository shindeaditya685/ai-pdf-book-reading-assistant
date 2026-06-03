import { MongoClient } from 'mongodb';

const uri = "mongodb://shindeaditya7172_db_user:1nWcXnYzhZScIkX0@ac-gc7jkrc-shard-00-00.28ptlgm.mongodb.net:27017,ac-gc7jkrc-shard-00-01.28ptlgm.mongodb.net:27017,ac-gc7jkrc-shard-00-02.28ptlgm.mongodb.net:27017/pdf-reader-ai?retryWrites=true&w=majority&ssl=true&replicaSet=atlas-igrs4x-shard-0&authSource=admin";
const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();
    const db = client.db('pdf-reader-ai');
    console.log("Connected to MongoDB!");

    const annotations = await db.collection('sharedAnnotations').find({ type: 'drawing' }).toArray();
    console.log(`Found ${annotations.length} shared drawings:`);
    console.log(JSON.stringify(annotations, null, 2));

    const annotations2 = await db.collection('annotations').find({ type: 'drawing' }).toArray();
    console.log(`Found ${annotations2.length} personal drawings:`);
    console.log(JSON.stringify(annotations2, null, 2));
  } finally {
    await client.close();
  }
}

run().catch(console.dir);
