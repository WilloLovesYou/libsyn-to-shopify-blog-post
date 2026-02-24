(function() {
    var u = location.href;
    if (u.indexOf('libsyn.com') < 0) { alert('Use on Libsyn!'); return; }
    
    var m = u.match(/\/view\/(\d+)/) || u.match(/\/id\/(\d+)/);
    var id = m ? m[1] : '';
    
    var rawTitle = document.title.replace('Libsyn Five | ', '').trim();
    var t = rawTitle;
    // Format title as "Episode #26 Title" without colon
    var epNumMatch = rawTitle.match(/^(\d+)\s*/);
    if (epNumMatch) {
        t = 'Episode #' + epNumMatch[1] + ' ' + rawTitle.substring(epNumMatch[0].length);
    } else if (!/^Episode\s*#?\d+/i.test(t)) {
        t = 'Episode #' + en + ' ' + t;
    }
    
    var en = (rawTitle.match(/^(\d+)/) || ['', ''])[1];
    
    // Get description
    var descEl = document.querySelector('.tox-content-wrapper') || 
                 document.querySelector('.episode-description') ||
                 document.querySelector('[data-testid="description"]');
    var d = descEl ? descEl.innerText : '';
    
    // Extract YouTube video if present
    var ytMatch = d.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
    var ytEmbed = ytMatch ? '<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;margin-bottom:20px;"><iframe style="position:absolute;top:0;left:0;width:100%;height:100%;" src="https://www.youtube.com/embed/' + ytMatch[1] + '" frameborder="0" allowfullscreen></iframe></div>' : '';
    
    // Build embed URL
    var eu = 'https://five.libsyn.com/public/embed/destination/1/id/' + id + '/autoplay/no/direction/forward/theme/custom/custom-color/d49633/height/192';
    
    // Create SEO-friendly URL handle
    var guestMatch = rawTitle.match(/(?:with|featuring|ft\.?|guest:?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
    var topicWords = rawTitle.replace(/^\d+\s*[-:]?\s*/, '').toLowerCase()
        .replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(function(w) { return w.length > 3; }).slice(0, 3);
    var uh = 'e' + en + '-' + (guestMatch ? guestMatch[1].toLowerCase().replace(/\s+/g, '-') + '-' : '') + topicWords.join('-');
    uh = uh.replace(/--+/g, '-').replace(/-$/, '');
    
    // SEO Title
    var seoTitle = rawTitle.substring(0, 55);
    if (guestMatch) {
        seoTitle = guestMatch[1] + ' on ' + topicWords.slice(0, 2).join(' ');
    }
    seoTitle = seoTitle.substring(0, 50) + ' | Your Colorful Path';
    
    // Meta description
    var md = d.split('\n')[0].substring(0, 155);
    if (md.length === 155) md = md.substring(0, md.lastIndexOf(' ')) + '...';
    
    // Excerpt
    var excerpt = d.split('\n')[0].substring(0, 200);
    if (excerpt.length === 200) excerpt = excerpt.substring(0, excerpt.lastIndexOf(' ')) + '...';
    
    // Alt text
    var altText = 'Episode ' + en + ' - ' + rawTitle.replace(/^\d+\s*[-:]?\s*/, '').substring(0, 80);
    
    // Release date
    var dateEl = document.querySelector('.release-date') || document.querySelector('[data-testid="release-date"]');
    var rd = dateEl ? dateEl.innerText : '';
    
    // Process description paragraphs - filter out "Read More"
    // Use single line breaks for chapter list items (contain timestamps), double spacing for regular paragraphs
    // Bold headers like CHAPTERS, GUEST, HOST, KEY TAKEAWAYS
    var dp = d.split('\n').filter(function(p) { 
        var trimmed = p.trim();
        return trimmed && trimmed.toLowerCase() !== 'read more' && trimmed.toLowerCase() !== 'read more...';
    });
    
    var headerPatterns = /^(CHAPTERS?|CHAPTER LIST|GUEST|HOST|KEY TAKEAWAYS?|TOPICS?|ABOUT|CONNECT|LINKS|RESOURCES|SHOW NOTES?|IN THIS EPISODE|EPISODE HIGHLIGHTS?):?$/i;
    
    var dh = '';
    for (var j = 0; j < dp.length; j++) {
        var line = dp[j].replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
        var trimmedLine = dp[j].trim();
        var isHeader = headerPatterns.test(trimmedLine);
        var isChapterItem = /^\d{1,2}:\d{2}/.test(trimmedLine) || /^\(\d{1,2}:\d{2}/.test(trimmedLine);
        var nextIsChapterItem = (j < dp.length - 1) && (/^\d{1,2}:\d{2}/.test(dp[j+1].trim()) || /^\(\d{1,2}:\d{2}/.test(dp[j+1].trim()));
        
        if (isHeader) {
            // Bold header with spacing
            dh += '<p style="margin-bottom:10px;margin-top:20px;"><strong>' + line + '</strong></p>\n';
        } else if (isChapterItem && !nextIsChapterItem) {
            // Last chapter item - add extra spacing after
            dh += line + '<br><br>\n';
        } else if (isChapterItem || nextIsChapterItem) {
            dh += line + '<br>\n';
        } else {
            dh += '<p style="margin-bottom:15px;">' + line + '</p>\n';
        }
    }
    
    // RSS Feed URL and podcast IDs
    var rssFeed = 'https://rss.libsyn.com/shows/521038/destinations/4475083.xml';
    var appleShowId = '1790327657';
    
    // Fetch RSS to get episode GUID
    fetch(rssFeed)
        .then(function(response) { return response.text(); })
        .then(function(rssData) {
            // Parse RSS and find matching episode
            var parser = new DOMParser();
            var xml = parser.parseFromString(rssData, 'text/xml');
            var items = xml.querySelectorAll('item');
            var episodeGuid = '';
            var episodeArtwork = '';
            
            for (var i = 0; i < items.length; i++) {
                var itemTitle = items[i].querySelector('title');
                if (itemTitle && itemTitle.textContent.indexOf(rawTitle.substring(0, 30)) > -1) {
                    var guidEl = items[i].querySelector('guid');
                    if (guidEl) {
                        episodeGuid = guidEl.textContent.trim();
                    }
                    // Get episode artwork
                    var itunesImage = items[i].querySelector('image');
                    if (itunesImage && itunesImage.getAttribute('href')) {
                        episodeArtwork = itunesImage.getAttribute('href');
                    }
                    break;
                }
            }
            
            // Base64 encode the GUID for pod.link
            var encodedGuid = episodeGuid ? btoa(episodeGuid) : '';
            
            // Generate pod.link episode page URL
            var podlinkPage = encodedGuid ? ('https://pod.link/' + appleShowId + '/episode/' + encodedGuid) : ('https://pod.link/' + appleShowId);
            
            // Single "Listen on your favorite app" image button
            var listenButton = '<div style="text-align:center;margin:25px 0;">' +
                '<a href="' + podlinkPage + '" target="_blank" rel="noopener">' +
                '<img src="https://cdn.shopify.com/s/files/1/0870/3688/7345/files/Listen_on_Your_Favorite_App.png?v=1771919518" alt="Listen on Your Favorite App" style="height:50px;width:auto;">' +
                '</a></div>';
            
            // Content HTML - YouTube, Listen button, Description, then Libsyn player at bottom
            var ch = (ytEmbed ? '<!-- YouTube Video -->\n' + ytEmbed + '\n\n' : '') + 
                '<!-- Listen Button -->\n' + listenButton + '\n\n' +
                '<!-- Description -->\n' + dh + '\n\n' +
                '<!-- Audio Player -->\n<div style="margin-top:30px;margin-bottom:30px;">\n<iframe title="Libsyn Player" style="border:none;width:100%;height:192px;" src="' + eu + '" allowfullscreen></iframe>\n</div>\n\n' +
                '<!-- CTA -->\n<div style="background:linear-gradient(135deg,#2d2a26 0%,#4a4540 100%);padding:30px;border-radius:8px;text-align:center;color:white;margin-top:40px;">\n<h3 style="margin-top:0;color:#d49633;">Continue Your Journey</h3>\n<p style="margin-bottom:20px;">Explore our collection of high-frequency spiritual jewelry, designed to anchor you in your highest self.</p>\n<a href="/collections/all" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;justify-content:center;padding:12px 30px;background:#b78749;color:white;text-decoration:none;border-radius:50px;font-family:New York,Iowan Old Style,Apple Garamond,Baskerville,Times New Roman,serif;font-size:15px;font-weight:500;letter-spacing:.02em;text-transform:uppercase;">Shop the Collection</a>\n</div>';
            
            var esc = ch.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            
            var sw = screen.width, sh = screen.height;
            var w1 = Math.floor(sw / 3), w2 = Math.floor(sw * 2 / 3);
            
            var css = '*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:#faf8f5;color:#2d2a26}.hdr{background:#2d2a26;color:#fff;padding:16px 20px;position:sticky;top:0}.hdr h1{font-size:1rem}.wrap{max-width:100%;margin:0 auto;padding:20px}.fld{background:#fff;border-radius:8px;padding:14px 16px;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,0,0,.08)}.fld-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.lbl{font-size:.7rem;font-weight:600;text-transform:uppercase;color:#7a7570}.shp{font-size:.6rem;color:#999;background:#f0f0f0;padding:2px 6px;border-radius:3px}.row{display:flex;gap:8px}.val{flex:1;background:#f8f6f3;padding:10px;border-radius:6px;font-size:.85rem;white-space:pre-wrap;word-break:break-word;max-height:200px;overflow-y:auto}.val.code{background:#1e1e1e;color:#d4d4d4;font-family:monospace;font-size:.7rem}.btn{background:#d49633;color:#fff;border:none;padding:6px 12px;border-radius:5px;cursor:pointer;font-size:.75rem;font-weight:500;white-space:nowrap}.btn:hover{background:#c47d28}.btn.ok{background:#2d8a2d}.sep{border:none;border-top:2px dashed #e0dcd8;margin:20px 0}.sec{font-size:.7rem;font-weight:600;text-transform:uppercase;color:#d49633;margin-bottom:12px}.note{font-size:11px;color:#999;margin-top:-8px;margin-bottom:14px}';
            
            var h = '<!DOCTYPE html><html><head><title>Ready for Shopify</title><style>' + css + '</style></head><body>';
            h += '<div class="hdr"><h1>✨ Copy to Shopify</h1></div><div class="wrap">';
            h += '<div class="fld"><div class="fld-top"><span class="lbl">Title</span><span class="shp">Shopify: Title</span></div><div class="row"><div class="val" id="f1">' + t + '</div><button class="btn" onclick="cp(\'f1\',this)">Copy</button></div></div>';
            h += '<div class="fld"><div class="fld-top"><span class="lbl">Content (HTML)</span><span class="shp">Shopify: Content (click &lt;/&gt; first)</span></div><div class="row"><div class="val code" id="f2">' + esc + '</div><button class="btn" onclick="cp(\'f2\',this)">Copy</button></div></div>';
            if (encodedGuid) {
                h += '<p class="note">✅ Episode found! Listen button and artwork linked.</p>';
            } else {
                h += '<p class="note">⚠️ Could not find episode in RSS feed. Generic podcast link used.</p>';
            }
            h += '<div class="fld"><div class="fld-top"><span class="lbl">Excerpt</span><span class="shp">Shopify: Excerpt</span></div><div class="row"><div class="val" id="f9">' + excerpt + '</div><button class="btn" onclick="cp(\'f9\',this)">Copy</button></div></div>';
            h += '<hr class="sep"><div class="sec">Search Engine Listing</div>';
            h += '<div class="fld"><div class="fld-top"><span class="lbl">Page Title (SEO)</span><span class="shp">Shopify: Page title</span></div><div class="row"><div class="val" id="f3">' + seoTitle + '</div><button class="btn" onclick="cp(\'f3\',this)">Copy</button></div></div>';
            h += '<div class="fld"><div class="fld-top"><span class="lbl">Meta Description</span><span class="shp">Shopify: Meta description</span></div><div class="row"><div class="val" id="f4">' + md + '</div><button class="btn" onclick="cp(\'f4\',this)">Copy</button></div></div>';
            h += '<div class="fld"><div class="fld-top"><span class="lbl">URL Handle</span><span class="shp">Shopify: URL handle</span></div><div class="row"><div class="val" id="f5">' + uh + '</div><button class="btn" onclick="cp(\'f5\',this)">Copy</button></div></div>';
            h += '<hr class="sep">';
            h += '<div class="fld"><div class="fld-top"><span class="lbl">Tags</span><span class="shp">Shopify: Tags</span></div><div class="row"><div class="val" id="f6">podcast</div><button class="btn" onclick="cp(\'f6\',this)">Copy</button></div></div>';
            h += '<hr class="sep"><div class="sec">Image</div>';
            if (episodeArtwork) {
                h += '<div class="fld"><div class="fld-top"><span class="lbl">Episode Artwork</span><span class="shp">Right-click image → Save As</span></div>';
                h += '<div style="text-align:center;margin:10px 0;"><a href="' + episodeArtwork + '" target="_blank"><img src="' + episodeArtwork + '" style="max-width:200px;max-height:200px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);" alt="Episode Artwork"></a></div>';
                h += '<div style="text-align:center;margin:10px 0;"><a href="' + episodeArtwork + '" target="_blank" style="display:inline-block;background:#d49633;color:white;padding:8px 16px;border-radius:5px;text-decoration:none;font-size:13px;">Download Full Size</a></div>';
                h += '</div>';
            } else {
                h += '<p class="note">⚠️ Episode artwork not found in RSS feed</p>';
            }
            h += '<div class="fld"><div class="fld-top"><span class="lbl">Featured Image Alt Text</span><span class="shp">Shopify: Image → Edit alt text</span></div><div class="row"><div class="val" id="f7">' + altText + '</div><button class="btn" onclick="cp(\'f7\',this)">Copy</button></div></div>';
            h += '</div><script>function cp(id,b){navigator.clipboard.writeText(document.getElementById(id).textContent).then(function(){b.textContent="Copied!";b.classList.add("ok");setTimeout(function(){b.textContent="Copy";b.classList.remove("ok")},1200)})}<\/script></body></html>';
            
            var popup = window.open('', '_blank', 'width=' + w1 + ',height=' + sh + ',left=0,top=0,scrollbars=yes');
            popup.document.write(h);
            popup.document.close();
            
            setTimeout(function() {
                window.open('https://admin.shopify.com/store/b14b8f-c3/content/articles/new', '_blank', 'width=' + w2 + ',height=' + sh + ',left=' + w1 + ',top=0');
            }, 300);
        })
        .catch(function(error) {
            alert('Error fetching RSS feed: ' + error.message);
        });
})();
