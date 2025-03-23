const { IgApiClient } = require('instagram-private-api');
const { workerData } = require('worker_threads');
const fs = require('fs');
const path = require('path');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const { username, password, choice, target, delay: delayMs, taskId, filePath, stopFlag } = workerData;
  const client = new IgApiClient();
  
  try {
    // Configure iPhone headers
    client.state.generateDevice(username);
    client.request.defaults.headers = {
      'User-Agent': 'Instagram 265.0.0.19.301 iOS (15_6_1; en_US; en-US; scale=3.00; 1284x2778; 450906449)',
      'X-IG-App-ID': '124024574287414',
      'X-IG-Device-ID': client.state.deviceId,
      'Accept-Language': 'en-US',
      'Connection': 'keep-alive'
    };

    await client.account.login(username, password);

    // Add device simulation
    client.state.generateDevice(username);
    client.request.deviceString = `Android-${client.state.deviceId.slice(0, 16)}`;
   } catch (loginError) {
    console.error('Login failed:', loginError);
    process.exit(1);
   }
 
    const imageBuffer = fs.readFileSync(filePath);
    
    while (!stopFlag.stopped) {
      const uploadResult = await client.upload.photo({
        file: imageBuffer,
        uploadId: Date.now().toString(),
        width: 1080,
        height: 1920
      });

      const thread = choice === 'inbox'
        ? client.entity.directThread([(await client.user.getIdByUsername(target)).toString()])
        : client.entity.directThread(target);

      await thread.broadcastPhoto({ uploadId: uploadResult.uploadId, file: imageBuffer });
      console.log(`Sent image to ${target}`);
      await delay(delayMs);
    }
  } catch (error) {
    console.error('Worker error:', error);
  } finally {
    if (filePath) fs.unlinkSync(filePath);
    console.log(`Task ${taskId} ${stopFlag.stopped ? 'stopped' : 'completed'}`);
  }
})();
