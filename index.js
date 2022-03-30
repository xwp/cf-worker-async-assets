const allowList = {
	styles: [ /block-library\/style\.css/ ],
	scripts: []
}

addEventListener( 'fetch', event => {
	event.respondWith( handleRequest( event.request ) )
});

async function handleRequest(request) {
	const url = new URL( request.url );

	if ( url.pathname === '/robots.txt' ) {
		return new Response(
			'User-agent: *\nDisallow: /',
			{
				status: 200,
				headers: {
					'Content-Type': 'text/plain'
				}
			}
		);
	}
	
	const originalHost = request.headers.get( 'x-host' );

	if ( ! originalHost ) {
		return new Response(
			JSON.stringify({
				error: 'No host provided'
			}),
			{
				status: 403,
				headers: {
					'Content-Type': 'application/json'
				}
			}
		);
	}
	
	url.hostname = originalHost;

	const bypassTransform = Boolean( request.headers.get('x-bypass-transform') );

	console.log( bypassTransform );

	if ( ! bypassTransform  ) {
		const response = await fetch( url.toString(), request );

		return new HTMLRewriter()
			.on( 'link[rel=stylesheet]', new ExternalStylesheetTransformer() )
			.on( 'script[src]', new ExternalScriptTransformer() )
			.transform( response );
	}

	return fetch( url.toString(), request );
}

class ExternalStylesheetTransformer {
	element( linkElement ) {
		const href = linkElement.getAttribute('href');
		const bypass = allowList.styles.some( pattern => pattern.test( href ) );

		if ( ! bypass ) {
			linkElement.setAttribute( 'media', 'print' );
			linkElement.setAttribute( 'onload', 'this.media=\'all\'' );
		}
	}
}

class ExternalScriptTransformer {
	element( scriptElement ) {
		const src = scriptElement.getAttribute('src');
		const bypass = allowList.scripts.some( pattern => pattern.test( src ) );

		if ( ! bypass ) {
			scriptElement.setAttribute( 'async', '' );
		}
	}
}