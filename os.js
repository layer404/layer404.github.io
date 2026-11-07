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
        else if (iconData.type === 'youtube_playlist') {
            createWindow(
                iconData.windowTitle,
                `<div style="width: 100%; height: 100%; min-height: 420px; display: flex; flex-direction: column; background: #000;">
                    <iframe src="https://www.youtube.com/embed/videoseries?list=${iconData.playlistId}&autoplay=1" 
                            style="width: 100%; height: 100%; border: none; flex: 1; min-height: 400px;" 
                            allow="autoplay; encrypted-media; picture-in-picture" 
                            allowfullscreen></iframe>
                </div>`
            );
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
