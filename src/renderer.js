const activeDownloads = new Map();

let lastSearchTerm = '';
let searchResults = [];

document.addEventListener('DOMContentLoaded', () => {

    document.getElementById('minimize').addEventListener('click', () => {
        window.electronAPI.minimizeWindow();
    });

    document.getElementById('maximize').addEventListener('click', () => {
        window.electronAPI.maximizeWindow();
    });

    document.getElementById('close').addEventListener('click', () => {
        window.electronAPI.closeWindow();
    });

 
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const pageId = item.dataset.page;
            showPage(pageId);
        });
    });

    document.querySelectorAll('.filter-select, .filter-input').forEach(element => {
        element.addEventListener('change', () => {
            if (searchResults.length > 0) {
                filterAndDisplayResults();
            }
        });
    });

    document.getElementById('search-button').addEventListener('click', () => {
        const searchTerm = document.getElementById('search-input').value.trim();
        if (searchTerm !== lastSearchTerm) {
            lastSearchTerm = searchTerm;
            performSearch();
        }
    });

   
    document.getElementById('search-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const searchTerm = e.target.value.trim();
            if (searchTerm !== lastSearchTerm) {
                lastSearchTerm = searchTerm;
                performSearch();
            }
        }
    });

    
    window.electronAPI.onDownloadUpdate((data) => {
        updateDownloadItem(data);
    });

   
    const downloadsList = document.querySelector('.downloads-list');
    if (downloadsList) {
        console.log('Downloads list found, adding event listener');
        downloadsList.addEventListener('click', handleDownloadAction);
    } else {
        console.error('Downloads list not found!');
    }


    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
    }
});


function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === pageId) {
            item.classList.add('active');
        }
    });
}


async function handleDownloadAction(e) {
    const button = e.target.closest('button');
    if (!button) return;

    const downloadItem = button.closest('.download-item');
    if (!downloadItem) return;

    const id = downloadItem.dataset.id;
    
    button.disabled = true;

    if (button.classList.contains('pause')) {
        try {
            await window.electronAPI.pauseDownload(id);
        } catch (error) {
            console.error('Download pause error:', error);
        }
    } else if (button.classList.contains('resume')) {
        try {
            await window.electronAPI.resumeDownload(id);
        } catch (error) {
            console.error('Download resume error:', error);
        }
    } else if (button.classList.contains('cancel')) {
        try {
            // Show confirmation dialog
            const confirmed = confirm('İndirmeyi iptal etmek istiyor musunuz?\nDosyaların silinmesini ister misiniz?');
            if (!confirmed) {
                button.disabled = false;
                return;
            }

            const shouldDelete = confirm('İndirilen dosyaları silmek istiyor musunuz?');
            
            const statusSpan = downloadItem.querySelector('.status');
            if (statusSpan) statusSpan.textContent = 'İptal ediliyor...';
            
            await window.electronAPI.cancelDownload(id, shouldDelete);
            
            downloadItem.remove();
            activeDownloads.delete(id);
        } catch (error) {
            console.error('Download cancel error:', error);
            button.disabled = false;
        }
    } else if (button.classList.contains('remove-from-list')) {
        try {
            downloadItem.remove();
            activeDownloads.delete(id);
        } catch (error) {
            console.error('Remove from list error:', error);
            button.disabled = false;
        }
    }
}


async function performSearch() {
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');
    const filterType = document.getElementById('filter-type');
    const sortBy = document.getElementById('sort-by');
    const resultsContainer = document.getElementById('results');
    
    const searchTerm = searchInput.value.trim();
    const category = categoryFilter.value;
    const filter = filterType.value;

    try {
        const results = await window.electronAPI.searchAnime(searchTerm, category, filter);
        
        let sortedResults = [...results];
        switch (sortBy.value) {
            case 'none':
                break;
            case 'seeders':
                sortedResults.sort((a, b) => parseInt(b.seeders) - parseInt(a.seeders));
                break;
            case 'name':
                sortedResults.sort((a, b) => a.title.localeCompare(b.title));
                break;
            case 'date':
                sortedResults.sort((a, b) => new Date(b.date) - new Date(a.date));
                break;
            case 'size':
                const getSize = (str) => {
                    const num = parseFloat(str);
                    const unit = str.toUpperCase();
                    if (unit.includes('GB')) return num * 1024;
                    if (unit.includes('MB')) return num;
                    if (unit.includes('KB')) return num / 1024;
                    return num;
                };
                sortedResults.sort((a, b) => getSize(b.size) - getSize(a.size));
                break;
            case 'downloaded':
                sortedResults.sort((a, b) => parseInt(b.completed || 0) - parseInt(a.completed || 0));
                break;
        }

        if (sortedResults.length > 0) {
            resultsContainer.innerHTML = sortedResults.map(result => createResultCard(result)).join('');
        } else {
            resultsContainer.innerHTML = `
                <div class="empty-state">
                    <span class="material-icons">search_off</span>
                    <p>Sonuç bulunamadı</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Search error:', error);
        resultsContainer.innerHTML = `
            <div class="error-state">
                <span class="material-icons">error</span>
                <p>Arama sırasında bir hata oluştu</p>
            </div>
        `;
    }
}


function createResultCard(result) {
    return `
        <div class="result-card">
            <div class="result-title">${result.title}</div>
            <div class="result-info">
                <div class="info-item">
                    <span class="material-icons">folder</span>
                    <span>${result.size}</span>
                </div>
                <div class="info-item">
                    <span class="material-icons">schedule</span>
                    <span>${result.date}</span>
                </div>
                <div class="info-item seeders">
                    <span class="material-icons">trending_up</span>
                    <span>${result.seeders}</span>
                </div>
                <div class="info-item leechers">
                    <span class="material-icons">trending_down</span>
                    <span>${result.leechers}</span>
                </div>
            </div>
            <div class="result-actions">
                <button class="download-button" onclick="startDownload('${result.magnet}', '${result.title.replace(/'/g, "\\'")}')">
                    <span class="material-icons">download</span>
                    <span>İndir</span>
                </button>
                <button class="view-button" onclick="window.open('${result.viewUrl}', '_blank')">
                    <span class="material-icons">open_in_new</span>
                    <span>Siteye Git</span>
                </button>
            </div>
        </div>
    `;
}


        function openDownloadFolder(path) {
            if (!path) {
                console.error('Invalid path');
                return;
            }
        
            console.log('Clicked path:', path);
        
            window.electronAPI.openFolder(path)
                .then(result => {
                    if (!result.success) {
                        throw new Error('Failed to open folder');
                    }
                })
                .catch(error => {
                    console.error('Error opening folder:', error);
                    alert('Klasör açılırken bir hata oluştu. Lütfen yolun doğru olduğundan emin olun.');
                });
        }


async function startDownload(magnetLink, title) {
    try {
        const downloadPath = await window.electronAPI.selectDownloadPath();
        
        if (!downloadPath) {
            return;
        }
        
     
        const normalizedPath = downloadPath.trim().replace(/"/g, '');

        console.log('Starting download:', { 
            magnetLink, 
            title, 
            downloadPath: normalizedPath,
            originalPath: downloadPath 
        });

        const result = await window.electronAPI.startDownload({ 
            magnetLink, 
            title, 
            downloadPath: normalizedPath 
        });

        if (result.success) {
            console.log('Download started successfully:', result);
            const downloadsList = document.querySelector('.downloads-list');
            if (!downloadsList) {
                console.error('Downloads list not found!');
                return;
            }

            const downloadItem = document.createElement('div');
            downloadItem.className = 'download-item';
            downloadItem.dataset.id = result.id;
            downloadItem.dataset.magnet = magnetLink;
            downloadItem.dataset.title = title;
            
            downloadItem.innerHTML = `
                <div class="download-title">${title}</div>
                <div class="download-info">
                    <span class="status">Başlatılıyor...</span>
                    <span class="speed">0 B/s</span>
                    <span class="progress">0%</span>
                    <span class="path" style="cursor: pointer;" onclick="openDownloadFolder(this.textContent)">${normalizedPath}</span>
                </div>
                <div class="download-progress">
                    <div class="progress-bar"></div>
                </div>
                <div class="download-actions">
                    <button class="download-button pause" title="Duraklat">
                        <span class="material-icons">pause</span>
                    </button>
                    <button class="download-button cancel" title="İptal Et">
                        <span class="material-icons">cancel</span>
                    </button>
                </div>
            `;
            
            downloadsList.appendChild(downloadItem);
            activeDownloads.set(result.id, { magnetLink, title, downloadPath });
            showPage('downloads');
        }
    } catch (error) {
        console.error('Download start error:', error);
        alert('İndirme başlatılırken bir hata oluştu');
    }
}

function updateDownloadItem(data) {
    const downloadItem = document.querySelector(`[data-id="${data.id}"]`);
    if (!downloadItem) return;

    const statusSpan = downloadItem.querySelector('.status');
    const speedSpan = downloadItem.querySelector('.speed');
    const progressSpan = downloadItem.querySelector('.progress');
    const progressBar = downloadItem.querySelector('.progress-bar');
    const actionsDiv = downloadItem.querySelector('.download-actions');

    switch(data.status) {
        case 'downloading':
            statusSpan.textContent = 'İndiriliyor';
            speedSpan.textContent = data.downloadSpeed || '';
            progressSpan.textContent = `${data.progress}%`;
            progressBar.style.width = `${data.progress}%`;
            actionsDiv.innerHTML = `
                <button class="download-button pause" title="Duraklat">
                    <span class="material-icons">pause</span>
                </button>
                <button class="download-button cancel" title="İptal Et">
                    <span class="material-icons">cancel</span>
                </button>
            `;
            break;
        case 'paused':
            statusSpan.textContent = 'Duraklatıldı';
            speedSpan.textContent = '0 B/s';
            actionsDiv.innerHTML = `
                <button class="download-button resume" title="Devam Et">
                    <span class="material-icons">play_arrow</span>
                </button>
                <button class="download-button cancel" title="İptal Et">
                    <span class="material-icons">cancel</span>
                </button>
            `;
            break;
        case 'completed':
            statusSpan.textContent = 'Tamamlandı';
            speedSpan.textContent = '';
            progressSpan.textContent = '100%';
            progressBar.style.width = '100%';
            progressBar.style.background = '#4CAF50';
            actionsDiv.innerHTML = `
                <button class="download-button remove-from-list" title="Listeden Kaldır">
                    <span class="material-icons">close</span>
                </button>
            `;
            
           
            showNotification('İndirme Tamamlandı', `${downloadItem.dataset.title} başarıyla indirildi.`);
            break;
    }
}


function showNotification(title, message) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body: message });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                new Notification(title, { body: message });
            }
        });
    }
}


document.addEventListener('DOMContentLoaded', () => {
    const searchButton = document.getElementById('search-button');
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');
    const filterType = document.getElementById('filter-type');
    const sortBy = document.getElementById('sort-by');

    searchButton.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });

    categoryFilter.addEventListener('change', performSearch);
    filterType.addEventListener('change', performSearch);
    sortBy.addEventListener('change', performSearch);
});