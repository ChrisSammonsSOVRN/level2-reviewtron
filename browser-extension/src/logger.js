// src/logger.js
function logMessage(message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
  }
  
  function logPerformance(checkName, startTime) {
    const duration = Date.now() - startTime;
    logMessage(`${checkName} completed in ${duration} ms`);
  }
  
  export { logMessage, logPerformance };
  