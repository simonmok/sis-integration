module.exports = {

	/* User name used in Blackboard SIS framework integration */
	user: '887b9a40-b2bd-4af0-89d0-4564ea62108d',

	/* Password used in Blackboard SIS framework integration */
	password: 'password',

	/* Base URL used in Blackboard SIS framework integration */
	host: 'https://bb.bee-net.com/webapps/bb-data-integration-flatfile-BBLEARN',

	/* Number of milliseconds between SIS status polling */
	pollInterval: 5000,

	/* Maximum number of attempts of SIS status polling */
	pollMaxAttempts: 10,

	/* Delimiter character between fields in CSV files */
	fieldDelimiter: "|"

}