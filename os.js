let youtubeIframe = null;
let isMuted = false;
document.addEventListener('DOMContentLoaded', function() {

    // Get elements
    const bootSequence = document.getElementById('boot-sequence');
    const bootText = document.getElementById('boot-text');
    const loginScreen = document.getElementById('login-screen');
    const startupSound = document.getElementById('startup-sound');
    const welcomeSound = document.getElementById('welcome-sound');
    const videoBackground = document.getElementById('video-background');
    
    // Login screen elements
    const loginTitle = document.getElementById('login-title');
    const usernameLabel = document.getElementById('username-label');
    const passwordLabel = document.getElementById('password-label');
    const loginButton = document.getElementById('login-button');
    
    // YouTube video ID
    const youtubeVideoId = 'fxjIthZY3YI';

    const SKIP_BIOS_TEXT = false;   // true = go straight from the black screen to the login clip
    const LOGIN = {
        gif: './resources/images/logon.gif',   // the login clip (export it with "-loop -1" so it plays once and stays on its last frame)
        duration: 12.4,                         // fallback clip length in seconds (used if the GIF's real length can't be read)
        promptAt: 11,                           // seconds after the clip starts when typing unlocks
        freezeBeforeEnd: 0.8,                   // freeze on the last frame this many seconds before the clip's end
    };
    // Region (in 1920x1080 clip pixels) of empty background cloned over the clip's own square, so ours can follow the text
    const PATCH = { sx: 770, sy: 482, w: 100, h: 76 };
    const preloadGif = new Image();   // start downloading the clip while the boot text runs
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
    
    // Login screen text content
    const loginTexts = {
        title: ".0phanim//OS Enterprise",
        usernameLabel: "Username:",
        passwordLabel: "Password:",
        loginButton: "Login (no password required)"
    };
    
    // Calculate time per line to make the whole sequence last 3 seconds
    const totalBootTime = 3000; // 3 seconds in milliseconds
    const timePerLine = totalBootTime / bootLines.length;
    
    // Function to display boot sequence lines one by one
    function displayBootSequence(lines, index = 0) {
        if (index >= lines.length) {
            // Boot sequence complete, show login screen
            bootSequence.classList.add('hidden');
            startLogin();
            return;
        }
        
        const currentLine = lines[index];
        bootText.innerHTML += currentLine + "\n";
        
        // Schedule next line
        setTimeout(() => {
            displayBootSequence(lines, index + 1);
        }, timePerLine);
    }
    
    // Function to add text with typing effect
    function typeText(element, text, callback, speed = 50) {
        let i = 0;
        element.textContent = "";
        element.classList.add('fade-in');
        
        function addChar() {
            if (i < text.length) {
                element.textContent += text.charAt(i);
                i++;
                setTimeout(addChar, speed);
            } else if (callback) {
                callback();
            }
        }
        
        addChar();
    }
    
    // Start the boot sequence
    displayBootSequence(SKIP_BIOS_TEXT ? [] : bootLines);
    
    // ---------- Navi-style login ----------
    // Real length of a GIF in seconds, read from its frame delays (browsers treat delays of 0-1 as 10 hundredths)
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

        // Freeze on the last frame whatever the GIF's loop setting is: copy the current frame to a canvas and hide the GIF
        function freeze() {
            if (frozen || !img.naturalWidth) return;
            frozen = true;
            freezeCanvas.width = img.naturalWidth;
            freezeCanvas.height = img.naturalHeight;
            freezeCanvas.getContext('2d').drawImage(img, 0, 0);
            freezeCanvas.style.visibility = 'visible';
            img.style.visibility = 'hidden';
        }

        // Assigning src restarts the GIF from frame 0; the audio is started a moment before this
        function startGif() {
            if (startedAt !== null) return;   // only ever start once
            img.src = LOGIN.gif;
            startedAt = performance.now();
        }

        // Audio + GIF start together. If the browser blocks sound, wait for a click instead of starting silently
        function begin() {
            if (!startupSound) return startGif();
            startupSound.loop = false;
            startupSound.currentTime = 0;
            startupSound.play().then(startGif).catch(err => {
                if (!err || err.name !== 'NotAllowedError') return startGif();
                gate.classList.remove('hidden');
                const go = () => {   // remove both listeners, or the next key you type would restart the sound
                    gate.removeEventListener('click', go);
                    document.removeEventListener('keydown', go);
                    gate.classList.add('hidden');
                    startupSound.play().then(startGif).catch(startGif);
                };
                gate.addEventListener('click', go);
                document.addEventListener('keydown', go);
            });
        }

        // The clip keeps playing the whole time; we only paint the patch over it
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
        document.addEventListener('keydown', e => { if (e.key === 'Escape') activate(); });   // Esc = unlock typing right away

        img.addEventListener('error', () => activate(false));   // clip missing -> prompt only
        // Wait (max 10 s) until the GIF is downloaded and decoded so audio and picture start in sync
        gifDuration(LOGIN.gif).then(d => { if (d > 1 && d < 60) freezeAfter = d - LOGIN.freezeBeforeEnd; });
        Promise.race([preloadGif.decode().catch(() => {}), new Promise(r => setTimeout(r, 10000))]).then(begin);
    }

    function enterDesktop() {
        if (startupSound) startupSound.pause();
        loginScreen.classList.add('hidden');
        document.getElementById('desktop').classList.remove('hidden');
        initializeTaskbar();
        document.getElementById('video-background').classList.add('visible');

        // Welcome sound first, then the YouTube music
        if (welcomeSound) {
            welcomeSound.currentTime = 0;
            welcomeSound.onended = () => playYouTubeAudio(youtubeVideoId);
            welcomeSound.play().catch(() => playYouTubeAudio(youtubeVideoId));
        } else {
            playYouTubeAudio(youtubeVideoId);
        }
    }

    function initializeTaskbar() {
        // Reveal the taskbar now that we're logged in
        document.getElementById('taskbar').classList.remove('hidden');

        // Update clock 1 minute after initialization
        updateClock();
        setInterval(updateClock, 60000);
        
        // Set up start button functionality
        const startButton = document.getElementById('start-button');
        if (startButton) {
            startButton.addEventListener('click', toggleStartMenu);
        }
        
        // Set up audio control
        const audioControl = document.getElementById('audio-control');
  if (audioControl) {
    audioControl.addEventListener('click', toggleMute);
  }
        
        // Close start menu when clicking elsewhere
        document.addEventListener('click', function(e) {
            const startMenu = document.getElementById('start-menu');
            const startButton = document.getElementById('start-button');
            
            if (!startMenu.contains(e.target) && !startButton.contains(e.target) && !startMenu.classList.contains('hidden')) {
                startMenu.classList.add('hidden');
            }
        });
        
        console.log("Taskbar initialized");
    }

    function updateClock() {
        const clockElement = document.getElementById('clock');
        if (clockElement) {
            const now = new Date();
            let hours = now.getHours();
            const minutes = now.getMinutes().toString().padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12; // the hour '0' should be '12'
            clockElement.textContent = `${hours}:${minutes} ${ampm}`;
        }
    }

    function toggleStartMenu() {
        const startMenu = document.getElementById('start-menu');
        startMenu.classList.toggle('hidden');
    }

    function toggleMute() {
        // 1) Flip our state
        isMuted = !isMuted;
        ['startup-sound', 'welcome-sound'].forEach(id => { const a = document.getElementById(id); if (a) a.muted = isMuted; });
      
        // 2) Swap the icon right away
        const soundIcon = document.getElementById('sound-icon');
        if (!soundIcon) return; // bail if we can't find the <img>
      
        if (isMuted) {
          soundIcon.src = './resources/images/mute.png';
          soundIcon.alt = 'Muted';
        } else {
          soundIcon.src = './resources/images/sound.png';
          soundIcon.alt = 'Sound On';
        }
      
        // 3) If YouTube iframe exists, send it a message
        if (youtubeIframe && youtubeIframe.contentWindow) {
          const cmd = isMuted ? 'mute' : 'unMute';
          youtubeIframe.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: cmd, args: [] }),
            '*'
          );
        }
      } 
    
    // Function to play audio from YouTube video
    function playYouTubeAudio(videoId) {
    // Create a hidden YouTube iframe with API enabled
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&showinfo=0&autohide=1&enablejsapi=1&origin=${window.location.origin}`;
    iframe.allow = "autoplay";
    document.body.appendChild(iframe);
    
    // Store reference to the iframe for muting
    youtubeIframe = iframe;
    iframe.addEventListener('load', () => { if (isMuted) iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'mute', args: [] }), '*'); });
    
    console.log("YouTube audio should be playing now");
}
    
    // Make desktop icons draggable
    const desktopIcons = document.querySelectorAll('.desktop-icon');
    desktopIcons.forEach(makeIconDraggable);
    
    // Handle double-click on desktop icons to open windows
    desktopIcons.forEach(icon => {
        icon.addEventListener('dblclick', function() {
            const title = this.getAttribute('data-title');
            const content = this.getAttribute('data-content');
            
            // Create a new window
            createWindow(title, content);
        });
    });
    
    // Function to make desktop icons draggable
    function makeIconDraggable(element) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        
        element.onmousedown = dragMouseDown;
        
        function dragMouseDown(e) {
            e.preventDefault();
            // Get the mouse cursor position at startup
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }
        
        function elementDrag(e) {
            e.preventDefault();
            // Calculate the new cursor position
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            // Set the element's new position
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        }
        
        function closeDragElement() {
            // Stop moving when mouse button is released
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
        // Minimized or in the background -> bring to front; already focused -> minimize
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

    // One function builds every window (static HTML, a fetched page, or an optional image)
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
                    body.innerHTML = '<p>Could not load this page.</p><p>If you opened the site straight from disk, serve it with a local web server instead, e.g. <code>python3 -m http.server</code>.</p>';
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

    // Kept as thin wrappers so the rest of the code (and index.html) keeps working
    function createWindow(title, content, imageUrl = null) { return openWindow(title, content, null, imageUrl); }
    function createWindowFromUrl(title, url, imageUrl = null) { return openWindow(title, '', url, imageUrl); }

    // Drag by the title bar (mouse + touch), kept inside the desktop area
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
        const wanted = name.trim().toLowerCase();
        const icon = [...document.querySelectorAll('.desktop-icon')].find(i => i.dataset.title.toLowerCase() === wanted);
        if (icon) openWindow(icon.dataset.title, icon.dataset.content);
        else alert(`Cannot find '${name}'. Check the spelling and try again.`);
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

    
    // Add event delegation for window links
    document.getElementById('windows-container').addEventListener('click', function(e) {
        let target = e.target;
        while (target && target !== this) {
            if (target.classList && target.classList.contains('window-link')) {
                const title = target.getAttribute('data-window-title');
                const url = target.getAttribute('data-url');
                const content = target.getAttribute('data-window-content');
                const imageUrl = target.getAttribute('data-window-image');
    
                if (url) {
                    createWindowFromUrl(title, url, imageUrl);
                } else if (content) {
                    createWindow(title, content, imageUrl);
                }
    
                break;
            }
            target = target.parentNode;
        }
    });
    
    // Add styles for window links
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
