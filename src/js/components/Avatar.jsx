// This component renders the avatar.

// Include React (with addons).
var React = require('react');

// Include libraries.
var PubSub = require('pubsub-js');
var util   = require('../util/util.js');

// Create the component.
var Avatar = React.createClass({

	statics: {
		topics: function() {
			return {
				LoginClick: 'Avatar_LoginClick'
			};
		}
	},

	render: function() {

		// If we have a user url, show the user avatar, and link to user's
		// GitHub page. Otherwise show a default avatar, and prompt for
		// login on click.
		var action = this.props.userUrl ?
			<a href={this.props.userUrl}><img src={this.props.userAvatarUrl} /></a> :
			<button onClick={this.handleButtonClick}></button>;

		return (
			<div className='avatar'>
				{action}
			</div>
		);
	},

	handleButtonClick: function() {
		PubSub.publish(Avatar.topics().LoginClick);
	}


});

module.exports = Avatar;