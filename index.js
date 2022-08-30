const allowList = {
    styles: [/block-library\/style\.css/],
    scripts: [],
}

const preloadList = {
    styles: [],
    scripts: [],
    images: [],
};

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
});

async function handleRequest(request) {
    const bypassTransform = Boolean(request.headers.get('x-bypass-transform'));

    if (!bypassTransform) {
        const response = await fetch(request);

        return new HTMLRewriter()
            .on('link[rel=stylesheet]', new StylesheetElementHandler())
            .on('script[src]', new ScriptElementHandler())
            .on('img', new ImageElementHandler())
            .on('header.wp-block-template-part .wp-block-image > img', new ImageLcpElementHandler())
            .on('head', new HeadElementHandler())
            .transform(response);
    }

    return fetch(request);
}

class StylesheetElementHandler {
    element(linkElement) {
        const href = linkElement.getAttribute('href');
        const bypass = allowList.styles.some(pattern => pattern.test(href));

        if (!bypass) {
            linkElement.setAttribute('media', 'print');
            linkElement.setAttribute('onload', 'this.media=\'all\'');
        } else {
            if (!preloadList.styles.includes(href)) {
                preloadList.styles.push(href);
            }
        }
    }
}

class ScriptElementHandler {
    element(scriptElement) {
        const src = scriptElement.getAttribute('src');
        const bypass = allowList.scripts.some(pattern => pattern.test(src));

        if (!bypass) {
            scriptElement.setAttribute('async', '');
        } else {
            if (!preloadList.scripts.includes(src)) {
                preloadList.scripts.push(src);
            }
        }
    }
}

class ImageElementHandler {
    element(imageElement) {
        imageElement.setAttribute('decoding', 'async');
        imageElement.setAttribute('loading', 'lazy');
    }
}

class ImageLcpElementHandler {
    element(ImageLcpElement) {
        const src = ImageLcpElement.getAttribute('src');
        const srcset = ImageLcpElement.getAttribute('srcset');
        const sizes = ImageLcpElement.getAttribute('sizes');

        if (!preloadList.images.some(pattern => pattern.href === src)) {
            preloadList.images.push({
                'href': src,
                'imagesrcset': srcset,
                'imagesizes': sizes
            });
        }

        ImageLcpElement.removeAttribute('loading');
        ImageLcpElement.setAttribute('fetchpriority', 'high');
    }
}

class HeadElementHandler {
    element(headElement) {
        preloadList.styles.map((href) => {
            headElement.prepend(`<link rel="preload" href="${href}" as="style">`, {html: true});
        });
        preloadList.scripts.map((href) => {
            headElement.prepend(`<link rel="preload" href="${href}" as="script">`, {html: true});
        });
        preloadList.images.map((e) => {
            const attr = [
                e.href ? `href="${e.href}"` : '',
                e.imagesrcset ? `imagesrcset="${e.imagesrcset}"` : '',
                e.imagesizes ? `imagesrcset="${e.imagesizes}"` : ''
            ];
            const htmlAttr = attr.filter(function (el) {
                return el !== '';
            }).join(' ');

            headElement.prepend(`<link fetchpriority="high" rel="preload" as="image" ${htmlAttr}>`, {html: true});
        });
    }
}