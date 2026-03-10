// ==========================================
// REGISTRO DO SERVICE WORKER (PWA)
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW falhou: ', err));
    });
}

// ==========================================
// ESTADO DO APLICATIVO
// ==========================================
const AppState = {
    player: null,
    videoPool: [],
    history: JSON.parse(localStorage.getItem('rubi_history')) || [],
    isLoading: false,
    currentIndex: -1,
    currentSearch: "Lançamentos Musicais",
    isHome: true,
    isPlaying: true
};

// ==========================================
// INICIALIZAÇÃO DA INTERFACE
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Foto de perfil aleatória
    document.getElementById('avatar').style.backgroundImage = `url('https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random()}&backgroundColor=050505')`;
    
    // Bind de Eventos
    document.getElementById('searchForm').addEventListener('submit', handleSearch);
    document.getElementById('btnHome').addEventListener('click', goHome);
    document.getElementById('btnClosePlayer').addEventListener('click', closePlayer);
    
    // Controles Customizados do Player
    document.querySelectorAll('.control-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = e.currentTarget.dataset.action;
            if(action === 'prev') playPrev();
            if(action === 'next') playNext();
            if(action === 'togglePlay') togglePlayState();
        });
    });

    // Scroll Infinito
    window.addEventListener('scroll', handleInfiniteScroll);

    // Render Inicial
    renderHistory();
    fetchVideos(AppState.currentSearch, true);
});

// ==========================================
// LÓGICA DE API E BUSCA
// ==========================================
async function fetchVideos(query, clear = true) {
    if (AppState.isLoading) return;
    AppState.isLoading = true;
    
    const loader = document.getElementById('loaderScroll');
    loader.style.opacity = "1";

    if (clear) {
        document.getElementById('videoGrid').innerHTML = "";
        AppState.videoPool = [];
        AppState.currentSearch = query;
        if (query !== "Lançamentos Musicais") {
            document.getElementById('historySection').classList.add('hidden');
            AppState.isHome = false;
        }
    }

    try {
        const apiURL = `https://redzinapi-tech.onrender.com/youtube/search?query=${encodeURIComponent(query)}&apikey=REDZ`;
        const proxyURL = `https://corsproxy.io/?${encodeURIComponent(apiURL)}`;
        
        const response = await fetch(proxyURL);
        const data = await response.json();

        if (data.status && data.resultado) {
            data.resultado.forEach(v => {
                if (v.type === 'video' && !AppState.videoPool.find(item => item.id === v.videoId)) {
                    renderVideoCard(v);
                }
            });
        }
    } catch (error) {
        console.error("Erro ao buscar vídeos:", error);
    } finally {
        AppState.isLoading = false;
        loader.style.opacity = "0";
    }
}

function renderVideoCard(v) {
    const videoData = { 
        id: v.videoId, 
        title: v.title, 
        thumb: v.thumbnail || v.image, 
        artist: v.author?.name || 'YouTube', 
        duration: v.timestamp || "--:--" 
    };
    
    AppState.videoPool.push(videoData);
    
    const cardHTML = `
        <div class="cursor-pointer group fade-in" onclick="window.playVideo('${videoData.id}')">
            <div class="relative aspect-video rounded-xl overflow-hidden bg-zinc-900 mb-3 border border-zinc-800 shadow-md group-hover:border-ruby transition-all">
                <img src="${videoData.thumb}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
                <div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <i class="fa-solid fa-play text-white text-3xl drop-shadow-lg"></i>
                </div>
                <span class="absolute bottom-2 right-2 bg-black/90 px-2 py-1 rounded text-[11px] font-bold text-white tracking-wide backdrop-blur-sm border border-white/10">
                    ${videoData.duration}
                </span>
            </div>
            <div class="flex gap-3">
                <div class="w-8 h-8 rounded-full bg-zinc-800 flex-shrink-0 overflow-hidden mt-1 border border-zinc-700">
                    <img src="https://api.dicebear.com/7.x/initials/svg?seed=${videoData.artist}&backgroundColor=9B111E" class="w-full h-full">
                </div>
                <div>
                    <h3 class="font-bold text-sm text-zinc-100 line-clamp-2 leading-tight group-hover:text-ruby transition-colors">${videoData.title}</h3>
                    <p class="text-zinc-400 text-xs mt-1 font-medium">${videoData.artist}</p>
                </div>
            </div>
        </div>`;
        
    document.getElementById('videoGrid').insertAdjacentHTML('beforeend', cardHTML);
}

// ==========================================
// FUNÇÕES DO PLAYER E HISTÓRICO
// ==========================================
window.playVideo = function(id) {
    const video = AppState.videoPool.find(v => v.id === id) || AppState.history.find(v => v.id === id);
    if (!video) return;

    // Atualiza Histórico
    AppState.currentIndex = AppState.videoPool.findIndex(v => v.id === id);
    AppState.history = AppState.history.filter(v => v.id !== id);
    AppState.history.unshift(video);
    localStorage.setItem('rubi_history', JSON.stringify(AppState.history.slice(0, 15)));
    
    if (AppState.isHome) renderHistory();
    openYouTubePlayer(id);
};

function openYouTubePlayer(id) {
    const wrapper = document.getElementById('playerWrapper');
    wrapper.classList.remove('hidden');
    wrapper.classList.add('flex');
    document.body.style.overflow = 'hidden';

    // Para "esconder" os anúncios da interface, usamos os parâmetros de controle do YT
    const playerVars = { 
        'autoplay': 1, 'controls': 0, 'playsinline': 1, 
        'modestbranding': 1, 'rel': 0, 'iv_load_policy': 3, 'disablekb': 1
    };

    if (AppState.player && typeof AppState.player.loadVideoById === 'function') {
        AppState.player.loadVideoById(id);
    } else {
        // Usa a API Global declarada no HTML
        AppState.player = new window.YT.Player('ytPlayer', {
            height: '100%', width: '100%', videoId: id,
            playerVars: playerVars,
            events: { 
                'onStateChange': onPlayerStateChange,
                'onReady': () => AppState.player.playVideo()
            }
        });
    }
}

function onPlayerStateChange(event) {
    const icon = document.getElementById('playPauseIcon');
    if (event.data === window.YT.PlayerState.ENDED) playNext();
    if (event.data === window.YT.PlayerState.PLAYING) {
        AppState.isPlaying = true;
        icon.className = "fa-solid fa-pause";
    }
    if (event.data === window.YT.PlayerState.PAUSED) {
        AppState.isPlaying = false;
        icon.className = "fa-solid fa-play pl-1";
    }
}

function togglePlayState() {
    if (!AppState.player) return;
    if (AppState.isPlaying) AppState.player.pauseVideo();
    else AppState.player.playVideo();
}

function closePlayer() {
    if (AppState.player && AppState.player.stopVideo) AppState.player.stopVideo();
    const wrapper = document.getElementById('playerWrapper');
    wrapper.classList.add('hidden');
    wrapper.classList.remove('flex');
    document.body.style.overflow = 'auto';
}

function playNext() {
    if (AppState.currentIndex < AppState.videoPool.length - 1) {
        AppState.currentIndex++;
        window.playVideo(AppState.videoPool[AppState.currentIndex].id);
    }
}

function playPrev() {
    if (AppState.currentIndex > 0) {
        AppState.currentIndex--;
        window.playVideo(AppState.videoPool[AppState.currentIndex].id);
    }
}

function renderHistory() {
    const section = document.getElementById('historySection');
    const grid = document.getElementById('historyGrid');
    
    if (AppState.history.length > 0 && AppState.isHome) {
        section.classList.remove('hidden');
        grid.innerHTML = AppState.history.map(v => `
            <div class="min-w-[140px] max-w-[140px] cursor-pointer snap-start group" onclick="window.playVideo('${v.id}')">
                <div class="w-full aspect-video rounded-lg overflow-hidden border border-zinc-800 relative group-hover:border-ruby transition-colors">
                    <img src="${v.thumb}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity">
                    <div class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <i class="fa-solid fa-play text-white text-xl"></i>
                    </div>
                </div>
                <p class="text-[11px] mt-2 line-clamp-2 font-medium text-zinc-300 group-hover:text-white">${v.title}</p>
            </div>
        `).join('');
    } else {
        section.classList.add('hidden');
    }
}

// ==========================================
// UTILITÁRIOS
// ==========================================
function handleSearch(e) {
    e.preventDefault();
    const query = document.getElementById('searchInput').value.trim();
    if (query) fetchVideos(query, true);
    document.getElementById('searchInput').blur(); // Fecha o teclado no mobile
}

function goHome() {
    document.getElementById('searchInput').value = "";
    AppState.isHome = true;
    renderHistory();
    fetchVideos("Lançamentos Musicais", true);
}

function handleInfiniteScroll() {
    const scrollPos = window.innerHeight + window.scrollY;
    const threshold = document.body.offsetHeight - 800;
    
    if (scrollPos >= threshold && !AppState.isLoading) {
        fetchVideos(AppState.currentSearch, false);
    }
}
