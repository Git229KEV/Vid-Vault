// Supabase Config
const supabaseUrl = 'https://uusdwkexzohuvppmydid.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1c2R3a2V4em9odXZwcG15ZGlkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MzYxNjMsImV4cCI6MjA5MzAxMjE2M30.8y1uYJhoKjNQ8NzgRJ9zP6-Kon9dlR4TJs_KGtET9dA';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
    }
});

// App State
let videos = [];

// DOM Elements
const urlInput = document.getElementById('video-url-input');
const addBtn = document.getElementById('add-video-btn');
const errorMsg = document.getElementById('url-error');
const videoList = document.getElementById('video-list');
const modalOverlay = document.getElementById('player-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const playerWrapper = document.getElementById('player-wrapper');
const modalTitle = document.getElementById('modal-video-title');
const modalExternalLink = document.getElementById('modal-external-link');

// Initialize
async function init() {
    await fetchVideos();
    setupEventListeners();
}

// Fetch Videos from Supabase
async function fetchVideos() {
    try {
        const { data, error } = await supabaseClient
            .from('videos')
            .select('*')
            .order('addedAt', { ascending: false });
            
        if (error) throw error;
        videos = data || [];
        renderVideos();
    } catch (err) {
        console.error("Error fetching videos:", err);
        errorMsg.textContent = "Failed to load videos from the cloud.";
        errorMsg.style.display = 'block';
    }
}

function setupEventListeners() {
    addBtn.addEventListener('click', handleAddVideo);
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAddVideo();
    });
    
    // Modal events
    closeModalBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalOverlay.classList.contains('active')) closeModal();
    });
}

// Logic to clean URL and remove trackers
function cleanUrl(urlStr) {
    try {
        const url = new URL(urlStr);
        // List of known tracking parameters
        const trackers = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'si'];
        for (const tracker of trackers) {
            url.searchParams.delete(tracker);
        }
        return url.toString();
    } catch (e) {
        return urlStr;
    }
}

// Generate a beautiful letter avatar for websites
function generateAvatarSVG(hostname) {
    // Remove www. for the letter
    const cleanHost = hostname.replace(/^www\./, '');
    const letter = cleanHost.charAt(0).toUpperCase();
    const colors = [
        ['#FF9A9E', '#FECFEF'],
        ['#a18cd1', '#fbc2eb'],
        ['#84fab0', '#8fd3f4'],
        ['#fccb90', '#d57eeb'],
        ['#e0c3fc', '#8ec5fc'],
        ['#4facfe', '#00f2fe'],
        ['#43e97b', '#38f9d7']
    ];
    let hash = 0;
    for (let i = 0; i < cleanHost.length; i++) {
        hash = cleanHost.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorPair = colors[Math.abs(hash) % colors.length];
    
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 100 100">
        <defs>
            <linearGradient id="grad${hash}" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="${colorPair[0]}" />
                <stop offset="100%" stop-color="${colorPair[1]}" />
            </linearGradient>
        </defs>
        <rect width="100" height="100" fill="url(#grad${hash})" />
        <text x="50" y="55" fill="#ffffff" font-size="45" font-family="sans-serif" font-weight="bold" text-anchor="middle" dominant-baseline="middle">${letter}</text>
    </svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

// Fetch Open Graph data via Microlink API
async function fetchOpenGraphData(url) {
    try {
        const proxyUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}`;
        const response = await fetch(proxyUrl);
        const json = await response.json();
        
        if (json.status === 'success' && json.data) {
            let imgUrl = null;
            if (json.data.image && json.data.image.url) {
                imgUrl = json.data.image.url;
            } else if (json.data.logo && json.data.logo.url) {
                imgUrl = json.data.logo.url;
            }
            return {
                title: json.data.title || null,
                image: imgUrl
            };
        }
        return null;
    } catch (e) {
        console.error("Failed to fetch OG data", e);
        return null;
    }
}

// Parse Video URL
async function parseVideoUrl(urlStr) {
    let cleanedUrl = cleanUrl(urlStr);
    
    // Ensure URL has http/https
    if (!/^https?:\/\//i.test(cleanedUrl)) {
        cleanedUrl = 'https://' + cleanedUrl;
    }

    let platform = 'website';
    let title = 'Saved Link';
    let thumbnail = '';
    let embedUrl = cleanedUrl;

    // Updated regex to catch YouTube shorts and live streams
    const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const vimeoRegex = /(?:vimeo\.com\/|player\.vimeo\.com\/video\/)([0-9]+)/i;
    const fileRegex = /\.(mp4|webm|ogg)([?#].*)?$/i;

    if (ytRegex.test(cleanedUrl)) {
        platform = 'youtube';
        const videoId = cleanedUrl.match(ytRegex)[1];
        title = `YouTube Video`;
        thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`;
    } else if (vimeoRegex.test(cleanedUrl)) {
        platform = 'vimeo';
        const videoId = cleanedUrl.match(vimeoRegex)[1];
        title = `Vimeo Video`;
        thumbnail = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" fill="#1e1e1e"><rect width="100%" height="100%"/><text x="50%" y="50%" fill="#888" font-size="24" font-family="sans-serif" text-anchor="middle" dominant-baseline="middle">VIMEO</text></svg>');
        embedUrl = `https://player.vimeo.com/video/${videoId}?autoplay=1&dnt=1`;
    } else if (fileRegex.test(cleanedUrl)) {
        platform = 'video';
        const parts = new URL(cleanedUrl).pathname.split('/');
        title = parts[parts.length - 1] || 'Video File';
        thumbnail = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" fill="#1e1e1e"><rect width="100%" height="100%"/><text x="50%" y="50%" fill="#888" font-size="24" font-family="sans-serif" text-anchor="middle" dominant-baseline="middle">VIDEO</text></svg>');
    } else {
        // Generic Website Fallback (e.g. tamilyogi)
        try {
            const urlObj = new URL(cleanedUrl);
            title = urlObj.hostname.replace(/^www\./, '');
            thumbnail = generateAvatarSVG(title);
            
            // Try to fetch actual title and image from the website's HTML using a proxy
            const ogData = await fetchOpenGraphData(cleanedUrl);
            if (ogData) {
                if (ogData.title) title = ogData.title;
                if (ogData.image) thumbnail = ogData.image;
            }
        } catch (e) {
            throw new Error("Invalid URL format.");
        }
    }

    return {
        url: cleanedUrl,
        platform,
        title,
        thumbnail,
        embedUrl
    };
}

// Add Video
async function handleAddVideo() {
    const url = urlInput.value.trim();
    if (!url) return;

    addBtn.disabled = true;
    addBtn.textContent = 'Adding...';
    errorMsg.style.display = 'none';

    try {
        const videoData = await parseVideoUrl(url);
        // Insert to Supabase
        const { data, error } = await supabaseClient
            .from('videos')
            .insert([videoData])
            .select();
            
        if (error) throw error;
        
        videos.unshift(data[0]); // Add the returned record from DB
        renderVideos();
        urlInput.value = '';
    } catch (err) {
        if (err.code === 'PGRST205') {
            errorMsg.textContent = "Database not setup! Please run the SQL script in your Supabase dashboard.";
        } else {
            errorMsg.textContent = err.message || "Failed to add video to database.";
        }
        errorMsg.style.display = 'block';
    } finally {
        addBtn.disabled = false;
        addBtn.textContent = 'Add to Vault';
    }
}

// Delete Video
async function deleteVideo(id, event) {
    event.stopPropagation(); // Prevent opening modal
    
    // Optimistic UI update
    videos = videos.filter(v => v.id !== id);
    renderVideos();
    
    // Delete from Supabase
    try {
        const { error } = await supabaseClient
            .from('videos')
            .delete()
            .match({ id: id });
            
        if (error) throw error;
    } catch (err) {
        console.error("Error deleting video:", err);
        // Optional: reload if failed
        // await fetchVideos();
    }
}

// Group videos by date
function groupVideosByDate(videosArray) {
    const groups = {};
    
    videosArray.forEach(video => {
        const date = new Date(video.addedAt);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        let dateString;
        if (date.toDateString() === today.toDateString()) {
            dateString = 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            dateString = 'Yesterday';
        } else {
            // e.g. "Oct 15, 2023"
            dateString = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
        
        if (!groups[dateString]) groups[dateString] = [];
        groups[dateString].push(video);
    });
    
    return groups;
}

// Render Videos
function renderVideos() {
    if (videos.length === 0) {
        videoList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🎬</div>
                <h2>Your vault is empty</h2>
                <p>Paste a video or website link above to start building your private collection.</p>
            </div>
        `;
        return;
    }

    const grouped = groupVideosByDate(videos);
    let html = '';

    for (const [date, vids] of Object.entries(grouped)) {
        html += `
            <div class="date-group">
                <div class="date-header">${date}</div>
                <div class="video-grid">
                    ${vids.map(v => `
                        <div class="video-card" onclick="openPlayer('${v.id}')">
                            <div class="platform-badge">${v.platform.toUpperCase()}</div>
                            <div class="thumbnail">
                                <img src="${v.thumbnail}" alt="${v.title}" loading="lazy" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'100%\\' height=\\'100%\\' fill=\\'%231e1e1e\\'%3E%3Crect width=\\'100%\\' height=\\'100%\\'/%3E%3C/svg%3E'">
                                <div class="play-overlay">
                                    <div class="play-btn"></div>
                                </div>
                            </div>
                            <div class="card-info">
                                <div class="card-title" title="${v.title}">${v.title}</div>
                                <div class="card-meta">
                                    <span class="card-date">${new Date(v.addedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                    <button class="delete-btn" onclick="deleteVideo('${v.id}', event)" title="Delete">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polyline points="3 6 5 6 21 6"></polyline>
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    videoList.innerHTML = html;
}

// Open Player Modal
function openPlayer(id) {
    const video = videos.find(v => v.id === id);
    if (!video) return;

    modalTitle.textContent = video.title;
    modalExternalLink.href = video.embedUrl;
    
    if (video.platform === 'video') {
        let type = "video/mp4";
        if (video.embedUrl.toLowerCase().includes(".webm")) type = "video/webm";
        if (video.embedUrl.toLowerCase().includes(".ogg")) type = "video/ogg";

        playerWrapper.innerHTML = `
            <video controls autoplay name="media" style="width: 100%; height: 100%; outline: none; background-color: #000;">
                <source src="${video.embedUrl}" type="${type}">
                Your browser does not support the video tag.
            </video>
        `;
    } else {
        // Sandboxed iframe for privacy (in-app browser).
        // allow-scripts is needed for website functionality
        // allow-same-origin is included ONLY if it's a known embed platform to allow their players to work properly, otherwise omitted.
        const sandboxAttrs = (video.platform === 'youtube' || video.platform === 'vimeo') 
            ? "allow-scripts allow-forms allow-popups allow-presentation allow-same-origin"
            : "allow-scripts allow-forms allow-popups allow-presentation";
            
        playerWrapper.innerHTML = `
            <iframe 
                src="${video.embedUrl}" 
                sandbox="${sandboxAttrs}" 
                allow="autoplay; encrypted-media; picture-in-picture" 
                allowfullscreen>
            </iframe>
        `;
    }

    modalOverlay.classList.add('active');
}

// Close Modal
function closeModal() {
    modalOverlay.classList.remove('active');
    // Clear iframe/video to stop playback
    setTimeout(() => {
        playerWrapper.innerHTML = '';
    }, 300); // Wait for transition
}

// Start app
init();

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(registration => {
            console.log('SW registered: ', registration);
        }).catch(registrationError => {
            console.log('SW registration failed: ', registrationError);
        });
    });
}
