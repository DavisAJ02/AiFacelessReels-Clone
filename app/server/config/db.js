import mongoose from 'mongoose';

let memoryServer = null;

export async function connectDb() {
  let uri = process.env.MONGODB_URI;

  if (!uri && process.env.NODE_ENV !== 'production') {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri();
    process.env.MONGODB_URI = uri;
    console.log('[db] Using in-memory MongoDB for development');
  }

  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
}
