let youtubeIframe = null;
let isMuted = false;
let siteData = null; // Store global site data for start menu actions

document.addEventListener('DOMContentLoaded', function() {

    // Get elements
    const bootSequence = document.getElementById('boot-sequence');
    const bootText = document.getElementById('boot-text');
    const loginScreen = document.getElementById('login-screen');
    const startupSound = document.getElementById('startup-sound');
    const welcomeSound = document.getElementById('welcome-sound');
    const videoBackground = document.getElementById('video-background');
    
    // YouTube video ID
    const youtubeVideoId = 'fxjIthZY3YI';

    const SKIP_BIOS_TEXT = false;
    const LOGIN = {
        gif: './resources/images/logon.gif',
        duration: 12.4,
        promptAt: 11,
        freezeBeforeEnd: 0.8,
    };
    const PATCH = { sx: 770, sy: 482, w: 100, h: 76 };
    const preloadGif = new Image();
    preloadGif.src = LOGIN.gif;
    
    // Boot sequence text
    const bootLines = [
        "BIOS Version 2.0.3.0phanim",
        "Copyright (C) 1998, .0phanim Systems",
        "",
        "Initializing CPU cores... [ OK ]",
        "Memory Test: 16384MB [ OK ]",
        "Detecting primary disk... [ OK ]",
        "Initializing /dev/sda... [ OK ]",
        "Mounting /dev/sda1 on /boot... [ OK ]",
        "Mounting /dev/sda2 on /... [ OK ]",
        "Checking file system integrity... [ OK ]",
        "Loading kernel modules... [ OK ]",
        "Starting system services:",
        "Starting hamster wheel:",
        "  - systemd... [ OK ]",
        "  - networking... [ OK ]",
        "  - firewall... [ OK ]",
        "  - ssh daemon... [ OK ]",
        "  - graphics subsystem... [ OK ]",
        "",
        "Welcome to .0phanim//OS v1.0.4",
        "Starting desktop environment...",
        ""
    ];
    
    const totalBootTime = 3000;
    const timePerLine = totalBootTime / bootLines.length;
    
    function displayBootSequence(lines, index = 0) {
        if (index >= lines.length) {
            bootSequence.classList.add('hidden');
            startLogin();
            return;
        }
        bootText.innerHTML += lines[index] + "\n";
        setTimeout(() => displayBootSequence(lines, index + 1), timePerLine);
    }
    
    displayBootSequence(SKIP_BIOS_TEXT ? [] : bootLines);
    
    async function gifDuration(url) {
        try {
            const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
            let i = 13;
            if (buf[10] & 0x80) i += 3 * (1 << ((buf[10] & 7) + 1));
            let total = 0;
            while (i < buf.length && buf[i] !== 0x3B) {
                if (buf[i] === 0x21) {
                    if (buf[i + 1] === 0xF9) { const d = buf[i + 4] | (buf[i + 5] << 8); total += d <= 1 ? 10 : d; }
                    i += 2;
                    while (buf[i] !== 0) i += buf[i] + 1;
                    i++;
                } else if (buf[i] === 0x2C) {
                    const packed = buf[i + 9];
                    i += 10;
                    if (packed & 0x80) i += 3 * (1 << ((packed & 7) + 1));
                    i++;
                    while (buf[i] !== 0) i += buf[i] + 1;
                    i++;
                } else break;
            }
            return total / 100;
        } catch (e) { return null; }
    }

    function startLogin() {
        const img = document.getElementById('login-gif');
        const patch = document.getElementById('login-patch');
        const typed = document.getElementById('login-typed');
        const textEl = document.getElementById('login-text');
        const input = document.getElementById('username');
        const gate = document.getElementById('login-gate');
        const freezeCanvas = document.getElementById('login-freeze');
        const ctx = patch.getContext('2d');
        let active = false;
        let frozen = false;
        let freezeAfter = LOGIN.duration - LOGIN.freezeBeforeEnd;
        let startedAt = null;

        loginScreen.classList.remove('hidden');

        function activate(withClip = true) {
            if (active) return;
            active = true;
            if (withClip) patch.style.visibility = 'visible';
            typed.classList.remove('hidden');
            input.focus();
        }

        function freeze() {
            if (frozen || !img.naturalWidth) return;
            frozen = true;
            freezeCanvas.width = img.naturalWidth;
            freezeCanvas.height = img.naturalHeight;
            freezeCanvas.getContext('2d').drawImage(img, 0, 0);
            freezeCanvas.style.visibility = 'visible';
            img.style.visibility = 'hidden';
        }

        function startGif() {
            if (startedAt !== null) return;
            img.src = LOGIN.gif;
            startedAt = performance.now();
        }

        function begin() {
            if (!startupSound) return startGif();
            startupSound.loop = false;
            startupSound.currentTime = 0;
            startupSound.play().then(startGif).catch(err => {
                if (!err || err.name !== 'NotAllowedError') return startGif();
                gate.classList.remove('hidden');
                const go = () => {
                    gate.removeEventListener('click', go);
                    document.removeEventListener('keydown', go);
                    gate.classList.add('hidden');
                    startupSound.play().then(startGif).catch(startGif);
                };
                gate.addEventListener('click', go);
                document.addEventListener('keydown', go);
            });
        }

        function frame() {
            if (loginScreen.classList.contains('hidden')) return;
            const elapsed = startedAt === null ? 0 : (performance.now() - startedAt) / 1000;
            if (startedAt !== null && !active && elapsed >= LOGIN.promptAt) activate();
            if (startedAt !== null && !frozen && elapsed >= freezeAfter) freeze();
            const src = frozen ? freezeCanvas : img;
            const w = frozen ? freezeCanvas.width : img.naturalWidth;
            if (active && w) {
                const k = w / 1920;
                ctx.drawImage(src, PATCH.sx * k, PATCH.sy * k, PATCH.w * k, PATCH.h * k, 0, 0, PATCH.w, PATCH.h);
            }
            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);

        input.addEventListener('input', () => { textEl.textContent = input.value; });
        input.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); enterDesktop(); }
        });
        loginScreen.addEventListener('click', () => { if (active) input.focus(); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') activate(); });

        img.addEventListener('error', () => activate(false));
        gifDuration(LOGIN.gif).then(d => { if (d > 1 && d < 60) freezeAfter = d - LOGIN.freezeBeforeEnd; });
        Promise.race([preloadGif.decode().catch(() => {}), new Promise(r => setTimeout(r, 10000))]).then(begin);
    }

    function enterDesktop() {
        if (startupSound) startupSound.pause();
        loginScreen.classList.add('hidden');
        document.getElementById('desktop').classList.remove('hidden');
        initializeTaskbar();
        videoBackground.classList.add('visible');

        // Load data instantly from data.js global variable
        if (window.SITE_DATA) {
            siteData = window.SITE_DATA;
            buildDesktopIcons(siteData);
        } else {
            console.error("SITE_DATA not found. Make sure data.js is loaded before os.js.");
        }

        if (welcomeSound) {
            welcomeSound.currentTime = 0;
            welcomeSound.onended = () => playYouTubeAudio(youtubeVideoId);
            welcomeSound.play().catch(() => playYouTubeAudio(youtubeVideoId));
        } else {
            playYouTubeAudio(youtubeVideoId);
        }
    }

    function initializeTaskbar() {
        document.getElementById('taskbar').classList.remove('hidden');
        updateClock();
        setInterval(updateClock, 60000);
        
        const startButton = document.getElementById('start-button');
        if (startButton) startButton.addEventListener('click', toggleStartMenu);
        
        const audioControl = document.getElementById('audio-control');
        if (audioControl) audioControl.addEventListener('click', toggleMute);
        
        document.addEventListener('click', function(e) {
            const startMenu = document.getElementById('start-menu');
            const startButton = document.getElementById('start-button');
            if (!startMenu.contains(e.target) && !startButton.contains(e.target) && !startMenu.classList.contains('hidden')) {
                startMenu.classList.add('hidden');
            }
        });
    }

    function updateClock() {
        const clockElement = document.getElementById('clock');
        if (clockElement) {
            const now = new Date();
            let hours = now.getHours();
            const minutes = now.getMinutes().toString().padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12 || 12;
            clockElement.textContent = `${hours}:${minutes} ${ampm}`;
        }
    }

    function toggleStartMenu() {
        document.getElementById('start-menu').classList.toggle('hidden');
    }

    function toggleMute() {
        isMuted = !isMuted;
        ['startup-sound', 'welcome-sound'].forEach(id => { const a = document.getElementById(id); if (a) a.muted = isMuted; });
        const soundIcon = document.getElementById('sound-icon');
        if (!soundIcon) return;
        if (isMuted) {
            soundIcon.src = './resources/images/mute.png';
            soundIcon.alt = 'Muted';
        } else {
            soundIcon.src = './resources/images/sound.png';
            soundIcon.alt = 'Sound On';
        }
        if (youtubeIframe && youtubeIframe.contentWindow) {
            const cmd = isMuted ? 'mute' : 'unMute';
            youtubeIframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: cmd, args: [] }), '*');
        }
    } 
    
    function playYouTubeAudio(videoId) {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&showinfo=0&autohide=1&enablejsapi=1&origin=${window.location.origin}`;
        iframe.allow = "autoplay";
        document.body.appendChild(iframe);
        youtubeIframe = iframe;
        iframe.addEventListener('load', () => { if (isMuted) iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'mute', args: [] }), '*'); });
    }

    // ---------- Dynamic Desktop Icons Builder ----------
    function buildDesktopIcons(data) {
        const container = document.getElementById('desktop-icons-container');
        container.innerHTML = '';

        data.icons.forEach(iconData => {
            const iconDiv = document.createElement('div');
            iconDiv.className = 'desktop-icon';
            iconDiv.style.top = iconData.top;
            iconDiv.style.left = iconData.left;
            iconDiv.dataset.title = iconData.title;

            iconDiv.innerHTML = `
                <img src="${iconData.img}" alt="${iconData.title}">
                <span>${iconData.title}</span>
            `;

            makeIconDraggable(iconDiv);

            iconDiv.addEventListener('dblclick', () => {
                handleIconOpen(iconData);
            });

            container.appendChild(iconDiv);
        });
    }

    function handleIconOpen(iconData) {
        if (iconData.type === 'text') {
            createWindow(iconData.windowTitle, iconData.content);
        } 
        else if (iconData.type === 'completed_list') {
            let html = `<h2 class='underline'>${iconData.windowTitle}</h2><p>Here are my completed projects:</p><ul>`;
            iconData.items.forEach(p => {
                html += `<li><span class='window-link' data-window-title='${p.title}' data-url='${p.url}'>${p.title}</span></li>`;
            });
            html += "</ul>";
            createWindow(iconData.windowTitle, html);
        }
        else if (iconData.type === 'current_list' || iconData.type === 'future_list' || iconData.type === 'topics_list') {
            let html = `<h2 class='underline'>${iconData.windowTitle}</h2><ul>`;
            iconData.items.forEach(item => {
                html += `<li><span class='window-link' data-window-title='${item.windowTitle || item.title}' data-window-content='${item.content}'>${item.title}</span></li>`;
            });
            html += "</ul>";
            createWindow(iconData.windowTitle, html);
        }
        else if (iconData.type === 'github_api') {
            const win = createWindow(iconData.windowTitle, "<p>Connecting to GitHub API...</p>");
            const body = win.querySelector('.window-content div') || win.querySelector('.window-content');
            
            fetch("https://api.github.com/users/layer404/repos?sort=updated")
                .then(res => res.json())
                .then(repos => {
                    let html = `<h2 class='underline'>Public GitHub Repositories</h2><p>Fetched live from GitHub:</p><ul style='list-style-type: none; padding: 0;'>`;
                    repos.forEach(repo => {
                        html += `
                            <li style="margin-bottom: 12px; border-bottom: 1px dashed #808080; padding-bottom: 8px;">
                                <strong><a href="${repo.html_url}" target="_blank" style="color: blue; text-decoration: underline;">${repo.name}</a></strong>
                                <p style="margin: 4px 0; font-size: 0.9em;">${repo.description || "No description provided."}</p>
                                <span style="font-size: 0.8em; color: #555;">⭐ ${repo.stargazers_count} | 🔀 ${repo.forks_count} | Language: ${repo.language || 'N/A'}</span>
                            </li>`;
                    });
                    html += "</ul>";
                    body.innerHTML = html;
                })
                .catch(() => {
                    body.innerHTML = "<p>Error fetching repositories from GitHub API.</p>";
                });
        }
    }

    function makeIconDraggable(element) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        element.onmousedown = dragMouseDown;
        
        function dragMouseDown(e) {
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }
        
        function elementDrag(e) {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        }
        
        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    // ---------- Window manager ----------
    let zTop = 10;
    let windowCounter = 0;
    const taskbarItemFor = win => document.querySelector(`.taskbar-item[data-window-id="${win.id}"]`);

    function focusWindow(win) {
        document.querySelectorAll('.window').forEach(w => w.classList.remove('focused'));
        document.querySelectorAll('.taskbar-item').forEach(t => t.classList.remove('active'));
        win.style.display = 'flex';
        win.style.zIndex = ++zTop;
        win.classList.add('focused');
        const item = taskbarItemFor(win);
        if (item) item.classList.add('active');
    }

    function minimizeWindow(win) {
        win.style.display = 'none';
        win.classList.remove('focused');
        const item = taskbarItemFor(win);
        if (item) item.classList.remove('active');
    }

    function addWindowToTaskbar(win, title) {
        const item = document.createElement('div');
        item.className = 'taskbar-item';
        item.textContent = title;
        item.title = title;
        item.dataset.windowId = win.id;
        item.addEventListener('click', () => {
            if (win.style.display === 'none' || !win.classList.contains('focused')) focusWindow(win);
            else minimizeWindow(win);
        });
        document.getElementById('open-windows').appendChild(item);
        return item;
    }

    function removeWindowFromTaskbar(windowId) {
        const item = document.querySelector(`.taskbar-item[data-window-id="${windowId}"]`);
        if (item) item.remove();
    }

    function openWindow(title, html, url = null, imageUrl = null) {
        const win = document.createElement('div');
        win.className = 'window';
        win.id = 'window-' + (++windowCounter);
        const offset = (windowCounter % 8) * 28;
        win.style.top = (30 + offset) + 'px';
        win.style.left = (130 + offset) + 'px';
        win.innerHTML = `
            <div class="window-header">
                <span class="window-title"></span>
                <div class="window-controls">
                    <button class="minimize-button" title="Minimize">_</button>
                    <button class="maximize-button" title="Maximize">&#9633;</button>
                    <button class="close-button" title="Close">&times;</button>
                </div>
            </div>
            <div class="window-toolbar"><button>File</button><button>Edit</button><button>View</button><button>Tools</button><button>Help</button></div>
            <div class="window-content"></div>`;
        win.querySelector('.window-title').textContent = title;

        const content = win.querySelector('.window-content');
        if (imageUrl) {
            const img = document.createElement('img');
            img.src = imageUrl;
            img.alt = title;
            content.appendChild(img);
        }
        const body = document.createElement('div');
        content.appendChild(body);
        if (url) {
            body.innerHTML = '<p>Loading...</p>';
            fetch(url)
                .then(r => { if (!r.ok) throw new Error(r.status); return r.text(); })
                .then(text => { body.innerHTML = text; })
                .catch(() => {
                    body.innerHTML = '<p>Could not load this page.</p>';
                });
        } else {
            body.innerHTML = html;
        }

        win.querySelector('.minimize-button').addEventListener('click', () => minimizeWindow(win));
        win.querySelector('.maximize-button').addEventListener('click', () => {
            win.classList.toggle('maximized');
            focusWindow(win);
        });
        win.querySelector('.close-button').addEventListener('click', () => {
            win.remove();
            removeWindowFromTaskbar(win.id);
        });

        document.getElementById('windows-container').appendChild(win);
        addWindowToTaskbar(win, title);
        makeWindowDraggable(win);
        focusWindow(win);
        return win;
    }

    function createWindow(title, content, imageUrl = null) { return openWindow(title, content, null, imageUrl); }
    function createWindowFromUrl(title, url, imageUrl = null) { return openWindow(title, '', url, imageUrl); }

    function makeWindowDraggable(win) {
        const header = win.querySelector('.window-header');
        win.addEventListener('pointerdown', () => focusWindow(win));
        header.addEventListener('pointerdown', e => {
            if (e.target.closest('button') || win.classList.contains('maximized')) return;
            const dx = e.clientX - win.offsetLeft;
            const dy = e.clientY - win.offsetTop;
            header.setPointerCapture(e.pointerId);
            const move = ev => {
                const area = document.getElementById('windows-container');
                win.style.left = Math.min(Math.max(ev.clientX - dx, 60 - win.offsetWidth), area.clientWidth - 60) + 'px';
                win.style.top = Math.min(Math.max(ev.clientY - dy, 0), area.clientHeight - 30) + 'px';
            };
            const up = () => {
                header.removeEventListener('pointermove', move);
                header.removeEventListener('pointerup', up);
            };
            header.addEventListener('pointermove', move);
            header.addEventListener('pointerup', up);
        });
    }

    // ---------- Start menu actions ----------
    function openDesktopFile(name) {
        if (!siteData) return;
        const wanted = name.trim().toLowerCase();
        const found = siteData.icons.find(i => i.title.toLowerCase() === wanted);
        if (found) {
            handleIconOpen(found);
        } else {
            alert(`Cannot find '${name}'. Check the spelling and try again.`);
        }
    }

    function runStartAction(action) {
        switch (action) {
            case 'programs':  openDesktopFile('completed.exe'); break;
            case 'documents': openDesktopFile('about_me.txt'); break;
            case 'find':      openDesktopFile('topics.txt'); break;
            case 'settings':
                openWindow('Settings', '<h2 class="underline">Settings</h2><p>Nothing to configure yet. Use the speaker icon in the tray to mute the music.</p>');
                break;
            case 'help':
                openWindow('Help', '<h2 class="underline">Help</h2><p>Double-click a desktop icon to open it. Drag icons and window title bars to move them. Use the taskbar to switch, minimize or restore windows.</p>');
                break;
            case 'run': {
                const name = prompt('Type the name of a file to open (for example about_me.txt):');
                if (name) openDesktopFile(name);
                break;
            }
            case 'shutdown':
                if (youtubeIframe) { youtubeIframe.remove(); youtubeIframe = null; }
                document.getElementById('shutdown-screen').classList.remove('hidden');
                break;
        }
    }

    document.getElementById('shutdown-screen').addEventListener('click', () => location.reload());
    document.querySelectorAll('.start-item').forEach(item => {
        item.addEventListener('click', () => {
            document.getElementById('start-menu').classList.add('hidden');
            runStartAction(item.dataset.action);
        });
    });

    // Window links delegation
    document.getElementById('windows-container').addEventListener('click', function(e) {
        let target = e.target;
        while (target && target !== this) {
            if (target.classList && target.classList.contains('window-link')) {
                const title = target.getAttribute('data-window-title');
                const url = target.getAttribute('data-url');
                const content = target.getAttribute('data-window-content');
                const imageUrl = target.getAttribute('data-window-image');
    
                if (url) createWindowFromUrl(title, url, imageUrl);
                else if (content) createWindow(title, content, imageUrl);
                break;
            }
            target = target.parentNode;
        }
    });
    
    const style = document.createElement('style');
    style.textContent = `
        .window-link {
            color: var(--unvisited);
            text-decoration: underline;
            cursor: pointer;
        }
        .window-link:hover {
            color: var(--visited);
        }
    `;
    document.head.appendChild(style);
});
