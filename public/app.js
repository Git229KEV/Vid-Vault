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
    console.log("VaultPlay v1.1 Initializing...");
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

// Fetch YouTube title + thumbnail via oEmbed (free, no API key needed)
async function fetchYouTubeOEmbed(videoId) {
    try {
        const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const res = await fetch(oEmbedUrl);
        if (!res.ok) return null;
        const data = await res.json();
        return {
            title: data.title || null,
            // oEmbed gives maxresdefault-like quality thumbnail
            image: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
        };
    } catch (e) {
        return null;
    }
}

// Fetch Vimeo title + thumbnail via oEmbed (free, no API key needed)
async function fetchVimeoOEmbed(videoId) {
    try {
        const oEmbedUrl = `https://vimeo.com/api/oembed.json?url=https://vimeo.com/${videoId}`;
        const res = await fetch(oEmbedUrl);
        if (!res.ok) return null;
        const data = await res.json();
        return {
            title: data.title || null,
            image: data.thumbnail_url || null
        };
    } catch (e) {
        return null;
    }
}

// Fetch Open Graph data via Microlink API (for generic websites)
async function fetchOpenGraphData(url) {
    // Try Microlink first
    try {
        const proxyUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}&screenshot=false&meta=true`;
        const response = await fetch(proxyUrl);
        const json = await response.json();
        
        if (json.status === 'success' && json.data) {
            let imgUrl = null;
            if (json.data.image && json.data.image.url) {
                imgUrl = json.data.image.url;
            } else if (json.data.logo && json.data.logo.url) {
                imgUrl = json.data.logo.url;
            }
            // Only return if we got at least a title
            if (json.data.title || imgUrl) {
                return {
                    title: json.data.title || null,
                    image: imgUrl
                };
            }
        }
    } catch (e) {
        // Microlink failed, try fallback
    }

    // Fallback: try jsonlink.io (another free OG scraper)
    try {
        const fallbackUrl = `https://jsonlink.io/api/extract?url=${encodeURIComponent(url)}`;
        const res = await fetch(fallbackUrl);
        if (res.ok) {
            const data = await res.json();
            if (data.title || data.images?.[0]) {
                return {
                    title: data.title || null,
                    image: data.images?.[0] || null
                };
            }
        }
    } catch (e) {
        // Both failed, try one last aggressive fallback using allorigins.win
        try {
            const allOriginsUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
            const res = await fetch(allOriginsUrl);
            if (res.ok) {
                const json = await res.json();
                const html = json.contents;
                
                // Manually extract title from HTML
                const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
                const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) || 
                                     html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
                const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
                                     html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);

                let title = null;
                if (ogTitleMatch) title = decodeEntities(ogTitleMatch[1]);
                else if (titleMatch) title = decodeEntities(titleMatch[1]);

                let image = null;
                if (ogImageMatch) image = ogImageMatch[1];

                if (title || image) {
                    return { title, image };
                }
            }
        } catch (err) {
            // All options exhausted
        }
    }

    return null;
}

// Helper to decode HTML entities
function decodeEntities(encodedString) {
    const translate_re = /&(nbsp|amp|quot|lt|gt);/g;
    const translate = {
        "nbsp":" ",
        "amp" : "&",
        "quot": "\"",
        "lt"  : "<",
        "gt"  : ">"
    };
    return encodedString.replace(translate_re, function(match, entity) {
        return translate[entity];
    }).replace(/&#(\d+);/gi, function(match, numStr) {
        const num = parseInt(numStr, 10);
        return String.fromCharCode(num);
    });
}

// Parse Video URL
async function parseVideoUrl(urlStr) {
    let cleanedUrl = cleanUrl(urlStr);
    
    if (!/^https?:\/\//i.test(cleanedUrl)) {
        cleanedUrl = 'https://' + cleanedUrl;
    }

    let platform = 'website';
    let title = 'Saved Link';
    let thumbnail = '';
    let embedUrl = cleanedUrl;

    const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const vimeoRegex = /(?:vimeo\.com\/|player\.vimeo\.com\/video\/)([0-9]+)/i;
    const fileRegex = /\.(mp4|webm|ogg)([?#].*)?$/i;

    if (ytRegex.test(cleanedUrl)) {
        platform = 'youtube';
        const videoId = cleanedUrl.match(ytRegex)[1];
        title = 'YouTube Video';
        thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`;

        // Fetch real title via oEmbed
        const oEmbed = await fetchYouTubeOEmbed(videoId);
        if (oEmbed) {
            if (oEmbed.title) title = oEmbed.title;
            if (oEmbed.image) thumbnail = oEmbed.image;
        }

    } else if (vimeoRegex.test(cleanedUrl)) {
        platform = 'vimeo';
        const videoId = cleanedUrl.match(vimeoRegex)[1];
        title = 'Vimeo Video';
        thumbnail = generateAvatarSVG('vimeo');
        embedUrl = `https://player.vimeo.com/video/${videoId}?autoplay=1&dnt=1`;

        // Fetch real title + thumbnail via oEmbed
        const oEmbed = await fetchVimeoOEmbed(videoId);
        if (oEmbed) {
            if (oEmbed.title) title = oEmbed.title;
            if (oEmbed.image) thumbnail = oEmbed.image;
        }

    } else if (fileRegex.test(cleanedUrl)) {
        platform = 'video';
        const parts = new URL(cleanedUrl).pathname.split('/');
        title = decodeURIComponent(parts[parts.length - 1]) || 'Video File';
        thumbnail = generateAvatarSVG('video');

    } else {
        // Generic Website Fallback
        try {
            const urlObj = new URL(cleanedUrl);
            const hostname = urlObj.hostname.replace(/^www\./, '');
            title = hostname; // Default: domain name
            thumbnail = generateAvatarSVG(hostname);
            
            // Try to fetch actual title and preview image
            const ogData = await fetchOpenGraphData(cleanedUrl);
            if (ogData) {
                if (ogData.title) title = ogData.title;
                if (ogData.image) thumbnail = ogData.image;
            }
            
            // If still no real thumbnail, use WordPress mshots as a fallback
            if (!thumbnail || thumbnail.startsWith('data:image/svg')) {
                thumbnail = `https://s.wordpress.com/mshots/v1/${encodeURIComponent(cleanedUrl)}?w=800`;
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
        const { data, error } = await supabaseClient
            .from('videos')
            .insert([videoData])
            .select();
            
        if (error) throw error;
        
        videos.unshift(data[0]);
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
    event.stopPropagation();
    
    videos = videos.filter(v => v.id !== id);
    renderVideos();
    
    try {
        const { error } = await supabaseClient
            .from('videos')
            .delete()
            .match({ id: id });
            
        if (error) throw error;
    } catch (err) {
        console.error("Error deleting video:", err);
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
                                <img 
                                    src="${v.thumbnail}" 
                                    alt="${escapeHtml(v.title)}" 
                                    loading="lazy" 
                                    onerror="this.onerror=null;this.src='${generateAvatarSVG(v.title || 'x')}'">
                                <div class="play-overlay">
                                    <div class="play-btn"></div>
                                </div>
                            </div>
                            <div class="card-info">
                                <div class="card-title" title="${escapeHtml(v.title)}">${escapeHtml(v.title)}</div>
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

// Escape HTML to prevent XSS in injected titles
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Open Player Modal
function openPlayer(id) {
    const video = videos.find(v => v.id === id);
    if (!video) return;

    modalTitle.textContent = video.title;
    modalExternalLink.href = video.url; // Always link to the original URL, not embed URL

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
    } else if (video.platform === 'youtube' || video.platform === 'vimeo') {
        // Trusted embed platforms — allow-same-origin so their players work
        playerWrapper.innerHTML = `
            <iframe 
                src="${video.embedUrl}" 
                sandbox="allow-scripts allow-forms allow-popups allow-presentation allow-same-origin" 
                allow="autoplay; encrypted-media; picture-in-picture" 
                allowfullscreen>
            </iframe>
        `;
    } else {
        // Generic websites — many block iframes. Show a split view:
        // Try loading iframe, but show a friendly fallback if it's blocked.
        playerWrapper.innerHTML = `
            <div class="site-frame-container">
                <iframe 
                    id="site-iframe"
                    src="${video.embedUrl}" 
                    sandbox="allow-scripts allow-forms allow-popups allow-presentation allow-same-origin"
                    allow="autoplay; encrypted-media"
                    onload="handleIframeLoad(this)"
                    onerror="showFrameBlocked('${video.url}')">
                </iframe>
                <div class="frame-blocked-overlay" id="frame-blocked" style="display:none;">
                    <div class="frame-blocked-content">
                        <div class="blocked-icon">🔒</div>
                        <h3>Site blocked embedding</h3>
                        <p>This website does not allow itself to be opened inside other apps. You can open it directly in your browser.</p>
                        <a href="${video.url}" target="_blank" rel="noopener noreferrer" class="open-external-btn">
                            Open Website →
                        </a>
                    </div>
                </div>
            </div>
        `;

        // Detect if iframe was blocked after a short wait
        setTimeout(() => detectIframeBlock(video.url), 2500);
    }

    modalOverlay.classList.add('active');
}

// Try to detect if an iframe failed to load (X-Frame-Options / CSP block)
function detectIframeBlock(originalUrl) {
    const iframe = document.getElementById('site-iframe');
    if (!iframe) return;

    try {
        // We can't actually read the content if it's cross-origin (it will throw)
        // But if it's BLOCKED by the browser (X-Frame-Options), sometimes doc is null or accessible but empty.
        const doc = iframe.contentDocument;
        
        // If we CAN access doc and it's empty, it's likely a browser-generated "blocked" page or an error
        if (doc && doc.body && doc.body.innerHTML.trim() === '') {
            showFrameBlocked(originalUrl);
        }
    } catch (e) {
        // SecurityError: This is actually GOOD news. 
        // It means the site LOADED a cross-origin document successfully.
        // If it were blocked by X-Frame-Options, modern browsers often show a restricted page 
        // that MIGHT also throw this error, making it indistinguishable.
        
        // However, we can use the "onload" timing. If it fires very quickly with a SecurityError, 
        // it might be working. 
    }
}

function handleIframeLoad(iframe) {
    // When an iframe is blocked by X-Frame-Options, browsers sometimes still fire onload
    // but the document is empty. Check for that.
    try {
        const doc = iframe.contentDocument;
        if (doc && doc.body && doc.body.innerHTML.trim() === '') {
            showFrameBlocked(iframe.src);
        }
    } catch (e) {
        // Cross-origin — this is normal for a working site
    }
}

function showFrameBlocked(originalUrl) {
    const overlay = document.getElementById('frame-blocked');
    if (overlay) overlay.style.display = 'flex';
}

// Close Modal
function closeModal() {
    modalOverlay.classList.remove('active');
    setTimeout(() => {
        playerWrapper.innerHTML = '';
    }, 300);
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
