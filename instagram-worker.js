const { IgApiClient } = require('instagram-private-api');
const { workerData } = require('worker_threads');
const fs = require('fs');
const path = require('path');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const { username, password, choice, target, delay: delayMs, taskId, filePath, stopFlag } = workerData;
  const client = new IgApiClient();
  
  try {
    // 1. Configure device settings first
    client.state.generateDevice(username);
    client.request.defaults.headers = {
      'User-Agent': 'Instagram 265.0.0.19.301 iOS (15_6_1; en_US; en-US; scale=3.00; 1284x2778; 450906449)',
      'X-IG-App-ID': '124024574287414',
      'Accept-Language': 'en-US',
      'Connection': 'keep-alive'
    };

    // 2. Add login error handling
    try {
      await client.account.login(username, password);
      console.log('Login successful');
    } catch (loginError) {
      console.error('Login failed:', loginError.message);
      throw new Error('Instagram authentication failed');
    }

    // 3. Add file validation
    if (!fs.existsSync(filePath)) {
      throw new Error('Image file not found');
    }
    
    const imageBuffer = fs.readFileSync(filePath);
    const validExtensions = ['.jpg', '.jpeg', '.png'];
    const fileExt = path.extname(filePath).toLowerCase();
    
    if (!validExtensions.includes(fileExt)) {
      throw new Error('Invalid file format');
    }

    // 4. Add retry logic
    const maxAttempts = 3;
    let attempt = 1;

    while (!stopFlag.stopped) {
      try {
        const uploadResult = await client.upload.photo({
          file: imageBuffer,
          uploadId: Date.now().toString(),
          width: 1080,
          height: 1920
        });

        const thread = choice === 'inbox'
          ? client.entity.directThread([(await client.user.getIdByUsername(target)).toString()])
          : client.entity.directThread(target);

        await thread.broadcastPhoto({ 
          uploadId: uploadResult.uploadId, 
          file: imageBuffer 
        });
        
        console.log(`Successfully sent image to ${target}`);
        attempt = 1; // Reset attempt counter on success
        await delay(delayMs);

      } catch (sendError) {
        console.error(`Attempt ${attempt}/${maxAttempts} failed:`, sendError.message);
        
        if (attempt >= maxAttempts)) {
          throw new Error('Max retry attempts reached');
        }
        
        attempt++;
        await delay(5000 * attempt); // Exponential backoff
      }
    }

  } catch (error) {
    console.error('Fatal worker error:', error.message);
  } finally {
    // 5. Safe file cleanup
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (cleanupError) {
        console.error('File cleanup failed:', cleanupError.message);
      }
    }
    console.log(`Task ${taskId} terminated`);
  }
})();
