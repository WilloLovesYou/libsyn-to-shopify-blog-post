(function() {
    var u = location.href;
    if (u.indexOf('libsyn.com') < 0) { alert('Use on Libsyn!'); return; }

    var m = u.match(/\/view\/(\d+)/) || u.match(/\/id\/(\d+)/);
    var id = m ? m[1] : '';

    // Extract episode metadata from page
    var rd = '', du = '', en = '';
    var li = document.querySelectorAll('li');
    for (var i = 0; i < li.length; i++) {
        var x = li[i].textContent;
        if (x.indexOf('Release Date:') > -1) {
            rd = x.replace('Release Date:', '').trim();
            rd = rd.replace(/\s+\d{1,2}:\d{2}.*$/, '');
        }
        if (x.indexOf('Duration:') > -1) du = x.replace('Duration:', '').trim();
        if (x.indexOf('Episode:') > -1) { var n = x.replace('Episode:', '').trim(); if (n) en = n; }
    }

    var rawTitle = document.title.replace('Libsyn Five | ', '').trim();
    // Fallback: get episode number from title if not found in metadata
    if (!en) en = (rawTitle.match(/^#?(\d+)/) || ['', ''])[1];

    // Title case helper
    function toTitleCase(str) {
        var smallWords = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'by', 'of', 'in', 'with'];
        return str.replace(/\w\S*/g, function(txt, index) {
            var lower = txt.toLowerCase();
            if (index > 0 && smallWords.indexOf(lower) > -1) return lower;
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        });
    }

    // Format title as "Episode #26 Title"
    var t = rawTitle;
    var epNumMatch = rawTitle.match(/^#?(\d+)\s*/);
    if (epNumMatch) {
        t = 'Episode #' + epNumMatch[1] + ' ' + rawTitle.substring(epNumMatch[0].length);
    } else if (!/^Episode\s*#?\d+/i.test(t)) {
        t = 'Episode #' + en + ' ' + t;
    }
    t = toTitleCase(t);

    // Build embed URL
    var eu = 'https://five.libsyn.com/public/embed/destination/1/id/' + id + '/autoplay/no/direction/forward/theme/custom/custom-color/d49633/height/192';

    // Extract guest name
    var guestMatch = rawTitle.match(/[Ww]ith\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
    var guestName = guestMatch ? guestMatch[1] : '';

    // Extract topic
    var topicMatch = rawTitle.match(/^#?\d+\s+([^:?]+)/);
    var topicRaw = topicMatch ? topicMatch[1].trim().substring(0, 50) : rawTitle.replace(/^#?\d+\s*/, '').substring(0, 50);
    var topic = toTitleCase(topicRaw);

    // URL handle
    var uhTopicClean = topic.replace(/^#?\d+\s*/, '');
    var uhTopic = uhTopicClean.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
    var uhGuest = guestName ? guestName.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-') : '';
    var uhPrefix = en ? 'e' + en + '-' : '';
    var uhFull = uhGuest ? (uhPrefix + uhGuest + '-' + uhTopic) : (uhPrefix + uhTopic);
    if (uhFull.length > 70) {
        uhFull = uhFull.substring(0, 70);
        var lastH = uhFull.lastIndexOf('-');
        if (lastH > 15) uhFull = uhFull.substring(0, lastH);
    }
    var uh = uhFull;

    // SEO Titles - two options
    var seoSuffix1 = ' | Your Colorful Path Podcast';
    var seoSuffix2 = ' | Your Colorful Path';
    var seoPrefixRaw = guestName ? (guestName + ' on ' + topic) : topic;
    var seoPrefix = toTitleCase(seoPrefixRaw);

    var seoTitle1 = seoPrefix + seoSuffix1;
    if (seoTitle1.length > 65) {
        var maxP1 = 65 - seoSuffix1.length;
        var trunc1 = seoPrefix.substring(0, maxP1);
        var ls1 = trunc1.lastIndexOf(' ');
        if (ls1 > 15) trunc1 = trunc1.substring(0, ls1);
        seoTitle1 = trunc1 + seoSuffix1;
    }

    var seoTitle2 = seoPrefix + seoSuffix2;
    if (seoTitle2.length > 65) {
        var maxP2 = 65 - seoSuffix2.length;
        var trunc2 = seoPrefix.substring(0, maxP2);
        var ls2 = trunc2.lastIndexOf(' ');
        if (ls2 > 15) trunc2 = trunc2.substring(0, ls2);
        seoTitle2 = trunc2 + seoSuffix2;
    }

    // Alt text
    var altText = 'Your Colorful Path Podcast Episode ' + en + ' with Charu Boeckel';

    // RSS Feed URL and podcast IDs
    var rssFeed = 'https://rss.libsyn.com/shows/521038/destinations/4475083.xml';
    var appleShowId = '1790327657';

    // Fetch RSS to get episode GUID, artwork, and full description
    fetch(rssFeed)
        .then(function(response) { return response.text(); })
        .then(function(rssData) {
            var parser = new DOMParser();
            var xml = parser.parseFromString(rssData, 'text/xml');
            var items = xml.querySelectorAll('item');
            var episodeGuid = '';
            var episodeArtwork = '';
            var rssDescription = '';

            // Get show-level artwork as fallback
            var showImage = xml.querySelector('channel > image > url') || xml.querySelector('channel image url');
            var showArtwork = showImage ? showImage.textContent.trim() : '';

            // Try to match by episode number first, then by title
            for (var i = 0; i < items.length; i++) {
                var itemTitle = items[i].querySelector('title');
                if (!itemTitle) continue;
                var rssTitle = itemTitle.textContent;
                var rssEpMatch = rssTitle.match(/^(\d+)\s/);
                var matchFound = (en && rssEpMatch && rssEpMatch[1] === en) ||
                                 rssTitle.indexOf(rawTitle.substring(0, 20)) > -1;
                if (matchFound) {
                    var guidEl = items[i].querySelector('guid');
                    if (guidEl) episodeGuid = guidEl.textContent.trim();
                    var itunesImage = items[i].querySelector('image');
                    if (itunesImage && itunesImage.getAttribute('href')) {
                        episodeArtwork = itunesImage.getAttribute('href');
                    }
                    var descEl = items[i].querySelector('description');
                    if (descEl) rssDescription = descEl.textContent.trim();
                    break;
                }
            }

            // Use show artwork if episode artwork not found
            if (!episodeArtwork && showArtwork) episodeArtwork = showArtwork;

            // Convert HTML description to plain text, preserving line breaks
            var rawHtml = rssDescription;
            // Replace block/line-breaking elements with newlines BEFORE stripping tags
            var d = rawHtml
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<\/p>/gi, '\n\n')
                .replace(/<\/div>/gi, '\n')
                .replace(/<\/li>/gi, '\n')
                .replace(/<[^>]+>/g, '')  // strip remaining HTML tags
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&nbsp;/g, ' ')
                .replace(/\r\n/g, '\n')
                .replace(/\n{3,}/g, '\n\n')  // collapse excessive blank lines
                .trim();

            // Also try page DOM as fallback if RSS description is empty
            if (!d.trim()) {
                var a = document.body.innerText;
                var s = a.indexOf('Episode Description');
                var e = a.indexOf('Episode Details');
                if (s > -1 && e > -1) d = a.substring(s + 19, e).trim();
            }

            // YouTube embed
            var ytMatch = d.match(/https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/) ||
                          rssDescription.match(/https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
            var ytEmbed = ytMatch ? '<div class="ycp-video-wrap"><iframe src="https://www.youtube.com/embed/' + ytMatch[1] + '" frameborder="0" allowfullscreen></iframe></div>' : '';

            // Clean description for excerpt/meta
            var cleanDesc = d.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

            // Excerpt
            var excerpt = cleanDesc.substring(0, 200);
            if (cleanDesc.length > 200) {
                var lastSp = excerpt.lastIndexOf(' ');
                if (lastSp > 150) excerpt = excerpt.substring(0, lastSp);
            }
            excerpt = excerpt + '...';

            // Meta description
            var md = 'Your Colorful Path with Charu Boeckel: ' + cleanDesc.substring(0, 120);
            if (md.length > 157) md = md.substring(0, 157) + '...';

            // Process description paragraphs
            // Filter out "Read More", horizontal lines (━━━), and empty lines
            var dp = d.split('\n').filter(function(p) {
                var trimmed = p.trim();
                if (!trimmed) return false;
                if (trimmed.toLowerCase() === 'read more' || trimmed.toLowerCase() === 'read more...') return false;
                // Remove lines that are only special characters (horizontal rules, decorators)
                if (!/[a-zA-Z0-9]/.test(trimmed)) return false;
                return true;
            });

            // Header patterns - only match when keyword is at start after emoji/whitespace (no letters before keyword)
            var headerPatterns = /^[^a-zA-Z]{0,10}(CHAPTERS?|CHAPTER LIST|GUEST|HOST|KEY TAKEAWAYS?|TOPICS?|ABOUT|CONNECT|LINKS|RESOURCES|SHOW NOTES?|IN THIS EPISODE|EPISODE HIGHLIGHTS?|SUBSCRIBE)\b/i;

            var linkTarget = function(url) {
                return /divineamuleto\.com/i.test(url) ? '' : ' target="_blank" rel="noopener"';
            };

            var dh = '';
            var inListGroup = false;
            for (var j = 0; j < dp.length; j++) {
                // First: convert "Label: URL" lines into linked text (e.g. "💜 Website: https://..." → linked "💜 Website")
                var line = dp[j].trim();
                var labelUrlMatch = line.match(/^(.+?):\s+(https?:\/\/[^\s]+)\s*$/);
                if (labelUrlMatch) {
                    var label = labelUrlMatch[1].trim();
                    var url = labelUrlMatch[2];
                    // Pull leading emoji/symbols outside the link so they don't get underlined
                    var emojiPrefix = '';
                    var linkText = label;
                    var em = label.match(/^([^\x20-\x7E]+\s*)/);
                    if (em) { emojiPrefix = em[1]; linkText = label.substring(em[1].length); }
                    line = emojiPrefix + '<a href="' + url + '"' + linkTarget(url) + '>' + linkText + '</a>';
                } else {
                    // Standard URL/handle linking for non-label lines
                    line = line
                        .replace(/(https?:\/\/[^\s<]+)/g, function(m) { return '<a href="' + m + '"' + linkTarget(m) + '>' + m + '</a>'; })
                        .replace(/(?<![\/\w"'])(www\.[^\s<]+)/gi, function(m) { return '<a href="https://' + m + '"' + linkTarget(m) + '>' + m + '</a>'; })
                        .replace(/(?<![\/\w"'.])([A-Z][A-Z0-9-]+\.(?:COM|ORG|NET|CO))\b/g, function(m) { return '<a href="https://' + m + '"' + linkTarget(m) + '>' + m + '</a>'; })
                        .replace(/@(\w+)/g, '<a href="https://instagram.com/$1" target="_blank" rel="noopener">@$1</a>');
                }
                var trimmedLine = dp[j].trim();
                var isHeader = headerPatterns.test(trimmedLine);
                var isChapterItem = /^\d{1,2}:\d{2}/.test(trimmedLine) || /^\(\d{1,2}:\d{2}/.test(trimmedLine);
                var nextIsChapterItem = (j < dp.length - 1) && (/^\d{1,2}:\d{2}/.test(dp[j+1].trim()) || /^\(\d{1,2}:\d{2}/.test(dp[j+1].trim()));
                // Detect link-list lines: starts with emoji or bullet, contains URL or @handle
                var isLinkLine = /^[\u2000-\u3300\uD83C-\uDBFF\uDC00-\uDFFF•●▪]/.test(trimmedLine) &&
                    (/https?:\/\/|www\.|@\w|\.com|\.org|\.net/i.test(trimmedLine));
                var nextTrimmed = (j < dp.length - 1) ? dp[j+1].trim() : '';
                var nextIsLinkLine = /^[\u2000-\u3300\uD83C-\uDBFF\uDC00-\uDFFF•●▪]/.test(nextTrimmed) &&
                    (/https?:\/\/|www\.|@\w|\.com|\.org|\.net/i.test(nextTrimmed));
                var nextIsHeader = headerPatterns.test(nextTrimmed);

                var isListItem = isChapterItem || isLinkLine;
                var nextIsListItem = nextIsChapterItem || nextIsLinkLine;

                if (isHeader) {
                    dh += '<p class="ycp-section-header"><strong>' + line + '</strong></p>\n';
                } else if (isListItem) {
                    if (!inListGroup) { dh += '<p>'; inListGroup = true; }
                    else { dh += '<br>\n'; }
                    dh += line;
                    if (!nextIsListItem) { dh += '</p>\n'; inListGroup = false; }
                } else {
                    dh += '<p>' + line + '</p>\n';
                }
            }

            // Base64 encode the GUID for pod.link
            var encodedGuid = episodeGuid ? btoa(episodeGuid) : '';
            var podlinkPage = encodedGuid ? ('https://pod.link/' + appleShowId + '/episode/' + encodedGuid) : ('https://pod.link/' + appleShowId);

            // Listen button
            var listenButton = '<div class="ycp-listen">' +
                '<a href="' + podlinkPage + '" target="_blank" rel="noopener">' +
                '<img src="https://cdn.shopify.com/s/files/1/0870/3688/7345/files/Listen_on_Your_Favorite_App.png?v=1771919518" alt="Listen on Your Favorite App">' +
                '</a></div>';

            // Content HTML
            var ch = (ytEmbed ? '<!-- YouTube Video -->\n' + ytEmbed + '\n\n' : '') +
                '<!-- Listen Button -->\n' + listenButton + '\n\n' +
                '<!-- Description -->\n<div class="ycp-desc">\n' + dh + '</div>\n\n' +
                '<!-- Audio Player -->\n<div class="ycp-audio">\n<iframe title="Libsyn Player" src="' + eu + '" allowfullscreen></iframe>\n</div>\n\n' +
                '<!-- CTA -->\n<div class="ycp-cta">\n<h3>Continue Your Journey</h3>\n<p>Ready to experience the power of intentional, high-frequency jewelry? Each Amuleto is designed to hold and amplify your meditation practice, created with sacred geometry and mindful craftsmanship.</p>\n<a class="button" href="/collections/all" target="_blank" rel="noopener">Explore Collection</a>\n</div>';

            var esc = ch.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

            var sw = screen.width, sh = screen.height;
            var w1 = Math.floor(sw / 3), w2 = Math.floor(sw * 2 / 3);

            var css = '*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:#faf8f5;color:#2d2a26}.hdr{background:#2d2a26;color:#fff;padding:16px 20px;position:sticky;top:0}.hdr h1{font-size:1rem}.wrap{max-width:100%;margin:0 auto;padding:20px}.fld{background:#fff;border-radius:8px;padding:14px 16px;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,0,0,.08)}.fld-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.lbl{font-size:.7rem;font-weight:600;text-transform:uppercase;color:#7a7570}.shp{font-size:.6rem;color:#999;background:#f0f0f0;padding:2px 6px;border-radius:3px}.row{display:flex;gap:8px}.val{flex:1;background:#f8f6f3;padding:10px;border-radius:6px;font-size:.85rem;white-space:pre-wrap;word-break:break-word;max-height:200px;overflow-y:auto}.val.code{background:#1e1e1e;color:#d4d4d4;font-family:monospace;font-size:.7rem}.btn{background:#d49633;color:#fff;border:none;padding:6px 12px;border-radius:5px;cursor:pointer;font-size:.75rem;font-weight:500;white-space:nowrap}.btn:hover{background:#c47d28}.btn.ok{background:#2d8a2d}.sep{border:none;border-top:2px dashed #e0dcd8;margin:20px 0}.sec{font-size:.7rem;font-weight:600;text-transform:uppercase;color:#d49633;margin-bottom:12px}.note{font-size:11px;color:#999;margin-top:-8px;margin-bottom:14px}';

            var h = '<!DOCTYPE html><html><head><title>Ready for Shopify</title><style>' + css + '</style></head><body>';
            h += '<div class="hdr"><h1>✨ Copy to Shopify</h1></div><div class="wrap">';
            h += '<div class="fld"><div class="fld-top"><span class="lbl">Title</span><span class="shp">Blog Post: Title</span></div><div class="row"><div class="val" id="f1">' + t + '</div><button class="btn" onclick="cp(\'f1\',this)">Copy</button></div></div>';
            h += '<div class="fld"><div class="fld-top"><span class="lbl">Content (HTML)</span><span class="shp">Blog Post: Content (click &lt;/&gt; first)</span></div><div class="row"><div class="val code" id="f2">' + esc + '</div><button class="btn" onclick="cp(\'f2\',this)">Copy</button></div></div>';
            if (encodedGuid) {
                h += '<p class="note">✅ Episode found! Listen button and artwork linked.</p>';
            } else {
                h += '<p class="note">⚠️ Could not find episode in RSS feed. Generic podcast link used.</p>';
            }
            h += '<div class="fld"><div class="fld-top"><span class="lbl">Excerpt</span><span class="shp">Blog Post: Excerpt</span></div><div class="row"><div class="val" id="f9">' + excerpt + '</div><button class="btn" onclick="cp(\'f9\',this)">Copy</button></div></div>';
            h += '<hr class="sep"><div class="sec">Search Engine Listing</div>';
            h += '<p class="note" style="margin-top:-8px;">⚠️ Double-check these for accuracy before publishing</p>';
            h += '<div class="fld"><div class="fld-top"><span class="lbl">Page Title (SEO) - Option A</span><span class="shp">Edit SEO → Page title</span></div><p class="note" style="margin-bottom:8px;">Select all & delete existing text first, then paste</p><div class="row"><div class="val" id="f3">' + seoTitle1 + '</div><button class="btn" onclick="cp(\'f3\',this)">Copy</button></div></div>';
            h += '<div class="fld"><div class="fld-top"><span class="lbl">Page Title (SEO) - Option B</span><span class="shp">More keywords</span></div><div class="row"><div class="val" id="f3b">' + seoTitle2 + '</div><button class="btn" onclick="cp(\'f3b\',this)">Copy</button></div></div>';
            h += '<div class="fld"><div class="fld-top"><span class="lbl">Meta Description</span><span class="shp">Edit SEO → Description</span></div><div class="row"><div class="val" id="f4">' + md + '</div><button class="btn" onclick="cp(\'f4\',this)">Copy</button></div></div>';
            h += '<div class="fld"><div class="fld-top"><span class="lbl">URL Handle</span><span class="shp">Edit SEO → URL handle</span></div><p class="note" style="margin-bottom:8px;">Select all & delete existing text first, then paste</p><div class="row"><div class="val" id="f5">' + uh + '</div><button class="btn" onclick="cp(\'f5\',this)">Copy</button></div></div>';
            h += '<hr class="sep">';
            h += '<div class="fld"><div class="fld-top"><span class="lbl">Tags</span><span class="shp">Type to auto-populate</span></div><p class="note" style="margin-bottom:8px;">Click in the Tags field & type to select</p><div class="row"><div class="val" id="f6">podcast</div><button class="btn" onclick="cp(\'f6\',this)">Copy</button></div></div>';
            h += '<hr class="sep"><div class="sec">Image</div>';
            if (episodeArtwork) {
                h += '<div class="fld"><div class="fld-top"><span class="lbl">Episode Artwork</span><span class="shp">Right-click image → Save As</span></div>';
                h += '<div style="text-align:center;margin:10px 0;"><a href="' + episodeArtwork + '" target="_blank"><img src="' + episodeArtwork + '" style="max-width:200px;max-height:200px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);" alt="Episode Artwork"></a></div>';
                h += '<div style="text-align:center;margin:10px 0;"><a href="' + episodeArtwork + '" target="_blank" style="display:inline-block;background:#d49633;color:white;padding:8px 16px;border-radius:5px;text-decoration:none;font-size:13px;">Download Full Size</a></div>';
                h += '</div>';
            } else {
                h += '<p class="note">⚠️ Episode artwork not found in RSS feed</p>';
            }
            h += '<div class="fld"><div class="fld-top"><span class="lbl">Featured Image Alt Text</span><span class="shp">Blog Post: Image → Edit alt text</span></div><div class="row"><div class="val" id="f7">' + altText + '</div><button class="btn" onclick="cp(\'f7\',this)">Copy</button></div></div>';
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
