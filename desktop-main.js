const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
const fs = require('fs');

let mainWindow;
let apiProcess;
let viteProcess;
let mcpProcess;

const logFile = path.join(__dirname, 'electron-debug.log');
function log(msg) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFile, `[${timestamp}] ${msg}\n`);
    console.log(msg);
}

// Surgical port killer for Windows
function killPort(port) {
    try {
        log(`Cleaning up port ${port}...`);
        const stdout = execSync(`netstat -ano | findstr :${port}`).toString();
        const lines = stdout.split('\n');
        lines.forEach(line => {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && !isNaN(pid) && pid !== '0') {
                log(`Killing process ${pid} on port ${port}`);
                try { execSync(`taskkill /F /PID ${pid}`); } catch (e) { }
            }
        });
    } catch (e) {
        // Silent if port is clear
    }
}

fs.writeFileSync(logFile, '-- Chronos Cold Start --\n');

// Force development mode for the mosaic
const isDev = true;

function createWindow() {
    log('Creating Electron Window...');
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        backgroundColor: '#000000',
        title: "Chronos Orchestrator v2",
        frame: false, // Frameless per user request
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        show: false
    });

    Menu.setApplicationMenu(null);

    mainWindow.once('ready-to-show', () => {
        log('UI Ready');
        mainWindow.maximize(); // Maximize before showing
        mainWindow.show();
    });

    // Window control handlers
    ipcMain.handle('window-close', () => mainWindow?.close());
    ipcMain.handle('window-minimize', () => mainWindow?.minimize());
    ipcMain.handle('window-maximize', () => {
        if (mainWindow?.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow?.maximize();
        }
    });


    const loadApp = () => {
        const url = 'http://localhost:5173';
        mainWindow.loadURL(url).catch((err) => {
            log(`Retrying connection to UI...`);
            setTimeout(loadApp, 2000);
        });
    };

    setTimeout(loadApp, 3000);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Handle directory selection
ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    if (result.canceled) return null;
    return result.filePaths[0];
});

function startBackend() {
    killPort(3000);
    killPort(5173);
    killPort(8080); // Clear MCP port

    log('Launching PTY Server...');
    apiProcess = spawn('node', [path.join(__dirname, 'dist/server.js')], {
        cwd: __dirname,
        shell: true
    });

    apiProcess.stdout.on('data', (data) => log(`[API] ${data.toString().trim()}`));
    apiProcess.stderr.on('data', (data) => log(`[API ERROR] ${data.toString().trim()}`));

    log('Launching MCP Gateway...');
    // We launch MCP server via ts-node for easier local usage if not built
    // but preferred is the built version if it exists
    const mcpEntry = fs.existsSync(path.join(__dirname, 'mcp-server/dist/index.js'))
        ? 'dist/index.js'
        : 'index.ts';

    const mcpCmd = mcpEntry.endsWith('.ts') ? 'npx' : 'node';
    const mcpArgs = mcpEntry.endsWith('.ts') ? ['ts-node', 'index.ts'] : [mcpEntry];

    mcpProcess = spawn(mcpCmd, mcpArgs, {
        cwd: path.join(__dirname, 'mcp-server'),
        shell: true,
        env: { ...process.env, CHRONOS_API_URL: 'http://localhost:3000/api', PORT: '8080' }
    });

    mcpProcess.stdout.on('data', (data) => log(`[MCP] ${data.toString().trim()}`));
    mcpProcess.stderr.on('data', (data) => log(`[MCP ERROR] ${data.toString().trim()}`));

    log('Launching Vite UI Server...');
    viteProcess = spawn('npm', ['run', 'dev'], {
        cwd: path.join(__dirname, 'dashboard'),
        shell: true
    });

    viteProcess.stdout.on('data', (data) => log(`[VITE] ${data.toString().trim()}`));

    createWindow();
}

app.whenReady().then(() => {
    log('App Initialized');
    startBackend();
});

function cleanup() {
    if (apiProcess) apiProcess.kill();
    if (viteProcess) viteProcess.kill();
    if (mcpProcess) mcpProcess.kill();
}

app.on('window-all-closed', () => {
    cleanup();
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
    cleanup();
});
