const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const cheerio = require('cheerio')
const fetch = require('node-fetch')
const fs = require('fs-extra')

let mainWindow
let client
let downloads = new Map() 

async function initWebTorrent() {
    const WebTorrent = await import('webtorrent')
    client = new WebTorrent.default()
    console.log('WebTorrent initialized')
}

async function createWindow() {
    await initWebTorrent()
    mainWindow = new BrowserWindow({
        icon: path.join(__dirname, './icon.ico'),
        width: 1200,
        height: 800,
        frame: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    })

    mainWindow.loadFile('src/index.html')
}

app.whenReady().then(createWindow)


ipcMain.on('minimize-window', () => mainWindow.minimize())
ipcMain.on('maximize-window', () => {
    if (mainWindow.isMaximized()) {
        mainWindow.restore()
    } else {
        mainWindow.maximize()
    }
})
ipcMain.on('close-window', () => mainWindow.close())

ipcMain.handle('open-folder', async (event, folderPath) => {
    try {
        
        const normalizedPath = folderPath
            .replace(/İ/g, 'I')
            .replace(/Ğ/g, 'G')
            .replace(/Ü/g, 'U')
            .replace(/Ş/g, 'S')
            .replace(/Ö/g, 'O')
            .replace(/Ç/g, 'C')
            .replace(/ı/g, 'i')
            .replace(/ğ/g, 'g')
            .replace(/ü/g, 'u')
            .replace(/ş/g, 's')
            .replace(/ö/g, 'o')
            .replace(/ç/g, 'c')
            .trim()
            .replace(/"/g, '');
       
        const windowsPath = path.normalize(normalizedPath);
        console.log('Original path:', folderPath);
        console.log('Normalized path:', windowsPath);
       
        if (await fs.pathExists(windowsPath)) {
            require('child_process').spawn('explorer.exe', [windowsPath]);
            return { success: true };
        }
        const parentDir = path.dirname(windowsPath);
        if (await fs.pathExists(parentDir)) {
            require('child_process').spawn('explorer.exe', [parentDir]);
            return { success: true };
        }
        console.error('Path not found:', windowsPath);
        return { success: false, error: 'Path not found' };
    } catch (error) {
        console.error('Error opening folder:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('searchAnime', async (event, query, category, filter) => {
    try {
        console.log('Search params:', { query, category, filter });
        
       
        let searchUrl = 'https://nyaa.si/';
        
        const params = new URLSearchParams();
        
  
        if (category && category !== '0_0') {
            params.append('c', category);
        }
        
     
        if (filter && filter !== '0') {
            params.append('f', filter);
        }
        
     
        if (query) {
            params.append('q', query);
        }
        
       
        const queryString = params.toString();
        if (queryString) {
            searchUrl += '?' + queryString;
        }
        
        console.log('Search URL:', searchUrl);
        
        const response = await fetch(searchUrl);
        const html = await response.text();
        const $ = cheerio.load(html);
        
        const results = [];
        $('tr').each((i, el) => {
            if (i === 0) return 
            
            const $el = $(el);
            const title = $el.find('td:nth-child(2) a:last-child').text().trim();
            const magnet = $el.find('td:nth-child(3) a:last-child').attr('href');
            const size = $el.find('td:nth-child(4)').text();
            const date = $el.find('td:nth-child(5)').text();
            const seeders = $el.find('td:nth-child(6)').text();
            const leechers = $el.find('td:nth-child(7)').text();
            const viewUrl = 'https://nyaa.si' + $el.find('td:nth-child(2) a:last-child').attr('href');
            
            if (title && magnet) {
                results.push({ title, magnet, size, date, seeders, leechers, viewUrl });
            }
        });
        
        console.log(`Found ${results.length} results`);
        return results;
    } catch (error) {
        console.error('Search error:', error);
        throw error;
    }
});


ipcMain.handle('start-download', async (event, { magnetLink, title, downloadPath }) => {
    try {
        if (!client) throw new Error('WebTorrent not initialized')
        const normalizedPath = downloadPath
            .replace(/İ/g, 'I')
            .replace(/Ğ/g, 'G')
            .replace(/Ü/g, 'U')
            .replace(/Ş/g, 'S')
            .replace(/Ö/g, 'O')
            .replace(/Ç/g, 'C')
            .replace(/ı/g, 'i')
            .replace(/ğ/g, 'g')
            .replace(/ü/g, 'u')
            .replace(/ş/g, 's')
            .replace(/ö/g, 'o')
            .replace(/ç/g, 'c')
            .trim()
            .replace(/"/g, '');
        const savePath = normalizedPath || path.join(app.getPath('downloads'), 'Nyaa Downloads');
        
        return new Promise((resolve, reject) => {
            try {
                const torrent = client.add(magnetLink, { path: savePath }, (torrent) => {
                    const id = torrent.infoHash
                    downloads.set(id, torrent)
                    
                    let lastUpdate = Date.now()
                    let isCompleted = false
                    
                    torrent.on('download', (bytes) => {
                        const now = Date.now()
                        
                        if (now - lastUpdate > 1000) {
                            lastUpdate = now
                            if (!torrent.paused && !isCompleted) {
                                const progress = (torrent.progress * 100).toFixed(1)
                                
                                
                                if (progress >= 100 && !isCompleted) {
                                    isCompleted = true
                                    mainWindow.webContents.send('download-update', {
                                        id,
                                        status: 'completed',
                                        progress: 100,
                                        downloadSpeed: '0 B/s',
                                        downloaded: formatBytes(torrent.length),
                                        total: formatBytes(torrent.length)
                                    })
                                    
                                  
                                    client.remove(torrent, false)
                                    downloads.delete(id)
                                } else {
                                    mainWindow.webContents.send('download-update', {
                                        id,
                                        status: 'downloading',
                                        progress: progress,
                                        downloadSpeed: formatBytes(torrent.downloadSpeed) + '/s',
                                        downloaded: formatBytes(torrent.downloaded),
                                        total: formatBytes(torrent.length)
                                    })
                                }
                            }
                        }
                    })

                    torrent.on('done', () => {
                        if (!isCompleted) {
                            isCompleted = true
                            mainWindow.webContents.send('download-update', {
                                id,
                                status: 'completed',
                                progress: 100,
                                downloadSpeed: '0 B/s',
                                downloaded: formatBytes(torrent.length),
                                total: formatBytes(torrent.length)
                            })
                            
                          
                            client.remove(torrent, false)
                            downloads.delete(id)
                        }
                    })

                    resolve({ success: true, id })
                })

                torrent.on('error', (err) => {
                    console.error('Torrent error:', err)
                    reject(err)
                })
            } catch (error) {
                console.error('Error adding torrent:', error)
                reject(error)
            }
        })
    } catch (error) {
        console.error('Download error:', error)
        throw error
    }
})

ipcMain.handle('pause-download', async (event, id) => {
    console.log('Pause request received for ID:', id)
    try {
        const torrent = downloads.get(id)
        if (!torrent) throw new Error('Torrent not found')
        
       
        torrent.pause()
        
       
        torrent.wires.forEach(wire => wire.pause())
        

        mainWindow.webContents.send('download-update', {
            id,
            status: 'paused',
            progress: (torrent.progress * 100).toFixed(1),
            downloadSpeed: '0 B/s'
        })
        
        return { success: true }
    } catch (error) {
        console.error('Pause error:', error)
        throw error
    }
})

ipcMain.handle('resume-download', async (event, id) => {
    console.log('Resume request received for ID:', id)
    try {
        const torrent = downloads.get(id)
        if (!torrent) throw new Error('Torrent not found')
        
       
        torrent.resume()
        
     
        torrent.wires.forEach(wire => wire.resume())
        
       
        mainWindow.webContents.send('download-update', {
            id,
            status: 'downloading',
            progress: (torrent.progress * 100).toFixed(1),
            downloadSpeed: formatBytes(torrent.downloadSpeed) + '/s'
        })
        
        return { success: true }
    } catch (error) {
        console.error('Resume error:', error)
        throw error
    }
})

ipcMain.handle('remove-download', async (event, id) => {
    try {
        const torrent = downloads.get(id)
        if (!torrent) throw new Error('Torrent not found')
        
        client.remove(torrent)
        downloads.delete(id)
        return { success: true }
    } catch (error) {
        console.error('Remove error:', error)
        throw error
    }
})

ipcMain.handle('cancelDownload', async (event, id, shouldDelete) => {
    console.log('Cancel request received for ID:', id, 'Should delete files:', shouldDelete);
    try {
        const torrent = downloads.get(id);
        if (!torrent) {
            console.log('Torrent already removed:', id);
            return { success: true };
        }

        console.log('Removing torrent:', id);

        torrent.pause();
        torrent.wires.forEach(wire => wire.pause());

        const downloadPath = torrent.path;
        const files = torrent.files.map(file => path.join(downloadPath, file.path));

        await new Promise((resolve) => {
            client.remove(torrent.infoHash, { removeFiles: shouldDelete }, (err) => {
                if (err) {
                    console.error('Error removing torrent:', err);
                }
                resolve();
            });
        });

        if (shouldDelete) {
            try {
                for (const file of files) {
                    if (await fs.pathExists(file)) {
                        await fs.remove(file);
                        console.log('Deleted file:', file);
                    }
                }
               
                if (await fs.pathExists(downloadPath)) {
                    const items = await fs.readdir(downloadPath);
                    if (items.length === 0) {
                        await fs.remove(downloadPath);
                        console.log('Removed empty directory:', downloadPath);
                    }
                }
            } catch (error) {
                console.error('Error deleting files:', error);
            }
        }

        downloads.delete(id);
        console.log('Torrent removed successfully:', id);

        return { success: true };
    } catch (error) {
        console.error('Cancel error:', error);
        throw error;
    }
});

function formatBytes(bytes) {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})


ipcMain.handle('select-download-path', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'İndirme Konumunu Seçin'
    });
    return result.filePaths[0];
});