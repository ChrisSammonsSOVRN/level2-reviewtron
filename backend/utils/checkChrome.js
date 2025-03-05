/**
 * Script to check Chrome/Chromium paths
 * This is run during postinstall to help diagnose Chrome/Chromium issues
 */

const fs = require('fs');
const { execSync } = require('child_process');

console.log('Checking Chrome/Chromium paths...');

// Check multiple possible Chrome/Chromium paths
const possiblePaths = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/nix/store/x205pbkd5xh5g4iv0n41vgpn3q0a2wmw-chromium-108.0.5359.94/bin/chromium'
];

let foundPaths = [];

for (const path of possiblePaths) {
    if (fs.existsSync(path)) {
        foundPaths.push(path);
        console.log(`Found Chrome/Chromium at: ${path}`);
        
        // Check file permissions
        try {
            const stats = fs.statSync(path);
            const isExecutable = !!(stats.mode & fs.constants.S_IXUSR);
            console.log(`Executable permission: ${isExecutable}`);
        } catch (error) {
            console.log(`Error checking permissions: ${error.message}`);
        }
    }
}

if (foundPaths.length === 0) {
    console.log('No Chrome/Chromium installations found in standard paths');
    
    // Try to find Chrome/Chromium using which
    try {
        console.log('Trying to find Chrome/Chromium using which...');
        const chromiumPath = execSync('which chromium 2>/dev/null || which chromium-browser 2>/dev/null || which google-chrome 2>/dev/null || which google-chrome-stable 2>/dev/null || echo "Not found"').toString().trim();
        console.log(`which result: ${chromiumPath}`);
        
        if (chromiumPath !== 'Not found') {
            foundPaths.push(chromiumPath);
        }
    } catch (error) {
        console.log(`Error running which: ${error.message}`);
    }
    
    // Try to find Chrome/Chromium in Nix store
    try {
        console.log('Checking Nix store for Chromium...');
        const nixFiles = execSync('find /nix/store -name "chromium" -type f 2>/dev/null || echo "Not found"').toString().trim();
        console.log(`Nix store results: ${nixFiles}`);
        
        if (nixFiles !== 'Not found') {
            nixFiles.split('\n').forEach(path => {
                if (path && path !== 'Not found') {
                    foundPaths.push(path);
                }
            });
        }
    } catch (error) {
        console.log(`Error checking Nix store: ${error.message}`);
    }
}

console.log(`Found ${foundPaths.length} Chrome/Chromium installations`);
console.log('Chrome/Chromium check complete'); 