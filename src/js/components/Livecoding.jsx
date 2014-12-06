// **Livecoding** is the parent component. It includes all other
// components. It listens and responds to events when necessary.
// It maintains the application's state.

// Include React.
var React   = require('react');

// Include libraries.
var PubSub         = require('pubsub-js');
var GitHub = require('../util/GitHub.js');
var _              = require('lodash');
var util           = require('../util/util.js');

// Include all top-level components.
var MenuBar = require('./MenuBar.jsx');
var Output  = require('./Output.jsx');
var Editor  = require('./Editor.jsx');
var Updates = require('./Updates.jsx');
var Avatar  = require('./Avatar.jsx');

// Get latest updates.
var updateData = require('../../../.tmp/updates.json');

// Create the React component.
var Livecoding = React.createClass({

	statics: {
		TOKEN: 'LIVECODING_TOKEN',
		USER_URL: 'LIVECODING_USER_URL',
		USER_AVATAR_URL: 'LIVECODING_USER_AVATAR_URL'
	},

	getToken: function() { return localStorage.getItem(Livecoding.TOKEN); },
	setToken: function(token) { localStorage.setItem(Livecoding.TOKEN, token); },

	getUserUrl: function() { return localStorage.getItem(Livecoding.USER_URL); },
	setUserUrl: function(userUrl) { localStorage.setItem(Livecoding.USER_URL, userUrl); },

	getUserAvatarUrl: function() { return localStorage.getItem(Livecoding.USER_AVATAR_URL); },
	setUserAvatarUrl: function(userAvatarUrl) { localStorage.setItem(Livecoding.USER_AVATAR_URL, userAvatarUrl); },

	// Set the initial state. As the application grows, so
	// will the number of state properties.
	getInitialState: function() {
		return {
			html: '',
			javascript: '',
			css: '',
			// Specify what mode we're currently editing.
			mode: 'html',
			gistUrl: null,
			userUrl: this.getUserUrl(),
			userAvatarUrl: this.getUserAvatarUrl()
		};
	},

	// Each React component has a `render` method. It gets called
	// every time the application's state changes.
	render: function() {

		// Get the current mode.
		var mode = this.state.mode;

		// Get the current mode's content.
		var content = this.state[mode];

		// Should output render all code?
		var makeOutputRenderAllCode = this.makeOutputRenderAllCode.pop();
		this.makeOutputRenderAllCode.push(this._defaultMakeOutputRenderAllCode);

		// Should we update the Editor?
		var updateEditor = this.updateEditorContent.pop();
		this.updateEditorContent.push(this._defaultUpdateEditorContent);

		// Render the application. This will recursively call
		// `render` on all the components.
		return (
			<div className='livecoding'>
				<MenuBar
					mode={mode}
					gistUrl={this.state.gistUrl}
					userUrl={this.state.userUrl}
					userAvatarUrl={this.state.userAvatarUrl}
				/>
				<div className='content'>
					<Output
						html={this.state.html}
						javascript={this.state.javascript}
						css={this.state.css}
						mode={mode}
						renderAllCode={makeOutputRenderAllCode}
					/>
					<Editor
						content={content}
						mode={mode}
						update={updateEditor}
					/>
				</div>
				<Updates updates={updateData} />
			</div>
		);
	},

	// This function gets called once, before the initial render.
	componentWillMount: function() {

		var self = this;

		// Setup all the subscriptions.
		PubSub.subscribe(Editor.topics().ContentChange, self.handleContentChange);
		PubSub.subscribe(MenuBar.topics().ModeChange, self.handleModeChange);
		PubSub.subscribe(MenuBar.topics().ItemClick, self.handleMenuItemClick);
		PubSub.subscribe(GitHub.topics().Token, self.handleGatekeeperToken);
		PubSub.subscribe(Avatar.topics().LoginClick, self.handleLoginClick);

		// If there's a gist id in the url, retrieve the gist.
		var match = location.href.match(/[a-z\d]+$/);
		if (match) {
			GitHub.readGist(this.getToken(), match[0])
				.then(function(response) {
					// Construct the gist url.
					var gistUrl = 'https://gist.github.com/' + match[0];
					// Instruct Output to render all code.
					self.makeOutputRenderAllCode.pop();
					self.makeOutputRenderAllCode.push(true);
					// Update the state.
					var state = _.assign({}, response, {gistUrl: gistUrl});
					self.setState(state);
				}).catch(function(error) {
					console.log('Error', error);
				});
		}

	},

	handleLoginClick: function() {
		GitHub.login();
	},

	// Every time **Editor**'s content changes it hands **Livecoding**
	// the new content. **Livecoding** then updates its current state
	// with the new content. This setup enforces React's one-way data
	// flow.
	handleContentChange: function(topic, content) {

		// Get the current mode.
		var mode = this.state.mode;

		// Update application state with new content.
		var change = {};
		change[mode] = content;

		// Don't update Editor contents.
		this.updateEditorContent.pop();
		this.updateEditorContent.push(false);

		this.setState(change);
	},

	// Handle mode change.
	handleModeChange: function(topic, mode) {
		this.setState({
			mode: mode
		});
	},

	// Handle menu item click.
	handleMenuItemClick: function(topic, menuItem) {

		switch(menuItem) {
			case 'file:new':

				// Reset all three code files
				// and set mode back to html.
				this.setState({
					html: '',
					javascript: '',
					css: '',
					mode: 'html'
				});

			break;

			case 'file:save':

				// Is user logged in? If so, save.
				if (this.getToken()) {
					this.save();
				} else {

					// There's no way to tell GitHub "after you give me a token, I want to save/delete/etc"
					// So we'll store the desired function call in a stack,
					this.afterAuthentication.push('save');
					// and then we'll make the login call.
					GitHub.login();
				}

			break;
		}
	},

	// Handle gatekeeper token.
	handleGatekeeperToken: function(topic, response) {

		// Save the token.
		this.setToken(response.token);

		var self = this;

		// Get user information.
		GitHub.getUser(this.getToken())
			.then(function(user) {

				// Save user info on local storage,
				self.setUserUrl(user.html_url);
				self.setUserAvatarUrl(user.avatar_url);

				// and update Livecoding's state.
				self.setState({
					userUrl: self.getUserUrl(),
					userAvatarUrl: self.getUserAvatarUrl()
				});

				// JS version of a switch statement.
				var nextSteps = {
					'save': function() {
						self.save();
					}
				};

				// Get next step after authentication.
				var next = self.afterAuthentication.pop();

				// If we have a next step,
				if (next) {

					// call it.
					nextSteps[next]();
				}

			}).catch(function(error) {
				console.log('Error', error);
			});

	},

	// Save gist.
	save: function() {

		// Create payload.
		var data = _.pick(this.state, [
			'html',
			'javascript',
			'css',
			'mode'
		]);

		var self = this;

		// Save to gist.
		GitHub.saveGist(this.getToken(), data)
			.then(function(gist) {

				self.setState({
					gistUrl: gist.html_url
				});

				history.pushState(gist.id, '', '#' + gist.id);

			}).catch(function(error) {
				console.log('Error', error);
			});
	},

	// Store the desired function call after authentication.
	afterAuthentication: [],

	// Decide whether to render all code in Output.
	_defaultMakeOutputRenderAllCode: false,
	makeOutputRenderAllCode: [this._defaultMakeOutputRenderAllCode],

	// Decide whether to render update Editor contents.
	_defaultUpdateEditorContent: true,
	updateEditorContent: [this._defaultUpdateEditorContent]

});

// Render the entire application to `.main`.
React.render(
	<Livecoding />,
	document.querySelector('.main')
);