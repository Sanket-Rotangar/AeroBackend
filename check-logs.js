const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

async function checkLogs() {
  console.log('Connecting to MongoDB...');
  console.log('URI:', uri ? uri.substring(0, 30) + '...' : 'NOT FOUND');
  
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✓ Connected to MongoDB\n');
    
    const db = client.db();
    const collections = await db.listCollections().toArray();
    console.log('Available collections:', collections.map(c => c.name).join(', '));
    
    // Check system_logs collection
    const count = await db.collection('system_logs').countDocuments();
    console.log(`\n📊 Total logs in 'system_logs' collection: ${count}`);
    
    if (count > 0) {
      console.log('\n📝 Sample logs:');
      const logs = await db.collection('system_logs').find({}).sort({ timestamp: -1 }).limit(5).toArray();
      logs.forEach((log, i) => {
        console.log(`\n[${i + 1}] ${new Date(log.timestamp).toLocaleString()}:`);
        console.log(`  Category: ${log.category}`);
        console.log(`  Message: ${log.message}`);
        console.log(`  _id: ${log._id}`);
      });
    } else {
      console.log('\n⚠️  NO LOGS FOUND IN DATABASE!');
      console.log('Creating test logs...\n');
      
      const testLogs = [
        { category: 'api', message: 'Test API log', level: 'info' },
        { category: 'mqtt', message: 'Test MQTT log', level: 'info' },
        { category: 'device', message: 'Test device log', level: 'warn' },
        { category: 'gateway', message: 'Test gateway log', level: 'error' }
      ];
      
      for (const log of testLogs) {
        await db.collection('system_logs').insertOne({
          ...log,
          details: null,
          source_id: 'test-script',
          timestamp: new Date()
        });
      }
      
      console.log(`✓ Created ${testLogs.length} test logs`);
      
      const newCount = await db.collection('system_logs').countDocuments();
      console.log(`✓ Now total logs: ${newCount}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.close();
    console.log('\n✓ Disconnected from MongoDB');
  }
}

checkLogs();
