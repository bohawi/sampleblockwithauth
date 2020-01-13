const express = require('express');
const session = require('express-session');
const proxy = require('http-proxy-middleware');
const bodyParser = require('body-parser');
const request = require('request');

if (process.env.NODE_ENV === 'development') {
	require('dotenv').config();
}

// wherever this is hosted needs to have those
// environment variables set to the MC app values
// given to you by the app center page
const authURL = process.env.AUTH_URL;
const restURL = process.env.REST_URL;
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const redirectURL = process.env.REDIRECT_URL;


const app = express();
let tssd = '';

// body parser for post
app.use(bodyParser.urlencoded({ extended: true }));

// session management: the UI won't authenticate and
// make calls to the MC API. Instead it keeps a session
// with the node layer here and sends calls to a node proxy
// that will authenticate against the MC and proxy API calls
// for the UI. The following code is storing sessions in memory
// for demo purposes and cannot be used for a prod setup.
// instead, use a persistent storage like redis or mongo
// with the session library
app.use(session({
	name: 'mcisv',
	secret: 'my-app-super-secret-session-token',
	cookie: {
		maxAge: 1000 * 60 * 60 * 24,
		secure: false
	},
	saveUninitialized: true,
	resave: false
}));

app.get('/', (req, res, next) => {
	const code = req.query.code;

	if (code) {
		// User has authenticated with Marketing Cloud.  Get an auth token and render the block
		tssd = req.query.tssd;

		// the call to the auth endpoint is done right away
		// for demo purposes. In a prod app, you will want to
		// separate that logic out and repeat this process
		// everytime the access token expires
		request.post(
			tssd || authURL + '/v2/token', 
			{
				form: {
					client_id: clientId,
					client_secret: clientSecret,
					grant_type: 'authorization_code',
					redirect_uri: redirectURL,
					code: code,
				}
			},
			function (error, response, body) {
				const result = JSON.parse(body);

				if (!error && response.statusCode == 200) {
					// storing the refresh token is useless in the demo
					// but in a prod app it will be used next time we
					// want to refresh the access token
					//req.session.refreshToken = result.refreshToken;

					// the access token below can authenticate
					// against the MC API
					req.session.accessToken = result.access_token;
					req.session.save(next);

					return;
				}

				next();
			}
		);
	} else if (!req.session.accessToken) {
		// User has not been authenticated yet, kick off the OAuth flow
		res.redirect(302,`${authURL}/v2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectURL)}`);
		
		return;
	} else {
		// User has already authenticated and we have a token, let's go!
		next();
	}
});

//static serve or the dist folder
app.use(express.static('dist'));

// the code below proxies REST calls from the UI
// the UI calls /proxy/<some-route> which is proxied
// to the MC API, with the authorization header injected
app.use('/proxy', proxy({
	logLevel: 'debug',
	changeOrigin: true,
	target: tssd || restURL,
	onError: function (err, req, res) {console.log(err);},
	protocolRewrite: 'https',
	pathRewrite: {
		'^/proxy': ''
	},
	secure: false,
	onProxyReq: function(proxyReq, req, res) {
		if (! req.session || !req.session.accessToken) {
			res.send(401);
		}
		proxyReq.setHeader('Authorization', 'Bearer ' + req.session.accessToken);
		proxyReq.setHeader('Content-Type', 'application/json');
		console.log(proxyReq._headers, Object.keys(proxyReq));
	},
	onProxyRes: function (proxyRes, req, res) {
		// you can do something here more than pass through proxying
	}
}));

// start the app, listening to whatever port environment
// variable is set by the host
app.listen(process.env.PORT || 3003, function () {
	console.log('App listening on port ' + (process.env.PORT || 3003));
});
