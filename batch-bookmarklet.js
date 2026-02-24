(function() {
    if (location.hostname.indexOf('libsyn.com') < 0) {
        alert('Please run this on the Your Colorful Path Libsyn page:\nhttps://ad52c5cc-20e4-4770-8977-92695936dc6b.libsyn.com/');
        return;
    }

    // Show loading overlay
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center;color:white;font-family:-apple-system,sans-serif;font-size:1.2rem;';
    overlay.textContent = 'Loading all episodes...';
    document.body.appendChild(overlay);

    var rssFeed = 'https://rss.libsyn.com/shows/521038/destinations/4475083.xml';
    var appleShowId = '1790327657';
    var showBase = location.origin;

    // Title case helper
    function toTitleCase(str) {
        var smallWords = ['a', 'an', 'the', 'and', 'but', 'or', 'for', 'nor', 'on', 'at', 'to', 'by', 'of', 'in', 'with'];
        return str.replace(/\w\S*/g, function(txt, index) {
            var lower = txt.toLowerCase();
            if (index > 0 && smallWords.indexOf(lower) > -1) return lower;
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        });
    }

    // Extract PAGE_DATA JSON from HTML using brace counting (handles nested objects)
    function extractPageData(html) {
        var marker = html.indexOf('window.PAGE_DATA');
        if (marker === -1) return null;
        var braceStart = html.indexOf('{', marker);
        if (braceStart === -1) return null;
        var depth = 0;
        var inString = false;
        var escaped = false;
        for (var i = braceStart; i < html.length; i++) {
            var ch = html[i];
            if (escaped) { escaped = false; continue; }
            if (ch === '\\' && inString) { escaped = true; continue; }
            if (ch === '"') { inString = !inString; continue; }
            if (inString) continue;
            if (ch === '{' || ch === '[') depth++;
            else if (ch === '}' || ch === ']') {
                depth--;
                if (depth === 0) {
                    try { return JSON.parse(html.substring(braceStart, i + 1)); }
                    catch(e) { return null; }
                }
            }
        }
        return null;
    }

    // Extract item_id and item_title pairs from HTML using simple regex
    function extractItemsFromHtml(html) {
        var items = [];
        // Match each item object by finding item_id followed by item_title (or vice versa)
        var pattern = /"item_id"\s*:\s*(\d+)/g;
        var titlePattern = /"item_title"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
        var ids = [], titles = [];
        var m;
        while ((m = pattern.exec(html)) !== null) ids.push(m[1]);
        while ((m = titlePattern.exec(html)) !== null) titles.push(m[1]);
        for (var i = 0; i < ids.length && i < titles.length; i++) {
            items.push({ item_id: ids[i], item_title: titles[i] });
        }
        return items;
    }

    // Collect episode IDs from paginated show pages
    function collectEpisodeIds() {
        var allItems = [];
        var debugLog = [];

        // Try current page's window.PAGE_DATA first
        if (window.PAGE_DATA && window.PAGE_DATA.items) {
            window.PAGE_DATA.items.forEach(function(item) {
                allItems.push({ item_id: String(item.item_id), item_title: item.item_title || '' });
            });
            debugLog.push('PAGE_DATA: ' + allItems.length + ' items');
        } else {
            debugLog.push('PAGE_DATA: not found');
            // Fallback: extract from current page's HTML
            var pageItems = extractItemsFromHtml(document.documentElement.innerHTML);
            if (pageItems.length > 0) {
                allItems = pageItems;
                debugLog.push('HTML extract (current page): ' + pageItems.length + ' items');
            }
        }

        // Fetch a page and extract items
        function fetchPage(pageNum) {
            var url = showBase + '/page/' + pageNum + '/size/5';
            return fetch(url)
                .then(function(r) {
                    debugLog.push('Page ' + pageNum + ': HTTP ' + r.status);
                    return r.text();
                })
                .then(function(html) {
                    // Try brace-counting parser first
                    var data = extractPageData(html);
                    if (data && data.items && data.items.length > 0) {
                        debugLog.push('Page ' + pageNum + ': JSON parsed, ' + data.items.length + ' items');
                        return data.items.map(function(item) {
                            return { item_id: String(item.item_id), item_title: item.item_title || '' };
                        });
                    }
                    // Fallback: regex extraction
                    var regexItems = extractItemsFromHtml(html);
                    if (regexItems.length > 0) {
                        debugLog.push('Page ' + pageNum + ': regex extracted ' + regexItems.length + ' items');
                        return regexItems;
                    }
                    debugLog.push('Page ' + pageNum + ': no items found (html length: ' + html.length + ')');
                    return [];
                })
                .catch(function(err) {
                    debugLog.push('Page ' + pageNum + ': FETCH ERROR - ' + err.message);
                    return [];
                });
        }

        // Fetch pages sequentially until empty
        function fetchAllPages(pageNum) {
            return fetchPage(pageNum).then(function(items) {
                if (items.length === 0) {
                    // Store debug log for later display
                    allItems._debugLog = debugLog;
                    return allItems;
                }
                items.forEach(function(item) {
                    var exists = allItems.some(function(a) { return a.item_id === item.item_id; });
                    if (!exists) allItems.push(item);
                });
                overlay.textContent = 'Loading episodes... (' + allItems.length + ' found)';
                return fetchAllPages(pageNum + 1);
            });
        }

        // Start from page 1 if we didn't get anything from window.PAGE_DATA
        var startPage = allItems.length > 0 ? 2 : 1;
        return fetchAllPages(startPage);
    }

    // Process one RSS item into Shopify-ready data
    function processEpisode(rssItem, itemId, showArtwork) {
        var titleEl = rssItem.querySelector('title');
        var rawTitle = titleEl ? titleEl.textContent.trim() : '';
        var epNumMatch = rawTitle.match(/^#?(\d+)\s*/);
        var en = epNumMatch ? epNumMatch[1] : '';

        // Format title
        var t = rawTitle;
        if (epNumMatch) {
            t = 'Episode #' + epNumMatch[1] + ' ' + rawTitle.substring(epNumMatch[0].length);
        } else if (!/^Episode\s*#?\d+/i.test(t)) {
            t = en ? ('Episode #' + en + ' ' + t) : t;
        }
        t = toTitleCase(t);

        // Build embed URL
        var eu = itemId
            ? 'https://play.libsyn.com/embed/episode/id/' + itemId + '/height/128/theme/modern/size/standard/thumbnail/yes/custom-color/b88748/time-start/00:00:00/hide-playlist/yes/hide-subscribe/yes/hide-share/yes/font-color/ffffff'
            : '';

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

        // SEO Titles
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

        // GUID and artwork
        var guidEl = rssItem.querySelector('guid');
        var episodeGuid = guidEl ? guidEl.textContent.trim() : '';
        var itunesImage = rssItem.querySelector('image');
        var episodeArtwork = (itunesImage && itunesImage.getAttribute('href')) ? itunesImage.getAttribute('href') : '';
        if (!episodeArtwork && showArtwork) episodeArtwork = showArtwork;

        // Description
        var descEl = rssItem.querySelector('description');
        var rssDescription = descEl ? descEl.textContent.trim() : '';

        var rawHtml = rssDescription;
        var d = rawHtml
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/p>/gi, '\n\n')
            .replace(/<\/div>/gi, '\n')
            .replace(/<\/li>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ')
            .replace(/\r\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

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
        var dp = d.split('\n').filter(function(p) {
            var trimmed = p.trim();
            if (!trimmed) return false;
            if (trimmed.toLowerCase() === 'read more' || trimmed.toLowerCase() === 'read more...') return false;
            if (!/[a-zA-Z0-9]/.test(trimmed)) return false;
            return true;
        });

        var headerPatterns = /^[^a-zA-Z]{0,10}(CHAPTERS?|CHAPTER LIST|GUEST|HOST|KEY TAKEAWAYS?|TOPICS?|ABOUT|CONNECT|LINKS|RESOURCES|SHOW NOTES?|IN THIS EPISODE|EPISODE HIGHLIGHTS?|EPISODE OVERVIEW|SUBSCRIBE)\s*:?\s*$/i;

        var linkTarget = function(url) {
            return /divineamuleto\.com/i.test(url) ? '' : ' target="_blank" rel="noopener"';
        };

        var dh = '';
        var inListGroup = false;
        var inBulletGroup = false;
        for (var j = 0; j < dp.length; j++) {
            var line = dp[j].trim();
            var labelUrlMatch = line.match(/^(.+?):\s+(https?:\/\/[^\s]+)\s*$/);
            if (labelUrlMatch) {
                var label = labelUrlMatch[1].trim();
                var url = labelUrlMatch[2];
                var igHandle = url.match(/instagram\.com\/([a-zA-Z0-9_.]+)\/?$/);
                if (igHandle) {
                    var emojiPrefix = '';
                    var em = label.match(/^([^\x20-\x7E]+\s*)/);
                    if (em) { emojiPrefix = em[1]; }
                    line = emojiPrefix + '<a href="' + url + '"' + linkTarget(url) + '>Instagram: @' + igHandle[1] + '</a>';
                } else {
                    var emojiPrefix = '';
                    var linkText = label;
                    var em = label.match(/^([^\x20-\x7E]+\s*)/);
                    if (em) { emojiPrefix = em[1]; linkText = label.substring(em[1].length); }
                    line = emojiPrefix + '<a href="' + url + '"' + linkTarget(url) + '>' + linkText + '</a>';
                }
            } else {
                line = line
                    .replace(/(https?:\/\/[^\s<]+)/g, function(m) { return '<a href="' + m + '"' + linkTarget(m) + '>' + m + '</a>'; })
                    .replace(/(?<![\/\w"'])(www\.[^\s<]+)/gi, function(m) { return '<a href="https://' + m + '"' + linkTarget(m) + '>' + m + '</a>'; })
                    .replace(/(?<![\/\w"'.])([A-Z][A-Z0-9-]+\.(?:COM|ORG|NET|CO))\b/g, function(m) { return '<a href="https://' + m + '"' + linkTarget(m) + '>' + m + '</a>'; })
                    .replace(/@(\w+)/g, '<a href="https://instagram.com/$1" target="_blank" rel="noopener">@$1</a>');
            }
            line = line.replace(/(?<![">])Your Colorful Path(?![^<]*<\/a>)/g, '<a href="/your-colorful-path-podcast">Your Colorful Path</a>');
            var trimmedLine = dp[j].trim();
            var isHeader = headerPatterns.test(trimmedLine);
            var isChapterItem = /^\d{1,2}:\d{2}/.test(trimmedLine) || /^\(\d{1,2}:\d{2}/.test(trimmedLine);
            var nextIsChapterItem = (j < dp.length - 1) && (/^\d{1,2}:\d{2}/.test(dp[j+1].trim()) || /^\(\d{1,2}:\d{2}/.test(dp[j+1].trim()));
            var hasLinkContent = /https?:\/\/|www\.|@\w|\.com|\.org|\.net/i.test(trimmedLine);
            var isLinkLine = (/^[\u2000-\u3300\uD83C-\uDBFF\uDC00-\uDFFF•●▪]/.test(trimmedLine) && hasLinkContent) ||
                /^[^:]+:\s+@\w+/.test(trimmedLine);
            var isBulletLine = /^[•●▪]\s/.test(trimmedLine);
            var nextTrimmed = (j < dp.length - 1) ? dp[j+1].trim() : '';
            var nextHasLink = /https?:\/\/|www\.|@\w|\.com|\.org|\.net/i.test(nextTrimmed);
            var nextIsLinkLine = (/^[\u2000-\u3300\uD83C-\uDBFF\uDC00-\uDFFF•●▪]/.test(nextTrimmed) && nextHasLink) ||
                /^[^:]+:\s+@\w+/.test(nextTrimmed);
            var nextIsBulletLine = /^[•●▪]\s/.test(nextTrimmed);
            var nextIsHeader = headerPatterns.test(nextTrimmed);

            var isListItem = isChapterItem || isLinkLine;
            var nextIsListItem = nextIsChapterItem || nextIsLinkLine;

            if (isHeader) {
                dh += '<p class="ycp-section-header"><strong>' + line + '</strong></p>\n';
            } else if (isBulletLine) {
                var bulletText = line.replace(/^[•●▪]\s*/, '');
                if (!inBulletGroup) { dh += '<ul>\n'; inBulletGroup = true; }
                dh += '<li>' + bulletText + '</li>\n';
                if (!nextIsBulletLine) { dh += '</ul>\n'; inBulletGroup = false; }
            } else if (isListItem) {
                if (!inListGroup) { dh += '<p>'; inListGroup = true; }
                else { dh += '<br>\n'; }
                dh += line;
                if (!nextIsListItem) { dh += '</p>\n'; inListGroup = false; }
            } else {
                dh += '<p>' + line + '</p>\n';
            }
        }

        // Base64 encode GUID for pod.link
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
            (eu ? '<!-- Audio Player -->\n<div class="ycp-audio">\n<iframe title="Embed Player" src="' + eu + '" scrolling="no" allowfullscreen webkitallowfullscreen="true" mozallowfullscreen="true" oallowfullscreen="true" msallowfullscreen="true"></iframe>\n</div>\n\n' : '') +
            '<!-- CTA -->\n<div class="ycp-cta">\n<h3>Continue Your Journey</h3>\n<p>Ready to experience the power of intentional, high-frequency jewelry? Each Amuleto is designed to hold and amplify your meditation practice, created with sacred geometry and mindful craftsmanship.</p>\n<a class="button" href="/collections/all" target="_blank" rel="noopener">Explore Collection</a>\n</div>';

        return {
            episodeNum: en,
            title: t,
            contentHtml: ch,
            excerpt: excerpt,
            seoTitle1: seoTitle1,
            seoTitle2: seoTitle2,
            metaDesc: md,
            urlHandle: uh,
            altText: altText,
            artwork: episodeArtwork,
            hasEmbed: !!eu,
            hasGuid: !!encodedGuid
        };
    }

    // Main: collect IDs, fetch RSS, process all
    Promise.all([
        collectEpisodeIds(),
        fetch(rssFeed).then(function(r) { return r.text(); })
    ]).then(function(results) {
        var pageItems = results[0];
        var rssData = results[1];

        var parser = new DOMParser();
        var xml = parser.parseFromString(rssData, 'text/xml');
        var rssItems = xml.querySelectorAll('item');
        var showImage = xml.querySelector('channel > image > url') || xml.querySelector('channel image url');
        var showArtwork = showImage ? showImage.textContent.trim() : '';

        // Debug: show what was collected
        var debugInfo = (pageItems._debugLog || []).join('\n');
        var sampleItems = pageItems.slice(0, 3).map(function(it) { return it.item_id + ' = ' + it.item_title; }).join('\n');
        alert('DEBUG (will remove once working)\n\nIDs collected: ' + pageItems.length + '\nSample:\n' + sampleItems + '\n\nLog:\n' + debugInfo);

        // Build lookup: episode number → item_id
        var idLookup = {};
        pageItems.forEach(function(item) {
            var m = item.item_title.match(/^#?(\d+)\s/);
            if (m) idLookup[m[1]] = item.item_id;
        });

        // Process each RSS item
        var episodes = [];
        for (var i = 0; i < rssItems.length; i++) {
            var titleEl = rssItems[i].querySelector('title');
            var rssTitle = titleEl ? titleEl.textContent.trim() : '';
            var epMatch = rssTitle.match(/^#?(\d+)\s/);
            var epNum = epMatch ? epMatch[1] : '';
            var itemId = epNum ? (idLookup[epNum] || '') : '';

            var ep = processEpisode(rssItems[i], itemId, showArtwork);
            episodes.push(ep);
        }

        overlay.remove();

        // Build popup
        var sw = screen.width, sh = screen.height;
        var css = '*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,sans-serif;background:#faf8f5;color:#2d2a26}.hdr{background:#2d2a26;color:#fff;padding:16px 20px;position:sticky;top:0;z-index:10}.hdr h1{font-size:1rem}.hdr .sub{color:#9a9590;font-size:.8rem;margin-top:4px}.wrap{max-width:100%;margin:0 auto;padding:20px}.ep{background:#fff;border-radius:8px;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,.08);overflow:hidden}.ep-hdr{padding:14px 16px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid transparent}.ep-hdr:hover{background:#f8f6f3}.ep-hdr.open{border-bottom-color:#e8e4df}.ep-title{font-size:.9rem;font-weight:600}.ep-num{font-size:.7rem;color:#999;background:#f0f0f0;padding:2px 8px;border-radius:3px;flex-shrink:0;margin-left:12px}.ep-body{display:none;padding:16px}.ep-body.open{display:block}.fld{background:#fff;border-radius:8px;padding:14px 16px;margin-bottom:14px;box-shadow:0 1px 3px rgba(0,0,0,.08)}.fld-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.lbl{font-size:.7rem;font-weight:600;text-transform:uppercase;color:#7a7570}.shp{font-size:.6rem;color:#999;background:#f0f0f0;padding:2px 6px;border-radius:3px}.row{display:flex;gap:8px}.val{flex:1;background:#f8f6f3;padding:10px;border-radius:6px;font-size:.85rem;white-space:pre-wrap;word-break:break-word;max-height:200px;overflow-y:auto}.val.code{background:#1e1e1e;color:#d4d4d4;font-family:monospace;font-size:.7rem}.btn{background:#d49633;color:#fff;border:none;padding:6px 12px;border-radius:5px;cursor:pointer;font-size:.75rem;font-weight:500;white-space:nowrap}.btn:hover{background:#c47d28}.btn.ok{background:#2d8a2d}.sep{border:none;border-top:2px dashed #e0dcd8;margin:20px 0}.sec{font-size:.7rem;font-weight:600;text-transform:uppercase;color:#d49633;margin-bottom:12px}.note{font-size:11px;color:#999;margin-top:-8px;margin-bottom:14px}.shopify-link{display:inline-block;background:#5c6ac4;color:white;padding:6px 14px;border-radius:5px;text-decoration:none;font-size:.75rem;font-weight:500;margin-top:8px}.shopify-link:hover{background:#4959bd}.warn{color:#c47d28}';

        var h = '<!DOCTYPE html><html><head><title>Batch: Copy to Shopify</title><style>' + css + '</style></head><body>';
        h += '<div class="hdr"><h1>Batch: Copy to Shopify</h1><div class="sub">' + episodes.length + ' episodes found &bull; Click episode to expand</div></div>';
        h += '<div class="wrap">';

        for (var k = 0; k < episodes.length; k++) {
            var ep = episodes[k];
            var esc = ep.contentHtml.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            var warnings = [];
            if (!ep.hasEmbed) warnings.push('No audio embed (episode ID not found)');
            if (!ep.hasGuid) warnings.push('No pod.link (GUID not found)');
            var warnHtml = warnings.length ? ' <span class="warn">&#9888;</span>' : '';

            h += '<div class="ep">';
            h += '<div class="ep-hdr" onclick="toggle(this)">';
            h += '<span class="ep-title">' + ep.title + warnHtml + '</span>';
            h += '<span class="ep-num">EP ' + (ep.episodeNum || '?') + '</span>';
            h += '</div>';
            h += '<div class="ep-body" id="ep' + k + '">';

            if (warnings.length) {
                h += '<p class="note warn">' + warnings.join(' &bull; ') + '</p>';
            }

            h += '<a class="shopify-link" href="https://admin.shopify.com/store/b14b8f-c3/content/articles/new" target="_blank">Open New Shopify Article &rarr;</a>';

            h += '<hr class="sep">';
            h += '<div class="fld"><div class="fld-top"><span class="lbl">Title</span><span class="shp">Blog Post: Title</span></div><div class="row"><div class="val" id="f' + k + '_t">' + ep.title + '</div><button class="btn" onclick="cp(\'f' + k + '_t\',this)">Copy</button></div></div>';

            h += '<div class="fld"><div class="fld-top"><span class="lbl">Content (HTML)</span><span class="shp">Blog Post: Content (click &lt;/&gt; first)</span></div><div class="row"><div class="val code" id="f' + k + '_c">' + esc + '</div><button class="btn" onclick="cp(\'f' + k + '_c\',this)">Copy</button></div></div>';

            h += '<div class="fld"><div class="fld-top"><span class="lbl">Excerpt</span><span class="shp">Blog Post: Excerpt</span></div><div class="row"><div class="val" id="f' + k + '_ex">' + ep.excerpt + '</div><button class="btn" onclick="cp(\'f' + k + '_ex\',this)">Copy</button></div></div>';

            h += '<hr class="sep"><div class="sec">Search Engine Listing</div>';
            h += '<p class="note" style="margin-top:-8px;">Double-check these for accuracy before publishing</p>';

            h += '<div class="fld"><div class="fld-top"><span class="lbl">Page Title (SEO) - Option A</span><span class="shp">Edit SEO</span></div><p class="note" style="margin-bottom:8px;">Select all & delete existing text first, then paste</p><div class="row"><div class="val" id="f' + k + '_s1">' + ep.seoTitle1 + '</div><button class="btn" onclick="cp(\'f' + k + '_s1\',this)">Copy</button></div></div>';
            h += '<div class="fld"><div class="fld-top"><span class="lbl">Page Title (SEO) - Option B</span><span class="shp">More keywords</span></div><div class="row"><div class="val" id="f' + k + '_s2">' + ep.seoTitle2 + '</div><button class="btn" onclick="cp(\'f' + k + '_s2\',this)">Copy</button></div></div>';
            h += '<div class="fld"><div class="fld-top"><span class="lbl">Meta Description</span><span class="shp">Edit SEO</span></div><div class="row"><div class="val" id="f' + k + '_md">' + ep.metaDesc + '</div><button class="btn" onclick="cp(\'f' + k + '_md\',this)">Copy</button></div></div>';
            h += '<div class="fld"><div class="fld-top"><span class="lbl">URL Handle</span><span class="shp">Edit SEO</span></div><p class="note" style="margin-bottom:8px;">Select all & delete existing text first, then paste</p><div class="row"><div class="val" id="f' + k + '_uh">' + ep.urlHandle + '</div><button class="btn" onclick="cp(\'f' + k + '_uh\',this)">Copy</button></div></div>';

            h += '<hr class="sep">';
            h += '<div class="fld"><div class="fld-top"><span class="lbl">Tags</span><span class="shp">Type to auto-populate</span></div><div class="row"><div class="val" id="f' + k + '_tag">podcast</div><button class="btn" onclick="cp(\'f' + k + '_tag\',this)">Copy</button></div></div>';

            h += '<hr class="sep"><div class="sec">Image</div>';
            if (ep.artwork) {
                h += '<div class="fld"><div class="fld-top"><span class="lbl">Episode Artwork</span><span class="shp">Right-click image &rarr; Save As</span></div>';
                h += '<div style="text-align:center;margin:10px 0;"><a href="' + ep.artwork + '" target="_blank"><img src="' + ep.artwork + '" style="max-width:200px;max-height:200px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);" alt="Episode Artwork"></a></div>';
                h += '<div style="text-align:center;margin:10px 0;"><a href="' + ep.artwork + '" target="_blank" style="display:inline-block;background:#d49633;color:white;padding:8px 16px;border-radius:5px;text-decoration:none;font-size:13px;">Download Full Size</a></div>';
                h += '</div>';
            } else {
                h += '<p class="note">Episode artwork not found in RSS feed</p>';
            }
            h += '<div class="fld"><div class="fld-top"><span class="lbl">Featured Image Alt Text</span><span class="shp">Image &rarr; Edit alt text</span></div><div class="row"><div class="val" id="f' + k + '_alt">' + ep.altText + '</div><button class="btn" onclick="cp(\'f' + k + '_alt\',this)">Copy</button></div></div>';

            h += '</div></div>'; // close ep-body and ep
        }

        h += '</div>'; // close wrap

        h += '<script>';
        h += 'function cp(id,b){navigator.clipboard.writeText(document.getElementById(id).textContent).then(function(){b.textContent="Copied!";b.classList.add("ok");setTimeout(function(){b.textContent="Copy";b.classList.remove("ok")},1200)})}';
        h += 'function toggle(hdr){var body=hdr.nextElementSibling;var isOpen=body.classList.contains("open");body.classList.toggle("open");hdr.classList.toggle("open")}';
        h += '<\/script></body></html>';

        var popup = window.open('', '_blank', 'width=' + Math.min(sw, 900) + ',height=' + sh + ',left=' + Math.floor((sw - 900) / 2) + ',top=0,scrollbars=yes');
        popup.document.write(h);
        popup.document.close();

    }).catch(function(error) {
        overlay.remove();
        alert('Error: ' + error.message);
    });
})();
